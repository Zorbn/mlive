import {
    MValue,
    mValueToString,
    mArrayGet,
    mValueToNumber,
    mArraySet,
    MScalar,
    MArray,
} from "./mArray.js";
import { MError } from "./mError.js";
import {
    AstNodeKind,
    BinaryOp,
    CallAstNode,
    CommandAstNode,
    DoBlockAstNode,
    ExpressionAstNode,
    IfAstNode,
    NewAstNode,
    QuitAstNode,
    SetArgumentAstNode,
    SetAstNode,
    TopLevelAstNode,
    VariableAstNode,
    WriteAstNode,
} from "./parser.js";

// TODO: Most important/unique things to interpret right now:
// negation of operators: '< means >=,
// builtins like $O: $O(array("subscript")),

interface InterpreterState {
    ast: TopLevelAstNode;
    valueStack: MValue[];
    environmentStack: Map<string, MValue>[];
    output: string[];
    errors: MError[];
}

const enum CommandResult {
    Continue,
    Quit,
    Halt,
}

const getEnvironmentForVariable = (name: string, state: InterpreterState) => {
    for (let i = state.environmentStack.length - 1; i >= 0; i--) {
        if (state.environmentStack[i].has(name)) {
            return state.environmentStack[i];
        }
    }

    return state.environmentStack[0];
};

const lookupVariable = (name: string, state: InterpreterState): MValue => {
    const environment = getEnvironmentForVariable(name, state);

    return environment.get(name) ?? "";
};

const setVariable = (name: string, value: MValue, state: InterpreterState) => {
    const environment = getEnvironmentForVariable(name, state);

    environment.set(name, value);
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
        for (let i = 0; i < tag.params.length; i++) {
            if (!interpretExpression(node.args[i], state)) {
                break;
            }

            if (!didPushEnvironment) {
                state.environmentStack.push(new Map());
                didPushEnvironment = true;
            }

            state.environmentStack[state.environmentStack.length - 1].set(
                tag.params[i],
                state.valueStack.pop()!,
            );
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
    const environment = getEnvironmentForVariable(name, state);

    let value = environment.get(name);

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

    state.valueStack.push(value);
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
        case AstNodeKind.BinaryOp: {
            if (!interpretExpression(node.left, state)) {
                return false;
            }

            if (!interpretExpression(node.right, state)) {
                return false;
            }

            const right = state.valueStack.pop()!;
            const left = state.valueStack.pop()!;

            switch (node.op) {
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

            break;
        }
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
            setVariable("$TEST", 0, state);
            return CommandResult.Continue;
        }
    }

    setVariable("$TEST", 1, state);

    for (const command of node.children) {
        const result = interpretCommand(command, state);

        if (result !== CommandResult.Continue) {
            return result;
        }
    }

    return CommandResult.Continue;
};

const interpretVariableSetArgument = (
    node: SetArgumentAstNode,
    state: InterpreterState,
): CommandResult => {
    if (!interpretExpression(node.value, state)) {
        return CommandResult.Halt;
    }

    const name = node.variable.name.text;
    const environment = getEnvironmentForVariable(name, state);

    if (node.variable.subscripts.length === 0) {
        environment.set(name, state.valueStack.pop()!);
        return CommandResult.Continue;
    }

    let array = environment.get(name);

    if (!array) {
        array = {
            value: "",
        };

        environment.set(name, array);
    } else if (typeof array !== "object") {
        array = {
            value: array,
        };

        environment.set(name, array);
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
                value: "",
            };

            mArraySet(array, subscriptKey, innerArray);
        } else if (typeof array !== "object") {
            innerArray = {
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

    setVariable("$TEST", 0, state);

    interpretTopLevel(state, ast.tags.get("main")!.index);

    return {
        output: state.output.join(""),
        errors: state.errors,
    };
};
