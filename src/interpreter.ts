import { MError } from "./mError.js";
import { Token, TokenKind } from "./tokenizer.js";

// TODO: Most important/unique things to interpret right now:
// if: controls the whole rest of the line like for,
// unary/binary ops: simple precedence (unary ops before binary ops, left to right),
// negation of operators: '< means >=,
// builtins like $O: $O(array("subscript")),
// function calls and subroutine do calls: mostly just useful to make more useful examples when we start interpreting code,

type MValue = string | number;

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
    // TODO: Add stack info used for quitting out of blocks and tags.
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

const interpretExpression = (input: Token[][], state: InterpreterState): MValue | undefined => {
    const token = getToken(input, state);

    let value: MValue;

    switch (token.kind) {
        case TokenKind.String:
            value = token.value;
            break;
        case TokenKind.Number:
            value = token.value;
            break;
        case TokenKind.Identifier:
            value = token.text;
            break;
        default:
            reportError("Expected an expression", state);
            return;
    }

    nextToken(input, state);

    return value;
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
    // TODO: Support formatting with #, ?, and !.

    if (getWhitespace(input, state)) {
        return true;
    }

    while (true) {
        const expression = interpretExpression(input, state);

        if (!expression) {
            break;
        }

        // TODO: This isn't how printing should be handled, output should be a string
        // that goes to an output element instead of the console. Also, expression values
        // should be printed in a way that matches M. Also, there should be no implicit newline.
        console.log(expression);

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

    // TODO: Actually do the quitting part of quit.

    return interpretExpression(input, state) !== undefined;
};

const interpretDoBlockBody = (input: Token[][], state: InterpreterState): boolean => {
    if (!getWhitespace(input, state)) {
        // TODO: If there are arguments the "do" command should not be interpreted as a block in the first place.
        reportError("Expected no arguments for do block", state);
        return false;
    }

    const startLine = state.position.line;
    const startColumn = state.position.column;

    state.indentationLevel++;
    const blockResult = interpretBlock(input, state, true);
    state.indentationLevel--;

    if (blockResult == CommandResult.Halt) {
        return false;
    }

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
            // TODO:
            result = interpretQuitBody(input, state) ? CommandResult.Quit : CommandResult.Halt;
            break;
        case "d":
        case "do":
            // TODO: This could also be a subroutine call instead of a block.
            result = interpretDoBlockBody(input, state)
                ? CommandResult.Continue
                : CommandResult.Halt;
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

export const interpret = (input: Token[][]) => {
    const state = {
        position: makeInterpreterPosition(),
        indentationLevel: 0,
        tags: new Map(),
        errors: [],
    };

    while (state.position.line < input.length) {
        const firstToken = getToken(input, state);

        if (firstToken.kind === TokenKind.Identifier) {
            const line = state.position.line;
            const name = firstToken.text;

            nextToken(input, state);

            const params: string[] = [];
            const result = interpretTag(input, state, params);

            if (result == TagResult.Halt) {
                return {
                    errors: state.errors,
                };
            }

            const paramDebugText = result == TagResult.Params ? `(${params})` : ": No params";

            console.log(`Found tag @ ${line}: ${name}${paramDebugText}`);

            // TODO: What should happen when multiple tags have the same name? Error?
            state.tags.set(name, {
                line,
                params,
            });
        }

        moveToNextUninterpretedLine(state);
    }

    state.position = makeInterpreterPosition();
    jumpToLine(state.tags.get("main").line, state);

    while (state.position.line < input.length) {
        const firstToken = getToken(input, state);

        if (firstToken.kind === TokenKind.Identifier) {
            nextToken(input, state);

            if (interpretTag(input, state) == TagResult.Halt) {
                break;
            }
        }

        const result = interpretBlock(input, state, false);

        // TODO: Quit should return to the last call site if there is one.
        if (result == CommandResult.Halt || result == CommandResult.Quit) {
            break;
        }
    }

    return {
        errors: state.errors,
    };
};
