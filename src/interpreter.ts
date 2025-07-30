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
    mArrayKill,
    mValueCopy,
} from "./mArray.js";
import { MError } from "./mError.js";
import {
    AstNode,
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
    KillAstNode,
    MergeAstNode,
    NewAstNode,
    QuitAstNode,
    SetArgAstNode,
    SetAstNode,
    TopLevelAstNode,
    UnaryOp,
    UnaryOpAstNode,
    VariableAstNode,
    WriteAstNode,
    SelectBuiltinAstNode,
    OrderBuiltinAstNode,
    LengthBuiltinAstNode,
    ExtractBuiltinAstNode,
} from "./parser.js";

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

        if (variable === undefined) {
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

const getSubscriptKey = (
    node: VariableAstNode,
    state: InterpreterState,
    i: number,
    subscriptValues?: string[],
) => {
    if (subscriptValues) {
        return subscriptValues[i];
    } else {
        const subscript = interpretExpression(node.subscripts[i], state);

        if (!subscript) {
            return;
        }

        return mValueToString(state.valueStack.pop()!);
    }
};

const getVariable = (
    variable: VariableAstNode,
    state: InterpreterState,
    subscriptCount: number = variable.subscripts.length,
    subscriptValues?: string[],
): MValue | null | undefined => {
    const name = variable.name.text;
    const reference = getVariableReference(name, state);

    let value = getReferenceValue(reference, state);

    if (!value) {
        return null;
    }

    for (let i = 0; i < subscriptCount; i++) {
        if (typeof value !== "object") {
            return null;
        }

        const subscriptKey = getSubscriptKey(variable, state, i, subscriptValues);

        if (!subscriptKey) {
            return;
        }

        value = mArrayGet(value, subscriptKey);

        if (!value) {
            return null;
        }
    }

    return value;
};

const getOrCreateArrayAtSubscript = (
    variable: VariableAstNode,
    state: InterpreterState,
    subscriptCount: number = variable.subscripts.length,
    subscriptValues?: string[],
): MArray | undefined => {
    const name = variable.name.text;
    const reference = getVariableReference(name, state);

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

    for (let i = 0; i < subscriptCount; i++) {
        const subscriptKey = getSubscriptKey(variable, state, i, subscriptValues);

        if (!subscriptKey) {
            return;
        }

        let innerArray = mArrayGet(array, subscriptKey);

        if (typeof innerArray !== "object") {
            innerArray = {
                kind: MObjectKind.Array,
                value: innerArray as MScalar,
            };

            mArraySet(array, subscriptKey, innerArray);
        }

        array = innerArray as MArray;
    }

    return array;
};

const setVariable = (
    variable: VariableAstNode,
    value: MValue,
    state: InterpreterState,
): boolean => {
    if (variable.subscripts.length === 0) {
        const name = variable.name.text;
        const reference = getVariableReference(name, state);

        setReferenceValue(reference, value, state);
        return true;
    }

    const lastSubscript = variable.subscripts.length - 1;
    const array = getOrCreateArrayAtSubscript(variable, state, lastSubscript);

    if (!array) {
        return false;
    }

    if (!interpretExpression(variable.subscripts[lastSubscript], state)) {
        return false;
    }

    const finalSubscriptKey = mValueToString(state.valueStack.pop()!);

    mArraySet(array, finalSubscriptKey, value);
    return true;
};

const reportError = (message: string, node: AstNode, state: InterpreterState) => {
    state.errors.push({
        message,
        line: node.start.line,
        column: node.start.column,
    });
};

const interpretVariable = (node: VariableAstNode, state: InterpreterState): boolean => {
    const value = getVariable(node, state);

    if (value === undefined) {
        return false;
    } else if (value === null) {
        state.valueStack.push("");
        return true;
    } else {
        state.valueStack.push(mValueToScalar(value));
        return true;
    }
};

const interpretCall = (
    node: CallAstNode,
    state: InterpreterState,
    hasReturnValue: boolean,
): boolean => {
    const tag = state.ast.tags.get(node.name.text);

    if (tag === undefined) {
        reportError(`Tag "${node.name.text}" not found`, node, state);
        return false;
    }

    const callEnvironmentStackLength = state.environmentStack.length;

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

const interpretUnaryOp = (node: UnaryOpAstNode, state: InterpreterState): boolean => {
    if (!interpretExpression(node.right, state)) {
        return false;
    }

    const right = state.valueStack.pop()!;

    let value: MValue;

    switch (node.op) {
        case UnaryOp.Not:
            value = mValueToNumber(right) === 0 ? 1 : 0;
            break;
        case UnaryOp.Plus:
            value = mValueToNumber(right);
            break;
        case UnaryOp.Minus:
            value = -mValueToNumber(right);
            break;
        default:
            reportError("Unimplemented unary op", node, state);
            return false;
    }

    state.valueStack.push(value);

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

    let value: MValue;

    switch (node.op) {
        case BinaryOp.Or:
            value = mValueToNumber(left) !== 0 || mValueToNumber(right) !== 0 ? 1 : 0;
            break;
        case BinaryOp.And:
            value = mValueToNumber(left) !== 0 && mValueToNumber(right) !== 0 ? 1 : 0;
            break;
        case BinaryOp.Equals:
            value = left === right ? 1 : 0;
            break;
        case BinaryOp.LessThan:
            value = left < right ? 1 : 0;
            break;
        case BinaryOp.GreaterThan:
            value = left > right ? 1 : 0;
            break;
        case BinaryOp.Add:
            value = mValueToNumber(left) + mValueToNumber(right);
            break;
        case BinaryOp.Subtract:
            value = mValueToNumber(left) - mValueToNumber(right);
            break;
        case BinaryOp.Multiply:
            value = mValueToNumber(left) * mValueToNumber(right);
            break;
        case BinaryOp.Divide:
            value = mValueToNumber(left) / mValueToNumber(right);
            break;
        case BinaryOp.IntegerDivide:
            value = Math.floor(mValueToNumber(left) / mValueToNumber(right));
            break;
        case BinaryOp.Modulo:
            value = mValueToNumber(left) % mValueToNumber(right);
            break;
        case BinaryOp.Concatenate:
            value = mValueToString(left) + mValueToString(right);
            break;
        default:
            reportError("Unimplemented binary op", node, state);
            return false;
    }

    if (node.isNegated) {
        value = mValueToNumber(value) === 0 ? 1 : 0;
    }

    state.valueStack.push(value);

    return true;
};

const interpretOrderBuiltin = (node: OrderBuiltinAstNode, state: InterpreterState): boolean => {
    const variable = node.arg;

    if (variable.subscripts.length === 0) {
        state.valueStack.push("");
        return true;
    }

    const lastSubscript = variable.subscripts.length - 1;
    const value = getVariable(variable, state, lastSubscript);

    if (value === undefined) {
        return false;
    }

    if (!interpretExpression(variable.subscripts[lastSubscript], state)) {
        return false;
    }

    const finalSubscriptKey = mValueToString(state.valueStack.pop()!);

    if (value === null || typeof value !== "object") {
        state.valueStack.push("");
        return true;
    }

    const nextKey = mArrayGetNextKey(value, finalSubscriptKey);

    state.valueStack.push(nextKey);
    return true;
};

const interpretLengthBuiltin = (node: LengthBuiltinAstNode, state: InterpreterState): boolean => {
    if (!interpretExpression(node.arg, state)) {
        return false;
    }

    const value = mValueToString(state.valueStack.pop()!);
    state.valueStack.push(value.length);

    return true;
};

const getExtractionStart = (
    node: ExtractBuiltinAstNode,
    state: InterpreterState,
): number | undefined => {
    if (node.args.length >= 2) {
        if (!interpretExpression(node.args[1], state)) {
            return;
        }

        return mValueToNumber(state.valueStack.pop()!) - 1;
    }

    return 0;
};

const getExtractionEnd = (
    node: ExtractBuiltinAstNode,
    state: InterpreterState,
    start: number,
): number | undefined => {
    if (node.args.length >= 3) {
        if (!interpretExpression(node.args[2], state)) {
            return;
        }

        return mValueToNumber(state.valueStack.pop()!);
    }

    return start + 1;
};

const interpretExtractBuiltin = (node: ExtractBuiltinAstNode, state: InterpreterState): boolean => {
    if (!interpretExpression(node.args[0], state)) {
        return false;
    }

    const value = mValueToString(state.valueStack.pop()!);
    const start = getExtractionStart(node, state);

    if (start === undefined) {
        return false;
    }

    const end = getExtractionEnd(node, state, start);

    if (end === undefined) {
        return false;
    }

    state.valueStack.push(value.slice(start, end));

    return true;
};

const interpretSelectBuiltin = (node: SelectBuiltinAstNode, state: InterpreterState): boolean => {
    for (const arg of node.args) {
        if (!interpretExpression(arg.condition, state)) {
            return false;
        }

        if (mValueToNumber(state.valueStack.pop()!) === 0) {
            continue;
        }

        if (!interpretExpression(arg.value, state)) {
            return false;
        }

        return true;
    }

    reportError("All select conditions were false", node, state);
    return false;
};

const interpretExpression = (node: ExpressionAstNode, state: InterpreterState): boolean => {
    switch (node.kind) {
        case AstNodeKind.Variable: {
            if (!interpretVariable(node, state)) {
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
        case AstNodeKind.UnaryOp:
            return interpretUnaryOp(node, state);
        case AstNodeKind.BinaryOp:
            return interpretBinaryOp(node, state);
        case AstNodeKind.OrderBuiltin:
            return interpretOrderBuiltin(node, state);
        case AstNodeKind.LengthBuiltin:
            return interpretLengthBuiltin(node, state);
        case AstNodeKind.ExtractBuiltin:
            return interpretExtractBuiltin(node, state);
        case AstNodeKind.SelectBuiltin:
            return interpretSelectBuiltin(node, state);
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

    return interpretChildCommands(node.children, state);
};

const interpretElse = (node: ElseAstNode, state: InterpreterState): CommandResult => {
    const test = getSpecialVariable("$TEST", state);

    if (test && mValueToNumber(test) !== 0) {
        return CommandResult.Continue;
    }

    return interpretChildCommands(node.children, state);
};

const interpretChildCommands = (
    children: CommandAstNode[],
    state: InterpreterState,
): CommandResult => {
    for (const command of children) {
        const result = interpretCommand(command, state);

        if (result !== CommandResult.Continue) {
            return result;
        }
    }

    return CommandResult.Continue;
};

const interpretForWithNoArg = (
    children: CommandAstNode[],
    state: InterpreterState,
): CommandResult => {
    while (true) {
        switch (interpretChildCommands(children, state)) {
            case CommandResult.Halt:
                return CommandResult.Halt;
            case CommandResult.Quit:
                return CommandResult.Continue;
        }
    }
};

const interpretForWithStart = (
    variable: VariableAstNode,
    start: ExpressionAstNode,
    children: CommandAstNode[],
    state: InterpreterState,
): CommandResult => {
    if (!interpretExpression(start, state)) {
        return CommandResult.Halt;
    }

    const startValue = mValueToNumber(state.valueStack.pop()!);

    if (!setVariable(variable, startValue, state)) {
        return CommandResult.Halt;
    }

    if (interpretChildCommands(children, state) === CommandResult.Halt) {
        return CommandResult.Halt;
    }

    return CommandResult.Continue;
};

const interpretForWithStartIncrement = (
    variable: VariableAstNode,
    start: ExpressionAstNode,
    increment: ExpressionAstNode,
    children: CommandAstNode[],
    state: InterpreterState,
): CommandResult => {
    if (!interpretExpression(start, state) || !interpretExpression(increment, state)) {
        return CommandResult.Halt;
    }

    const incrementValue = mValueToNumber(state.valueStack.pop()!);
    const startValue = mValueToNumber(state.valueStack.pop()!);

    if (!setVariable(variable, startValue, state)) {
        return CommandResult.Halt;
    }

    while (true) {
        switch (interpretChildCommands(children, state)) {
            case CommandResult.Halt:
                return CommandResult.Halt;
            case CommandResult.Quit:
                return CommandResult.Continue;
        }

        if (!interpretVariable(variable, state)) {
            return CommandResult.Halt;
        }

        const nextVariableValue = mValueToNumber(state.valueStack.pop()!) + incrementValue;

        if (!setVariable(variable, nextVariableValue, state)) {
            return CommandResult.Halt;
        }
    }
};

const interpretForWithStartIncrementEnd = (
    variable: VariableAstNode,
    start: ExpressionAstNode,
    increment: ExpressionAstNode,
    end: ExpressionAstNode,
    children: CommandAstNode[],
    state: InterpreterState,
): CommandResult => {
    if (
        !interpretExpression(start, state) ||
        !interpretExpression(increment, state) ||
        !interpretExpression(end, state)
    ) {
        return CommandResult.Halt;
    }

    const endValue = mValueToNumber(state.valueStack.pop()!);
    const incrementValue = mValueToNumber(state.valueStack.pop()!);
    const startValue = mValueToNumber(state.valueStack.pop()!);

    if (!setVariable(variable, startValue, state)) {
        return CommandResult.Halt;
    }

    while (true) {
        if (!interpretVariable(variable, state)) {
            return CommandResult.Halt;
        }

        const variableValue = mValueToNumber(state.valueStack.pop()!);

        if (
            (incrementValue < 0 && variableValue < startValue) ||
            (incrementValue > 0 && variableValue > endValue)
        ) {
            return CommandResult.Continue;
        }

        switch (interpretChildCommands(children, state)) {
            case CommandResult.Halt:
                return CommandResult.Halt;
            case CommandResult.Quit:
                return CommandResult.Continue;
        }

        if (!interpretVariable(variable, state)) {
            return CommandResult.Halt;
        }

        const nextVariableValue = mValueToNumber(state.valueStack.pop()!) + incrementValue;

        if (!setVariable(variable, nextVariableValue, state)) {
            return CommandResult.Halt;
        }
    }
};

const interpretFor = (node: ForAstNode, state: InterpreterState): CommandResult => {
    if (!node.arg) {
        return interpretForWithNoArg(node.children, state);
    }

    switch (node.arg.expressions.length) {
        case 1:
            return interpretForWithStart(
                node.arg.variable,
                node.arg.expressions[0],
                node.children,
                state,
            );
        case 2:
            return interpretForWithStartIncrement(
                node.arg.variable,
                node.arg.expressions[0],
                node.arg.expressions[1],
                node.children,
                state,
            );
        case 3:
            return interpretForWithStartIncrementEnd(
                node.arg.variable,
                node.arg.expressions[0],
                node.arg.expressions[1],
                node.arg.expressions[2],
                node.children,
                state,
            );
        default:
            reportError("Invalid number of expressions in for argument", node, state);
            return CommandResult.Halt;
    }
};

const replaceStringRange = (destination: string, source: string, start: number, end: number) => {
    const before = destination.slice(0, start);
    const after = destination.slice(end);

    return `${before}${source}${after}`;
};

const interpretSetExtract = (
    node: ExtractBuiltinAstNode,
    state: InterpreterState,
    value: string,
) => {
    if (node.args[0].kind !== AstNodeKind.Variable) {
        return CommandResult.Continue;
    }

    const start = getExtractionStart(node, state);

    if (start === undefined) {
        return CommandResult.Halt;
    }

    const end = getExtractionEnd(node, state, start);

    if (end === undefined) {
        return CommandResult.Halt;
    }

    const variable = node.args[0];

    if (variable.kind !== AstNodeKind.Variable) {
        return CommandResult.Continue;
    }

    if (variable.subscripts.length === 0) {
        const reference = getVariableReference(variable.name.text, state);
        const destination = mValueToString(getReferenceValue(reference, state) ?? "");
        const newValue = replaceStringRange(destination, value, start, end);

        setReferenceValue(reference, newValue, state);

        return CommandResult.Continue;
    }

    const lastSubscript = variable.subscripts.length - 1;
    const array = getVariable(variable, state, lastSubscript);

    if (array === undefined) {
        return CommandResult.Halt;
    }

    if (!interpretExpression(variable.subscripts[lastSubscript], state)) {
        return CommandResult.Halt;
    }

    const finalSubscriptKey = mValueToString(state.valueStack.pop()!);

    if (array === null || typeof array !== "object") {
        return CommandResult.Continue;
    }

    const destination = mValueToString(mArrayGet(array, finalSubscriptKey));
    const newValue = replaceStringRange(destination, value, start, end);

    mArraySet(array, finalSubscriptKey, newValue);

    return CommandResult.Continue;
};

const interpretVariableSetArgument = (
    node: SetArgAstNode,
    state: InterpreterState,
): CommandResult => {
    if (!interpretExpression(node.value, state)) {
        return CommandResult.Halt;
    }

    const value = state.valueStack.pop()!;

    if (node.target.kind === AstNodeKind.ExtractBuiltin) {
        return interpretSetExtract(node.target, state, mValueToString(value));
    }

    return setVariable(node.target, value, state) ? CommandResult.Continue : CommandResult.Halt;
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

const interpretKill = (node: KillAstNode, state: InterpreterState): CommandResult => {
    if (node.args.length === 0) {
        state.environmentStack = [new Map()];
        return CommandResult.Continue;
    }

    for (const arg of node.args) {
        if (arg.subscripts.length > 0) {
            const lastSubscript = arg.subscripts.length - 1;
            const value = getVariable(arg, state, lastSubscript);

            if (value === undefined) {
                return CommandResult.Halt;
            }

            if (!interpretExpression(arg.subscripts[lastSubscript], state)) {
                return CommandResult.Halt;
            }

            const key = mValueToString(state.valueStack.pop()!);

            if (value === null || typeof value !== "object") {
                return CommandResult.Continue;
            }

            mArrayKill(value, key);
            continue;
        }

        for (let i = state.environmentStack.length - 1; i >= 0; i--) {
            if (state.environmentStack[i].delete(arg.name.text)) {
                break;
            }
        }
    }

    return CommandResult.Continue;
};

const interpretSubscripts = (
    expressions: ExpressionAstNode[],
    state: InterpreterState,
): string[] | undefined => {
    const values = [];

    for (const subscript of expressions) {
        if (!interpretExpression(subscript, state)) {
            return;
        }

        values.push(mValueToString(state.valueStack.pop()!));
    }

    return values;
};

const interpretMerge = (node: MergeAstNode, state: InterpreterState): CommandResult => {
    const leftSubscriptValues = interpretSubscripts(node.left.subscripts, state);

    if (!leftSubscriptValues) {
        return CommandResult.Halt;
    }

    const rightSubscriptValues = interpretSubscripts(node.right.subscripts, state);

    if (!rightSubscriptValues) {
        return CommandResult.Halt;
    }

    let doVariablesOverlap = node.left.name.text === node.right.name.text;

    if (doVariablesOverlap) {
        const overlappingSubscriptCount = Math.min(
            leftSubscriptValues.length,
            rightSubscriptValues.length,
        );

        for (let i = 0; i < overlappingSubscriptCount; i++) {
            if (leftSubscriptValues[i] !== rightSubscriptValues[i]) {
                doVariablesOverlap = false;
                break;
            }
        }
    }

    if (doVariablesOverlap) {
        reportError("Cannot merge overlapping variables", node, state);
        return CommandResult.Halt;
    }

    const destination = getOrCreateArrayAtSubscript(
        node.left,
        state,
        leftSubscriptValues.length,
        leftSubscriptValues,
    );

    if (!destination) {
        return CommandResult.Halt;
    }

    const source = getVariable(
        node.right,
        state,
        rightSubscriptValues.length,
        rightSubscriptValues,
    );

    if (source === undefined) {
        return CommandResult.Halt;
    }

    if (source === null || typeof source !== "object" || !source.children) {
        return CommandResult.Continue;
    }

    for (const pair of source.children) {
        mArraySet(destination, pair.key, mValueCopy(pair.value));
    }

    return CommandResult.Continue;
};

const interpretCommand = (node: CommandAstNode, state: InterpreterState): CommandResult => {
    if (node.condition) {
        if (!interpretExpression(node.condition, state)) {
            return CommandResult.Halt;
        }

        if (mValueToNumber(state.valueStack.pop()!) === 0) {
            return CommandResult.Continue;
        }
    }

    switch (node.body.kind) {
        case AstNodeKind.Comment:
            return CommandResult.Continue;
        case AstNodeKind.Write:
            return interpretWrite(node.body, state);
        case AstNodeKind.Quit:
            return interpretQuit(node.body, state);
        case AstNodeKind.DoBlock:
            return interpretDoBlock(node.body, state);
        case AstNodeKind.If:
            return interpretIf(node.body, state);
        case AstNodeKind.Else:
            return interpretElse(node.body, state);
        case AstNodeKind.For:
            return interpretFor(node.body, state);
        case AstNodeKind.Set:
            return interpretSet(node.body, state);
        case AstNodeKind.New:
            return interpretNew(node.body, state);
        case AstNodeKind.Kill:
            return interpretKill(node.body, state);
        case AstNodeKind.Merge:
            return interpretMerge(node.body, state);
        case AstNodeKind.Halt:
            return CommandResult.Halt;
        case AstNodeKind.Call:
            return interpretCall(node.body, state, false)
                ? CommandResult.Continue
                : CommandResult.Halt;
        default:
            reportError("Unrecognized command", node, state);
            return CommandResult.Halt;
    }
};

const interpretTopLevel = (state: InterpreterState, start: number) => {
    for (let i = start; i < state.ast.children.length; i++) {
        const result = interpretCommand(state.ast.children[i], state);

        if (result !== CommandResult.Continue) {
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

    interpretTopLevel(state, ast.tags.get("main")?.index ?? 0);

    return {
        output: state.output.join(""),
        errors: state.errors,
    };
};
