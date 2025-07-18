import { MError } from "./mError.js";
import { Token, TokenKind } from "./tokenizer.js";

// TODO: Most important/unique things to interpret right now:
// if: controls the whole rest of the line like for,
// unary/binary ops: simple precedence (unary ops before binary ops, left to right),
// negation of operators: '< means >=,
// builtins like $O: $O(array("subscript")),

type MValue = string | number;

const mValueToNumber = (value: MValue): number => {
    if (typeof value === "string") {
        // TODO: Implement accurate conversion.
        return parseFloat(value);
    }

    return value;
};

interface Tag {
    line: number;
    params: string[];
}

interface InterpreterPosition {
    line: number;
    column: number;
    nextUninterpretedLine: number;
}

interface InterpreterState {
    position: InterpreterPosition;
    // The number of dots before each line (in addition to leading whitespace).
    indentationLevel: number;
    tags: Map<string, Tag>;
    valueStack: MValue[];
    environmentStack: Map<string, MValue>[];
    output: string[];
    errors: MError[];
}

const makeInterpreterPosition = (): InterpreterPosition => ({
    line: 0,
    column: 0,
    nextUninterpretedLine: 1,
});

const enum CommandResult {
    Continue,
    Quit,
    Halt,
}

const enum TagResult {
    NoParams,
    Params,
    Halt,
}

const moveToNextUninterpretedLine = (state: InterpreterState) => {
    jumpToLine(state.position.nextUninterpretedLine, state);
};

const jumpToLine = (line: number, state: InterpreterState) => {
    state.position.column = 0;
    state.position.line = line;
    state.position.nextUninterpretedLine = line + 1;
};

const lookupVariable = (name: string, state: InterpreterState): MValue => {
    for (let i = state.environmentStack.length - 1; i >= 0; i--) {
        const value = state.environmentStack[i].get(name);

        if (value !== undefined) {
            return value;
        }
    }

    return "";
};

const getToken = (input: Token[][], state: InterpreterState) =>
    input[state.position.line][state.position.column];

const nextToken = (input: Token[][], state: InterpreterState) => {
    const token = getToken(input, state);

    if (token.kind !== TokenKind.TrailingWhitespace) {
        state.position.column += 1;
    }

    return token;
};

const matchToken = <K extends TokenKind, T extends Token & { kind: K }>(
    input: Token[][],
    state: InterpreterState,
    validKind: K,
): T | undefined => {
    const token = getToken(input, state);

    if (token.kind !== validKind) {
        return;
    }

    return nextToken(input, state) as T;
};

const matchWhitespace = (input: Token[][], state: InterpreterState): boolean => {
    if (!getWhitespace(input, state)) {
        return false;
    }

    nextToken(input, state);

    return true;
};

const getWhitespace = (input: Token[][], state: InterpreterState): boolean => {
    const token = getToken(input, state);

    return (
        token.kind === TokenKind.Space ||
        token.kind === TokenKind.TrailingWhitespace ||
        token.kind === TokenKind.LeadingWhitespace
    );
};

const reportError = (message: string, state: InterpreterState) => {
    console.log(message, state);
    state.errors.push({
        message,
        line: state.position.line,
        // TODO: The column here is actually the index of the token. We should store the real column of each token so it can be reported here.
        column: state.position.column,
    });
};

const interpretCall = (
    input: Token[][],
    state: InterpreterState,
    hasReturnValue: boolean,
): boolean => {
    const nameToken = getToken(input, state);

    if (nameToken.kind != TokenKind.Identifier) {
        reportError("Expected an identifier", state);
        return false;
    }

    nextToken(input, state);

    const tag = state.tags.get(nameToken.text);

    if (tag === undefined) {
        reportError(`Tag \"${nameToken.text}\" not found`, state);
        return false;
    }

    let didPushEnvironment = false;

    if (matchToken(input, state, TokenKind.LeftParen)) {
        for (let i = 0; getToken(input, state).kind !== TokenKind.RightParen; i++) {
            if (!interpretExpression(input, state)) {
                break;
            }

            if (i < tag.params.length) {
                if (!didPushEnvironment) {
                    state.environmentStack.push(new Map());
                    didPushEnvironment = true;
                }

                state.environmentStack[state.environmentStack.length - 1].set(
                    tag.params[i],
                    state.valueStack.pop()!,
                );
            }

            if (!matchToken(input, state, TokenKind.Comma)) {
                break;
            }
        }

        if (!matchToken(input, state, TokenKind.RightParen)) {
            reportError("Unterminated argument list", state);
            return false;
        }
    }

    const callPosition = {
        line: state.position.line,
        column: state.position.column,
        nextUninterpretedLine: state.position.nextUninterpretedLine,
    };
    const callEnvironmentStackLength = state.environmentStack.length;
    const callValueStackLength = state.valueStack.length;

    jumpToLine(tag.line, state);
    interpretTopLevel(input, state);

    if (hasReturnValue) {
        if (state.valueStack.length === callValueStackLength) {
            state.valueStack.push("");
        }
    } else {
        state.valueStack.length = callValueStackLength;
    }

    state.environmentStack.length = callEnvironmentStackLength;
    state.position = callPosition;

    return true;
};

const interpretPrimary = (input: Token[][], state: InterpreterState): boolean => {
    const firstToken = getToken(input, state);

    if (firstToken.kind == TokenKind.Dollar) {
        nextToken(input, state);

        if (!matchToken(input, state, TokenKind.Dollar)) {
            reportError("Builtins are not supported yet", state);
            return false;
        }

        return interpretCall(input, state, true);
    }

    switch (firstToken.kind) {
        case TokenKind.String:
            state.valueStack.push(firstToken.value);
            break;
        case TokenKind.Number:
            state.valueStack.push(firstToken.value);
            break;
        case TokenKind.Identifier:
            const value = lookupVariable(firstToken.text, state);
            state.valueStack.push(value);
            break;
        default:
            reportError("Expected an expression", state);
            return false;
    }

    nextToken(input, state);

    return true;
};

const interpretExpression = (input: Token[][], state: InterpreterState): boolean => {
    if (!interpretPrimary(input, state)) {
        return false;
    }

    while (true) {
        const token = getToken(input, state);
        let isBinaryOp = true;

        switch (token.kind) {
            case TokenKind.Plus:
            case TokenKind.Minus:
                break;
            default:
                isBinaryOp = false;
                break;
        }

        if (!isBinaryOp) {
            break;
        }

        nextToken(input, state);

        if (!interpretPrimary(input, state)) {
            return false;
        }

        const right = state.valueStack.pop()!;
        const left = state.valueStack.pop()!;

        switch (token.kind) {
            case TokenKind.Plus:
                state.valueStack.push(mValueToNumber(left) + mValueToNumber(right));
                break;
            case TokenKind.Minus:
                state.valueStack.push(mValueToNumber(left) - mValueToNumber(right));
                break;
            default:
                reportError("Unimplemented binary op", state);
                break;
        }
    }

    return true;
};

const interpretBlock = (
    input: Token[][],
    state: InterpreterState,
    startOnNextLine: boolean,
): CommandResult => {
    let isQuittingBlock = false;

    while (true) {
        while (
            state.position.line < input.length &&
            (startOnNextLine ||
                isQuittingBlock ||
                getToken(input, state).kind === TokenKind.TrailingWhitespace)
        ) {
            moveToNextUninterpretedLine(state);
            startOnNextLine = false;

            if (state.position.line >= input.length) {
                return CommandResult.Continue;
            }

            const startColumn = state.position.column;

            let didBlockEnd = !matchToken(input, state, TokenKind.LeadingWhitespace);

            if (!didBlockEnd) {
                for (let i = 0; i < state.indentationLevel; i++) {
                    if (!matchToken(input, state, TokenKind.Dot)) {
                        didBlockEnd = true;
                        break;
                    }

                    if (!matchToken(input, state, TokenKind.Space)) {
                        reportError("Expected space after dot", state);
                        return CommandResult.Halt;
                    }
                }
            }

            if (didBlockEnd) {
                state.position.column = startColumn;
                return CommandResult.Continue;
            }
        }

        const result = interpretCommand(input, state);

        switch (result) {
            case CommandResult.Quit:
                if (state.indentationLevel > 0) {
                    isQuittingBlock = true;
                } else {
                    return result;
                }

                break;
            case CommandResult.Halt:
                return result;
        }
    }
};

const interpretWriteBody = (input: Token[][], state: InterpreterState): boolean => {
    // TODO: Support formatting with ?.

    while (!matchWhitespace(input, state)) {
        const token = getToken(input, state);

        switch (token.kind) {
            case TokenKind.Hash:
                nextToken(input, state);
                state.output.length = 0;
                break;
            case TokenKind.ExclamationPoint:
                nextToken(input, state);
                state.output.push("\n");
                break;
            default:
                if (!interpretExpression(input, state)) {
                    return false;
                }

                state.output.push(state.valueStack.pop()!.toString());
                break;
        }

        if (!matchToken(input, state, TokenKind.Comma)) {
            break;
        }
    }

    return true;
};

const interpretQuitBody = (input: Token[][], state: InterpreterState): boolean => {
    if (getWhitespace(input, state)) {
        return true;
    }

    return interpretExpression(input, state);
};

const interpretDoBody = (input: Token[][], state: InterpreterState): boolean => {
    if (!getWhitespace(input, state)) {
        return interpretCall(input, state, true);
    }

    const startLine = state.position.line;
    const startColumn = state.position.column;
    const startEnvironmentStackLength = state.environmentStack.length;

    state.indentationLevel++;
    const blockResult = interpretBlock(input, state, true);
    state.indentationLevel--;

    if (blockResult == CommandResult.Halt) {
        return false;
    }

    state.environmentStack.length = startEnvironmentStackLength;
    state.position.nextUninterpretedLine = state.position.line;
    state.position.line = startLine;
    state.position.column = startColumn;

    return true;
};

const interpretCommand = (input: Token[][], state: InterpreterState): CommandResult => {
    let nameToken = matchToken(input, state, TokenKind.Identifier);

    if (!nameToken) {
        reportError("Expected command name", state);
        return CommandResult.Halt;
    }

    if (!matchWhitespace(input, state)) {
        reportError("Expected space between command and arguments", state);
        return CommandResult.Halt;
    }

    let result: CommandResult;

    // TODO: Turn this into a map lookup to get the function to call. The current way results in lots of string cmps.
    switch (nameToken.text.toLowerCase()) {
        case "w":
        case "write":
            result = interpretWriteBody(input, state) ? CommandResult.Continue : CommandResult.Halt;
            break;
        case "q":
        case "quit":
            result = interpretQuitBody(input, state) ? CommandResult.Quit : CommandResult.Halt;
            break;
        case "d":
        case "do":
            result = interpretDoBody(input, state) ? CommandResult.Continue : CommandResult.Halt;
            break;
        default:
            reportError("Unrecognized command name", state);
            result = CommandResult.Halt;
            break;
    }

    if (result === CommandResult.Halt) {
        return result;
    }

    if (!matchWhitespace(input, state)) {
        reportError("Expected space between arguments and next commands", state);
        return CommandResult.Halt;
    }

    return result;
};

const interpretTag = (input: Token[][], state: InterpreterState, params?: string[]): TagResult => {
    let result = TagResult.NoParams;

    if (getToken(input, state).kind === TokenKind.LeftParen) {
        nextToken(input, state);

        result = TagResult.Params;

        for (let i = 0; ; i++) {
            let paramToken = matchToken(input, state, TokenKind.Identifier);

            if (!paramToken) {
                if (i > 0) {
                    reportError("Expected parameter name", state);
                }

                break;
            }

            if (params) {
                params.push(paramToken.text);
            }

            if (!matchToken(input, state, TokenKind.Comma)) {
                break;
            }
        }

        if (!matchToken(input, state, TokenKind.RightParen)) {
            reportError("Unterminated parameter list", state);
            return TagResult.Halt;
        }
    }

    if (!matchWhitespace(input, state)) {
        reportError("Expected space after tag name", state);
        return TagResult.Halt;
    }

    return result;
};

const interpretTopLevel = (input: Token[][], state: InterpreterState) => {
    while (state.position.line < input.length) {
        const firstToken = getToken(input, state);

        if (firstToken.kind === TokenKind.Identifier) {
            nextToken(input, state);

            if (interpretTag(input, state) == TagResult.Halt) {
                break;
            }
        }

        const result = interpretBlock(input, state, false);

        if (result == CommandResult.Quit || result == CommandResult.Halt) {
            break;
        }
    }
};

export const interpret = (input: Token[][]) => {
    const state = {
        position: makeInterpreterPosition(),
        indentationLevel: 0,
        tags: new Map(),
        valueStack: [],
        environmentStack: [],
        output: [],
        errors: [],
    };

    while (state.position.line < input.length) {
        const firstToken = getToken(input, state);

        if (firstToken.kind === TokenKind.Identifier && !state.tags.has(firstToken.text)) {
            const line = state.position.line;

            nextToken(input, state);

            const params: string[] = [];
            const result = interpretTag(input, state, params);

            if (result == TagResult.Halt) {
                return {
                    output: "",
                    errors: state.errors,
                };
            }

            const paramDebugText = result == TagResult.Params ? `(${params})` : ": No params";

            console.log(`Found tag @ ${line}: ${firstToken.text}${paramDebugText}`);

            state.tags.set(firstToken.text, {
                line,
                params,
            });
        }

        moveToNextUninterpretedLine(state);
    }

    state.position = makeInterpreterPosition();
    jumpToLine(state.tags.get("main").line, state);

    interpretTopLevel(input, state);

    return {
        output: state.output.join(""),
        errors: state.errors,
    };
};
