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
    Environment,
    mArrayGetPreviousKey,
} from "./mValue.js";
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
    FindBuiltinAstNode,
    RandomBuiltinAstNode,
    Tag,
    CallArgumentAstNode,
    AsciiBuiltinAstNode,
    CharBuiltinAstNode,
} from "./parser.js";

export type Extern = (...args: MValue[]) => MScalar | undefined | void;

interface InterpreterState {
    ast: TopLevelAstNode;
    externs: Map<string, Extern>;
    valueStack: MScalar[];
    environmentStack: Environment[];
    outputColumn: number;
    output: string[];
    errors: MError[];
}

const enum CommandResult {
    Continue,
    Quit,
    Halt,
}

const getSubscriptKey = (
    state: InterpreterState,
    i: number,
    subscripts?: ExpressionAstNode[],
    subscriptValues?: string[],
) => {
    if (subscriptValues) {
        return subscriptValues[i];
    } else if (subscripts) {
        const subscript = interpretExpression(subscripts[i], state);

        if (!subscript) {
            return;
        }

        return mValueToString(state.valueStack.pop()!);
    }
};

const getReference = (
    name: string,
    state: InterpreterState,
    subscriptCount: number,
    subscripts?: ExpressionAstNode[],
    subscriptValues?: string[],
    canCreate: boolean = false,
): MReference | null | undefined => {
    let environment = state.environmentStack[0];
    let value: MValue | undefined;

    for (let i = state.environmentStack.length - 1; i >= 0; i--) {
        const possibleEnvironment = state.environmentStack[i];
        const possibleValue = possibleEnvironment.get(name);

        if (possibleValue === undefined) {
            continue;
        }

        if (
            typeof possibleValue === "object" &&
            (possibleValue.kind === MObjectKind.ArrayReference ||
                possibleValue.kind === MObjectKind.EnvironmentReference)
        ) {
            return possibleValue;
        }

        environment = possibleEnvironment;
        value = possibleValue;
        break;
    }

    if (subscriptCount === 0) {
        return {
            kind: MObjectKind.EnvironmentReference,
            environment,
            name,
        };
    }

    let array: MArray | undefined;
    let subscriptKey: string | undefined;

    for (let i = 0; i < subscriptCount; i++) {
        if (value === undefined || typeof value !== "object") {
            if (!canCreate) {
                return null;
            }

            value = {
                kind: MObjectKind.Array,
                value: value ?? "",
            };

            if (i > 0) {
                mArraySet(array!, subscriptKey!, value);
            } else {
                environment.set(name, value);
            }
        }

        subscriptKey = getSubscriptKey(state, i, subscripts, subscriptValues);

        if (!subscriptKey) {
            return;
        }

        array = value;
        value = mArrayGet(value, subscriptKey);
    }

    return {
        kind: MObjectKind.ArrayReference,
        array: array as MArray,
        key: subscriptKey as string,
    };
};

const getVariableReference = (
    node: VariableAstNode,
    state: InterpreterState,
    subscriptCount: number = node.subscripts.length,
    subscriptValues?: string[],
    canCreate: boolean = false,
): MReference | undefined => {
    const reference = getReference(
        node.name.text,
        state,
        subscriptCount,
        node.subscripts,
        subscriptValues,
        canCreate,
    );

    if (reference === null) {
        reportError("Variable does not exist", node, state);
        return;
    }

    return reference;
};

const getCallArgumentReference = (
    node: CallArgumentAstNode,
    state: InterpreterState,
): MValue | undefined => {
    if (node.kind === AstNodeKind.Reference) {
        const reference = getReference(node.name.text, state, 0);

        if (!reference) {
            reportError("Referenced variable does not exist", node, state);
            return;
        }

        return getReferenceValue(reference);
    }

    if (!interpretExpression(node, state)) {
        return;
    }

    return state.valueStack.pop()!;
};

const getReferenceValue = (reference: MReference): MValue => {
    switch (reference.kind) {
        case MObjectKind.ArrayReference:
            return mArrayGet(reference.array, reference.key) ?? "";
        case MObjectKind.EnvironmentReference:
            return (reference.environment.get(reference.name) ?? "") as MValue;
    }
};

const setReferenceValue = (reference: MReference, value: MValue) => {
    switch (reference.kind) {
        case MObjectKind.ArrayReference:
            return mArraySet(reference.array, reference.key, value);
        case MObjectKind.EnvironmentReference:
            return reference.environment.set(reference.name, value);
    }
};

const getSpecialVariable = (name: string, state: InterpreterState): MValue | undefined => {
    return state.environmentStack[0].get(name) as MValue | undefined;
};

const setSpecialVariable = (name: string, value: MValue, state: InterpreterState) => {
    state.environmentStack[0].set(name, value);
};

const setVariable = (node: VariableAstNode, value: MValue, state: InterpreterState): boolean => {
    const startReference = getVariableReference(node, state, undefined, undefined, true);

    if (!startReference) {
        return false;
    }

    setReferenceValue(startReference, value);
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
    const reference = getVariableReference(node, state);

    if (!reference) {
        return false;
    }

    const value = getReferenceValue(reference);
    state.valueStack.push(mValueToScalar(value));
    return true;
};

const interpretExtern = (
    node: CallAstNode,
    state: InterpreterState,
    extern: Extern,
    hasReturnValue: boolean,
): boolean => {
    const argValues = [];

    for (const arg of node.args) {
        const value = getCallArgumentReference(arg, state);

        if (value === undefined) {
            return false;
        }

        argValues.push(value);
    }

    const returnValue = extern(...argValues);

    if (hasReturnValue) {
        state.valueStack.push(returnValue ?? "");
    }

    return true;
};

const interpretCall = (
    node: CallAstNode,
    state: InterpreterState,
    hasReturnValue: boolean,
): boolean => {
    const tag = state.ast.tags.get(node.name.text);

    if (!tag) {
        const extern = state.externs.get(node.name.text);

        if (extern) {
            return interpretExtern(node, state, extern, hasReturnValue);
        } else {
            reportError(`Tag "${node.name.text}" not found`, node, state);
            return false;
        }
    }

    const callEnvironmentStackLength = state.environmentStack.length;

    if (tag.params) {
        const environment = new Map();
        state.environmentStack.push(environment);

        for (let i = 0; i < Math.min(tag.params.length, node.args.length); i++) {
            const arg = node.args[i];
            const value = getCallArgumentReference(arg, state);

            if (value === undefined) {
                return false;
            }

            environment.set(tag.params[i], value);
        }

        for (let i = node.args.length; i < tag.params.length; i++) {
            environment.set(tag.params[i], "");
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
        case BinaryOp.Power:
            value = Math.pow(mValueToNumber(left), mValueToNumber(right));
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
    let direction = 1;

    if (node.direction) {
        if (!interpretExpression(node.direction, state)) {
            return false;
        }

        direction = mValueToNumber(state.valueStack.pop()!);

        if (direction !== 1 && direction !== -1) {
            reportError(
                "Expected 1 or -1 for order builtin's direction argument",
                node.direction,
                state,
            );
            return false;
        }
    }

    const variable = node.variable;

    if (variable.subscripts.length === 0) {
        state.valueStack.push("");
        return true;
    }

    const lastSubscript = variable.subscripts.length - 1;
    const reference = getVariableReference(variable, state, lastSubscript);

    if (reference === undefined) {
        return false;
    }

    const value = getReferenceValue(reference);

    if (!interpretExpression(variable.subscripts[lastSubscript], state)) {
        return false;
    }

    const finalSubscriptKey = mValueToString(state.valueStack.pop()!);

    if (typeof value !== "object") {
        state.valueStack.push("");
        return true;
    }

    let nextKey;

    if (direction < 0) {
        nextKey = mArrayGetPreviousKey(value, finalSubscriptKey);
    } else {
        nextKey = mArrayGetNextKey(value, finalSubscriptKey);
    }

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
    if (node.extractionStart) {
        if (!interpretExpression(node.extractionStart, state)) {
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
    if (node.extractionEnd) {
        if (!interpretExpression(node.extractionEnd, state)) {
            return;
        }

        return mValueToNumber(state.valueStack.pop()!);
    }

    return start + 1;
};

const interpretExtractBuiltin = (node: ExtractBuiltinAstNode, state: InterpreterState): boolean => {
    if (!interpretExpression(node.target, state)) {
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

const interpretFindBuiltin = (node: FindBuiltinAstNode, state: InterpreterState): boolean => {
    if (!interpretExpression(node.haystack, state)) {
        return false;
    }

    const haystack = mValueToString(state.valueStack.pop()!);

    if (!interpretExpression(node.needle, state)) {
        return false;
    }

    const needle = mValueToString(state.valueStack.pop()!);

    let findStart = 0;

    if (node.findStart) {
        if (!interpretExpression(node.haystack, state)) {
            return false;
        }

        findStart = mValueToNumber(state.valueStack.pop()!);
        findStart = Math.max(findStart - 1, 0);
    }

    if (needle === "") {
        state.valueStack.push(1);
        return true;
    }

    let matchProgress = 0;

    for (let i = findStart; i < haystack.length; ) {
        if (haystack[i] !== needle[matchProgress]) {
            if (matchProgress > 0) {
                matchProgress = 0;
            } else {
                i++;
            }

            continue;
        }

        matchProgress++;
        i++;

        if (matchProgress >= needle.length) {
            state.valueStack.push(i + 1);
            return true;
        }
    }

    state.valueStack.push(0);
    return true;
};

const interpretRandomBuiltin = (node: RandomBuiltinAstNode, state: InterpreterState): boolean => {
    if (!interpretExpression(node.max, state)) {
        return false;
    }

    const max = Math.floor(mValueToNumber(state.valueStack.pop()!));
    const value = Math.floor(Math.random() * (max + 1));

    state.valueStack.push(value);

    return true;
};

const interpretAsciiBuiltin = (node: AsciiBuiltinAstNode, state: InterpreterState): boolean => {
    if (!interpretExpression(node.value, state)) {
        return false;
    }

    const string = mValueToString(state.valueStack.pop()!);
    const value = string.length > 0 ? string.charCodeAt(0) : -1;
    state.valueStack.push(value);

    return true;
};

const interpretCharBuiltin = (node: CharBuiltinAstNode, state: InterpreterState): boolean => {
    if (!interpretExpression(node.value, state)) {
        return false;
    }

    const value = mValueToNumber(state.valueStack.pop()!);
    state.valueStack.push(String.fromCharCode(value));

    return true;
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
        case AstNodeKind.FindBuiltin:
            return interpretFindBuiltin(node, state);
        case AstNodeKind.RandomBuiltin:
            return interpretRandomBuiltin(node, state);
        case AstNodeKind.AsciiBuiltin:
            return interpretAsciiBuiltin(node, state);
        case AstNodeKind.CharBuiltin:
            return interpretCharBuiltin(node, state);
    }

    return true;
};

const interpretWrite = (node: WriteAstNode, state: InterpreterState): CommandResult => {
    for (const arg of node.args) {
        switch (arg.kind) {
            case AstNodeKind.HashFormatter:
                state.output.length = 0;
                state.outputColumn = 0;
                break;
            case AstNodeKind.ExclamationPointFormatter:
                state.output.push("\n");
                state.outputColumn = 0;
                break;
            case AstNodeKind.QuestionMarkFormatter: {
                if (!interpretExpression(arg.minColumn, state)) {
                    return CommandResult.Halt;
                }

                const minColumn = Math.floor(mValueToNumber(state.valueStack.pop()!));

                if (state.outputColumn < minColumn) {
                    state.output.push(" ".repeat(minColumn - state.outputColumn));
                    state.outputColumn = minColumn;
                }

                break;
            }
            default: {
                if (!interpretExpression(arg, state)) {
                    return CommandResult.Halt;
                }

                const value = state.valueStack.pop()!.toString();

                state.output.push(value);
                state.outputColumn += value.length;
                break;
            }
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
            (incrementValue < 0 && variableValue < endValue) ||
            (incrementValue >= 0 && variableValue > endValue)
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
    if (node.target.kind !== AstNodeKind.Variable) {
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

    const variable = node.target;

    if (variable.kind !== AstNodeKind.Variable) {
        return CommandResult.Continue;
    }

    const reference = getVariableReference(variable, state, undefined, undefined, true);

    if (!reference) {
        return CommandResult.Halt;
    }

    const destination = mValueToString(getReferenceValue(reference));
    const newValue = replaceStringRange(destination, value, start, end);

    setReferenceValue(reference, newValue);

    return CommandResult.Continue;
};

const interpretSetArgument = (node: SetArgAstNode, state: InterpreterState): CommandResult => {
    if (!interpretExpression(node.value, state)) {
        return CommandResult.Halt;
    }

    const value = state.valueStack.pop()!;

    if (node.target.kind === AstNodeKind.ExtractBuiltin) {
        return interpretSetExtract(node.target, state, mValueToString(value));
    }

    if (!setVariable(node.target, value, state)) {
        return CommandResult.Halt;
    }

    return CommandResult.Continue;
};

const interpretSet = (node: SetAstNode, state: InterpreterState): CommandResult => {
    for (const arg of node.args) {
        const result = interpretSetArgument(arg, state);

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
        const reference = getReference(arg.name.text, state, arg.subscripts.length, arg.subscripts);

        if (reference === null) {
            continue;
        }

        if (!reference) {
            return CommandResult.Halt;
        }

        switch (reference.kind) {
            case MObjectKind.ArrayReference:
                mArrayKill(reference.array, reference.key);
                break;
            case MObjectKind.EnvironmentReference:
                reference.environment.delete(reference.name);
                break;
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

    const destinationReference = getVariableReference(
        node.left,
        state,
        leftSubscriptValues.length,
        leftSubscriptValues,
        true,
    );

    if (!destinationReference) {
        return CommandResult.Halt;
    }

    let destination = getReferenceValue(destinationReference);

    if (typeof destination !== "object") {
        destination = {
            kind: MObjectKind.Array,
            value: destination,
        };

        setReferenceValue(destinationReference, destination);
    }

    const sourceReference = getVariableReference(
        node.right,
        state,
        rightSubscriptValues.length,
        rightSubscriptValues,
    );

    if (!sourceReference) {
        return CommandResult.Halt;
    }

    const source = getReferenceValue(sourceReference);

    if (typeof source !== "object" || !source.children) {
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

const interpretTopLevel = (state: InterpreterState, start: number): CommandResult => {
    for (let i = start; i < state.ast.children.length; i++) {
        const result = interpretCommand(state.ast.children[i], state);

        if (result !== CommandResult.Continue) {
            return result;
        }
    }

    return CommandResult.Continue;
};

export const makeInterpreterState = (
    ast: TopLevelAstNode,
    externs: Map<string, Extern> = new Map(),
) => ({
    ast,
    externs,
    valueStack: [],
    environmentStack: [new Map()],
    outputColumn: 0,
    output: [],
    errors: [],
});

export const interpretTag = (
    tag: Tag | undefined,
    args: MValue[],
    state: InterpreterState,
): MValue | undefined => {
    const callEnvironmentStackLength = state.environmentStack.length;

    if (tag?.params) {
        const environment = new Map();
        state.environmentStack.push(environment);

        for (let i = 0; i < Math.min(tag.params.length, args.length); i++) {
            environment.set(tag.params[i], args[i]);
        }

        for (let i = args.length; i < tag.params.length; i++) {
            environment.set(tag.params[i], "");
        }
    }

    const callValueStackLength = state.valueStack.length;

    if (interpretTopLevel(state, tag?.index ?? 0) === CommandResult.Halt) {
        return;
    }

    state.environmentStack.length = callEnvironmentStackLength;

    if (state.valueStack.length === callValueStackLength) {
        return "";
    } else {
        return state.valueStack.pop();
    }
};

export const interpret = (ast: TopLevelAstNode, externs: Map<string, Extern> = new Map()) => {
    const state = makeInterpreterState(ast, externs);

    interpretTag(ast.tags.get("main"), [], state);

    return {
        output: state.output.join(""),
        errors: state.errors,
    };
};
