import { MSyntaxError } from "./mSyntaxError.js";
import { Token, TokenKind } from "./tokenizer.js";

// TODO: Most important/unique things to interpret right now:
// if: controls the whole rest of the line like for,
// unary/binary ops: simple precedence (unary ops before binary ops, left to right),
// negation of operators: '< means >=,
// builtins like $O: $O(array("subscript")),
// function calls and subroutine do calls: mostly just useful to make more useful examples when we start interpreting code,

type MValue = string | number;

interface InterpreterPosition {
    line: number;
    column: number;
    nextUninterpretedLine: number;
}

const moveToNextUninterpretedLine = (position: InterpreterPosition) => {
    position.column = 0;
    position.line = position.nextUninterpretedLine;
    position.nextUninterpretedLine += 1;
};

const getToken = (input: Token[][], position: InterpreterPosition) =>
    input[position.line][position.column];

const nextToken = (input: Token[][], position: InterpreterPosition) => {
    const token = getToken(input, position);

    if (token.kind !== TokenKind.TrailingWhitespace) {
        position.column += 1;
    }

    return token;
};

const matchToken = <K extends TokenKind, T extends Token & { kind: K }>(
    input: Token[][],
    position: InterpreterPosition,
    validKind: K,
): T | undefined => {
    const token = getToken(input, position);

    if (token.kind !== validKind) {
        return;
    }

    return nextToken(input, position) as T;
};

const matchWhitespace = (input: Token[][], position: InterpreterPosition): boolean => {
    if (!getWhitespace(input, position)) {
        return false;
    }

    nextToken(input, position);

    return true;
};

const getWhitespace = (input: Token[][], position: InterpreterPosition): boolean => {
    const token = getToken(input, position);

    return (
        token.kind === TokenKind.Space ||
        token.kind === TokenKind.TrailingWhitespace ||
        token.kind === TokenKind.LeadingWhitespace
    );
};

const reportError = (errors: MSyntaxError[], message: string, position: InterpreterPosition) => {
    console.log(message, position);
    errors.push({
        message,
        line: position.line,
        // TODO: The column here is actually the index of the token. We should store the real column of each token so it can be reported here.
        column: position.column,
    });
};

const interpretExpression = (
    input: Token[][],
    position: InterpreterPosition,
    errors: MSyntaxError[],
): MValue | undefined => {
    const token = getToken(input, position);

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
            reportError(errors, "Expected an expression", position);
            return;
    }

    nextToken(input, position);

    return value;
};

const interpretBlock = (
    input: Token[][],
    position: InterpreterPosition,
    errors: MSyntaxError[],
    // The number of dots before each line (in addition to leading whitespace).
    indentationLevel: number,
    startOnNextLine: boolean,
): boolean => {
    while (true) {
        while (
            position.line < input.length &&
            (startOnNextLine || getToken(input, position).kind === TokenKind.TrailingWhitespace)
        ) {
            moveToNextUninterpretedLine(position);
            startOnNextLine = false;

            if (position.line >= input.length) {
                return true;
            }

            const startColumn = position.column;

            let didBlockEnd = !matchToken(input, position, TokenKind.LeadingWhitespace);

            if (!didBlockEnd) {
                for (let i = 0; i < indentationLevel; i++) {
                    if (!matchToken(input, position, TokenKind.Dot)) {
                        didBlockEnd = true;
                        break;
                    }

                    if (!matchToken(input, position, TokenKind.Space)) {
                        reportError(errors, "Expected space after dot", position);
                        return false;
                    }
                }
            }

            if (didBlockEnd) {
                position.column = startColumn;
                return true;
            }
        }

        if (!interpretCommand(input, position, errors, indentationLevel)) {
            return false;
        }
    }
};

const interpretWriteBody = (
    input: Token[][],
    position: InterpreterPosition,
    errors: MSyntaxError[],
): boolean => {
    // TODO: Support formatting with #, ?, and !.

    if (getWhitespace(input, position)) {
        return true;
    }

    while (true) {
        const expression = interpretExpression(input, position, errors);

        if (!expression) {
            break;
        }

        // TODO: This isn't how printing should be handled, output should be a string
        // that goes to an output element instead of the console. Also, expression values
        // should be printed in a way that matches M. Also, there should be no implicit newline.
        console.log(expression);

        if (!matchToken(input, position, TokenKind.Comma)) {
            break;
        }
    }

    return true;
};

const interpretQuitBody = (
    input: Token[][],
    position: InterpreterPosition,
    errors: MSyntaxError[],
): MValue | null | undefined => {
    if (getWhitespace(input, position)) {
        return null;
    }

    // TODO: Actually do the quitting part of quit.

    return interpretExpression(input, position, errors);
};

const interpretDoBlockBody = (
    input: Token[][],
    position: InterpreterPosition,
    errors: MSyntaxError[],
    indentationLevel: number,
): boolean => {
    if (!getWhitespace(input, position)) {
        // TODO: If there are arguments the "do" command should not be interpreted as a block in the first place.
        reportError(errors, "Expected no arguments for do block", position);
        return false;
    }

    const startLine = position.line;
    const startColumn = position.column;

    if (!interpretBlock(input, position, errors, indentationLevel + 1, true)) {
        return false;
    }

    position.nextUninterpretedLine = position.line;
    position.line = startLine;
    position.column = startColumn;

    return true;
};

const interpretCommand = (
    input: Token[][],
    position: InterpreterPosition,
    errors: MSyntaxError[],
    indentationLevel: number,
): boolean => {
    let nameToken = matchToken(input, position, TokenKind.Identifier);

    if (!nameToken) {
        reportError(errors, "Expected command name", position);
        return false;
    }

    if (!matchWhitespace(input, position)) {
        reportError(errors, "Expected space between command and arguments", position);
    }

    let result: boolean;

    // TODO: Turn this into a map lookup to get the function to call. The current way results in lots of string cmps.
    switch (nameToken.text.toLowerCase()) {
        case "w":
        case "write":
            result = interpretWriteBody(input, position, errors);
            break;
        case "q":
        case "quit":
            // TODO:
            result = interpretQuitBody(input, position, errors) !== undefined;
            break;
        case "d":
        case "do":
            // TODO: This could also be a subroutine call instead of a block.
            result = interpretDoBlockBody(input, position, errors, indentationLevel);
            break;
        default:
            reportError(errors, "Unrecognized command name", position);
            return false;
    }

    if (!result) {
        return false;
    }

    if (!matchWhitespace(input, position)) {
        reportError(errors, "Expected space between arguments and next commands", position);
        return false;
    }

    return true;
};

const interpretTag = (
    input: Token[][],
    position: InterpreterPosition,
    errors: MSyntaxError[],
): string[] | null | undefined => {
    let name = "";
    let params: string[] | null = null;

    const firstToken = getToken(input, position);

    if (firstToken.kind === TokenKind.Identifier) {
        name = firstToken.text;
        nextToken(input, position);

        if (getToken(input, position).kind === TokenKind.LeftParen) {
            nextToken(input, position);

            params = [];

            for (let i = 0; ; i++) {
                let paramToken = matchToken(input, position, TokenKind.Identifier);

                if (!paramToken) {
                    if (i > 0) {
                        reportError(errors, "Expected parameter name", position);
                    }

                    break;
                }

                params.push(paramToken.text);

                if (nextToken(input, position).kind !== TokenKind.Comma) {
                    break;
                }
            }

            if (!matchToken(input, position, TokenKind.RightParen)) {
                reportError(errors, "Unterminated parameter list", position);
            }
        }
    }

    if (!matchWhitespace(input, position)) {
        reportError(errors, "Expected space after tag name", position);
        return;
    }

    if (!interpretBlock(input, position, errors, 0, false)) {
        return undefined;
    }

    return params;
};

export const interpret = (input: Token[][]) => {
    // TODO: First do a pass to collect the tags that are available to be called.
    const errors: MSyntaxError[] = [];
    const position = { line: 0, column: 0, nextUninterpretedLine: 1 };

    while (position.line < input.length) {
        const tag = interpretTag(input, position, errors);

        if (tag === undefined) {
            break;
        }
    }

    return {
        errors,
    };
};
