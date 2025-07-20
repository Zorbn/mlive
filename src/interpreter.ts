import {
    MValue,
    mValueToString,
    mArrayGet,
    mValueToNumber,
    mArraySet,
    MScalar,
    MArray,
    mArrayGetNextKey,
    mValueToScalar,
    MReference,
    MObjectKind,
} from "./mArray.js";
import { MError } from "./mError.js";
import {
    AstNodeKind,
    BinaryOp,
    BinaryOpAstNode,
    CallAstNode,
    CommandAstNode,
    DoBlockAstNode,
    ElseAstNode,
    ExpressionAstNode,
    ForAstNode,
    IfAstNode,
    NewAstNode,
    OrderAstNode,
    QuitAstNode,
    SetArgumentAstNode,
    SetAstNode,
    TopLevelAstNode,
    VariableAstNode,
    WriteAstNode,
} from "./parser.js";

// TODO: Most important/unique things to interpret right now:
// negation of operators: '< means >=,
// support version of the for command with arguments
// it should be an error to use "" as a subscript
// add post conditions

type Environment = Map<string, MValue | MReference>;

interface InterpreterState {
    ast: TopLevelAstNode;
    valueStack: MScalar[];
    environmentStack: Environment[];
    output: string[];
    errors: MError[];
}

const enum CommandResult {
    Continue,
    Quit,
    Halt,
}

const getVariableReference = (name: string, state: InterpreterState): MReference => {
    for (let i = state.environmentStack.length - 1; i >= 0; i--) {
        const variable = state.environmentStack[i].get(name);

        if (!variable) {
            continue;
        }

        if (typeof variable === "object" && variable.kind === MObjectKind.Reference) {
            return variable;
        }

        return {
            kind: MObjectKind.Reference,
            environmentIndex: i,
            name,
        };
    }

    return {
        kind: MObjectKind.Reference,
        environmentIndex: 0,
        name,
    };
};

const getReferenceValue = (reference: MReference, state: InterpreterState): MValue | undefined => {
    return state.environmentStack[reference.environmentIndex].get(reference.name) as
        | MValue
        | undefined;
};

const setReferenceValue = (reference: MReference, value: MValue, state: InterpreterState) => {
    return state.environmentStack[reference.environmentIndex].set(reference.name, value);
};

const getSpecialVariable = (name: string, state: InterpreterState): MValue | undefined => {
    return state.environmentStack[0].get(name) as MValue | undefined;
};

const setSpecialVariable = (name: string, value: MValue, state: InterpreterState) => {
    state.environmentStack[0].set(name, value);
};

const reportError = (message: string, state: InterpreterState) => {
    console.log(message, state);
    state.errors.push({
        message,
        // TODO: These values need to be stored in the AST to be available here.
        line: 0,
        column: 0,
    });
};

const interpretCall = (
    node: CallAstNode,
    state: InterpreterState,
    hasReturnValue: boolean,
): boolean => {
    const tag = state.ast.tags.get(node.name.text);

    if (tag === undefined) {
        reportError(`Tag \"${node.name.text}\" not found`, state);
        return false;
    }

    let didPushEnvironment = false;

    if (tag.params) {
        for (let i = 0; i < Math.min(tag.params.length, node.args.length); i++) {
            const arg = node.args[i];
            let argValue: MValue | MReference;

            if (arg.kind === AstNodeKind.Reference) {
                argValue = getVariableReference(arg.name.text, state);
            } else {
                if (!interpretExpression(arg, state)) {
                    return false;
                }

                argValue = state.valueStack.pop()!;
            }

            if (!didPushEnvironment) {
                state.environmentStack.push(new Map());
                didPushEnvironment = true;
            }

            state.environmentStack[state.environmentStack.length - 1].set(tag.params[i], argValue);
        }

        for (let i = node.args.length; i < tag.params.length; i++) {
            state.environmentStack[state.environmentStack.length - 1].set(tag.params[i], "");
        }
    }

    const callEnvironmentStackLength = state.environmentStack.length;
    const callValueStackLength = state.valueStack.length;

    interpretTopLevel(state, tag.index);

    if (hasReturnValue) {
        if (state.valueStack.length === callValueStackLength) {
            state.valueStack.push("");
        }
    } else {
        state.valueStack.length = callValueStackLength;
    }

    state.environmentStack.length = callEnvironmentStackLength;

    return true;
};

const interpretVariableLookup = (node: VariableAstNode, state: InterpreterState): boolean => {
    const name = node.name.text;
    const reference = getVariableReference(name, state);

    let value = getReferenceValue(reference, state);

    if (!value) {
        state.valueStack.push("");
        return true;
    }

    for (let i = 0; i < node.subscripts.length; i++) {
        if (typeof value !== "object") {
            state.valueStack.push("");
            return true;
        }

        const subscript = interpretExpression(node.subscripts[i], state);

        if (!subscript) {
            return false;
        }

        const subscriptKey = mValueToString(state.valueStack.pop()!);
        value = mArrayGet(value, subscriptKey);

        if (!value) {
            state.valueStack.push("");
            return true;
        }
    }

    state.valueStack.push(mValueToScalar(value));
    return true;
};

const interpretBinaryOp = (node: BinaryOpAstNode, state: InterpreterState): boolean => {
    if (!interpretExpression(node.left, state)) {
        return false;
    }

    if (!interpretExpression(node.right, state)) {
        return false;
    }

    const right = state.valueStack.pop()!;
    const left = state.valueStack.pop()!;

    switch (node.op) {
        case BinaryOp.Equals:
            state.valueStack.push(left === right ? 1 : 0);
            break;
        case BinaryOp.Plus:
            state.valueStack.push(mValueToNumber(left) + mValueToNumber(right));
            break;
        case BinaryOp.Minus:
            state.valueStack.push(mValueToNumber(left) - mValueToNumber(right));
            break;
        default:
            reportError("Unimplemented binary op", state);
            break;
    }

    return true;
};

const interpretOrder = (node: OrderAstNode, state: InterpreterState): boolean => {
    const name = node.variable.name.text;
    const reference = getVariableReference(name, state);

    let value = getReferenceValue(reference, state);

    if (!value || node.variable.subscripts.length === 0) {
        state.valueStack.push("");
        return true;
    }

    // TODO: Find a way to consolidate the multiple places where we need to look up or set variables with subscripts.
    for (let i = 0; i < node.variable.subscripts.length - 1; i++) {
        if (typeof value !== "object") {
            state.valueStack.push("");
            return true;
        }

        const subscript = interpretExpression(node.variable.subscripts[i], state);

        if (!subscript) {
            return false;
        }

        const subscriptKey = mValueToString(state.valueStack.pop()!);
        value = mArrayGet(value, subscriptKey);

        if (!value) {
            state.valueStack.push("");
            return true;
        }
    }

    if (typeof value !== "object") {
        state.valueStack.push("");
        return true;
    }

    const finalSubscript = interpretExpression(
        node.variable.subscripts[node.variable.subscripts.length - 1],
        state,
    );

    if (!finalSubscript) {
        return false;
    }

    const finalSubscriptKey = mValueToString(state.valueStack.pop()!);
    const nextKey = mArrayGetNextKey(value, finalSubscriptKey);

    state.valueStack.push(nextKey);
    return true;
};

const interpretExpression = (node: ExpressionAstNode, state: InterpreterState): boolean => {
    switch (node.kind) {
        case AstNodeKind.Variable: {
            if (!interpretVariableLookup(node, state)) {
                return false;
            }

            break;
        }
        case AstNodeKind.NumberLiteral:
            state.valueStack.push(node.value);
            break;
        case AstNodeKind.StringLiteral:
            state.valueStack.push(node.value);
            break;
        case AstNodeKind.Call:
            return interpretCall(node, state, true);
        case AstNodeKind.BinaryOp:
            return interpretBinaryOp(node, state);
        case AstNodeKind.Order:
            return interpretOrder(node, state);
    }

    return true;
};

const interpretWrite = (node: WriteAstNode, state: InterpreterState): CommandResult => {
    // TODO: Support formatting with ?.

    for (const arg of node.args) {
        switch (arg.kind) {
            case AstNodeKind.HashFormatter:
                state.output.length = 0;
                break;
            case AstNodeKind.ExclamationPointFormatter:
                state.output.push("\n");
                break;
            default:
                if (!interpretExpression(arg, state)) {
                    return CommandResult.Halt;
                }

                state.output.push(state.valueStack.pop()!.toString());
                break;
        }
    }

    return CommandResult.Continue;
};

const interpretQuit = (node: QuitAstNode, state: InterpreterState): CommandResult => {
    if (!node.returnValue) {
        return CommandResult.Quit;
    }

    if (!interpretExpression(node.returnValue, state)) {
        return CommandResult.Halt;
    }

    return CommandResult.Quit;
};

const interpretDoBlock = (node: DoBlockAstNode, state: InterpreterState): CommandResult => {
    const startEnvironmentStackLength = state.environmentStack.length;

    for (const command of node.children) {
        const blockResult = interpretCommand(command, state);

        if (blockResult === CommandResult.Quit) {
            break;
        }

        if (blockResult === CommandResult.Halt) {
            return blockResult;
        }
    }

    state.environmentStack.length = startEnvironmentStackLength;

    return CommandResult.Continue;
};

const interpretIf = (node: IfAstNode, state: InterpreterState): CommandResult => {
    for (const condition of node.conditions) {
        if (!interpretExpression(condition, state)) {
            return CommandResult.Halt;
        }

        if (mValueToNumber(state.valueStack.pop()!) === 0) {
            setSpecialVariable("$TEST", 0, state);
            return CommandResult.Continue;
        }
    }

    setSpecialVariable("$TEST", 1, state);

    for (const command of node.children) {
        const result = interpretCommand(command, state);

        if (result !== CommandResult.Continue) {
            return result;
        }
    }

    return CommandResult.Continue;
};

const interpretElse = (node: ElseAstNode, state: InterpreterState): CommandResult => {
    const test = getSpecialVariable("$TEST", state);

    if (test && mValueToNumber(test) === 1) {
        return CommandResult.Continue;
    }

    for (const command of node.children) {
        const result = interpretCommand(command, state);

        if (result !== CommandResult.Continue) {
            return result;
        }
    }

    return CommandResult.Continue;
};

const interpretFor = (node: ForAstNode, state: InterpreterState): CommandResult => {
    while (true) {
        for (const command of node.children) {
            const result = interpretCommand(command, state);

            if (result === CommandResult.Halt) {
                return result;
            }

            if (result === CommandResult.Quit) {
                return CommandResult.Continue;
            }
        }
    }
};

const interpretVariableSetArgument = (
    node: SetArgumentAstNode,
    state: InterpreterState,
): CommandResult => {
    if (!interpretExpression(node.value, state)) {
        return CommandResult.Halt;
    }

    const name = node.variable.name.text;
    const reference = getVariableReference(name, state);

    if (node.variable.subscripts.length === 0) {
        setReferenceValue(reference, state.valueStack.pop()!, state);
        return CommandResult.Continue;
    }

    let array = getReferenceValue(reference, state);

    if (!array) {
        array = {
            kind: MObjectKind.Array,
            value: "",
        };

        setReferenceValue(reference, array, state);
    } else if (typeof array !== "object") {
        array = {
            kind: MObjectKind.Array,
            value: array,
        };

        setReferenceValue(reference, array, state);
    }

    for (let i = 0; i < node.variable.subscripts.length - 1; i++) {
        const subscript = interpretExpression(node.variable.subscripts[i], state);

        if (!subscript) {
            return CommandResult.Halt;
        }

        const subscriptKey = mValueToString(state.valueStack.pop()!);
        let innerArray = mArrayGet(array, subscriptKey);

        if (!innerArray) {
            innerArray = {
                kind: MObjectKind.Array,
                value: "",
            };

            mArraySet(array, subscriptKey, innerArray);
        } else if (typeof array !== "object") {
            innerArray = {
                kind: MObjectKind.Array,
                value: innerArray as MScalar,
            };

            mArraySet(array, subscriptKey, innerArray);
        }

        array = innerArray as MArray;
    }

    const finalSubscript = interpretExpression(
        node.variable.subscripts[node.variable.subscripts.length - 1],
        state,
    );

    if (!finalSubscript) {
        return CommandResult.Halt;
    }

    const finalSubscriptKey = mValueToString(state.valueStack.pop()!);

    mArraySet(array, finalSubscriptKey, state.valueStack.pop()!);
    return CommandResult.Continue;
};

const interpretSet = (node: SetAstNode, state: InterpreterState): CommandResult => {
    for (const arg of node.args) {
        const result = interpretVariableSetArgument(arg, state);

        if (result !== CommandResult.Continue) {
            return result;
        }
    }

    return CommandResult.Continue;
};

const interpretNew = (node: NewAstNode, state: InterpreterState): CommandResult => {
    if (node.args.length === 0) {
        return CommandResult.Continue;
    }

    const environment = new Map();

    for (const arg of node.args) {
        environment.set(arg.text, "");
    }

    state.environmentStack.push(environment);

    return CommandResult.Continue;
};

const interpretCommand = (node: CommandAstNode, state: InterpreterState): CommandResult => {
    switch (node.kind) {
        case AstNodeKind.Write:
            return interpretWrite(node, state);
        case AstNodeKind.Quit:
            return interpretQuit(node, state);
        case AstNodeKind.DoBlock:
            return interpretDoBlock(node, state);
        case AstNodeKind.If:
            return interpretIf(node, state);
        case AstNodeKind.Else:
            return interpretElse(node, state);
        case AstNodeKind.For:
            return interpretFor(node, state);
        case AstNodeKind.Set:
            return interpretSet(node, state);
        case AstNodeKind.New:
            return interpretNew(node, state);
        case AstNodeKind.Call:
            return interpretCall(node, state, false) ? CommandResult.Continue : CommandResult.Halt;
        default:
            reportError("Unrecognized command", state);
            return CommandResult.Halt;
    }
};

const interpretTopLevel = (state: InterpreterState, start: number) => {
    for (let i = start; i < state.ast.children.length; i++) {
        const result = interpretCommand(state.ast.children[i], state);

        if (result == CommandResult.Quit || result == CommandResult.Halt) {
            break;
        }
    }
};

export const interpret = (ast: TopLevelAstNode) => {
    const state = {
        ast,
        valueStack: [],
        environmentStack: [new Map()],
        output: [],
        errors: [],
    };

    setSpecialVariable("$TEST", 0, state);

    interpretTopLevel(state, ast.tags.get("main")!.index);

    return {
        output: state.output.join(""),
        errors: state.errors,
    };
};
