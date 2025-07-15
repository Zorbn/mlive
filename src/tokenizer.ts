import { MSyntaxError } from "./mSyntaxError.js";

export const enum TokenKind {
    // No leading whitespace on a line indicates the first identifier is a tag name.
    LeadingWhitespace,
    TrailingWhitespace,
    Space,
    Identifier,
    Number,
    String,
    LeftParen,
    RightParen,
    Comma,
    Caret,
    Dollar,
    Hash,
    Dot,
}

export interface BasicToken {
    kind:
        | TokenKind.LeadingWhitespace
        | TokenKind.TrailingWhitespace
        | TokenKind.Space
        | TokenKind.LeftParen
        | TokenKind.RightParen
        | TokenKind.Comma
        | TokenKind.Caret
        | TokenKind.Dollar
        | TokenKind.Hash
        | TokenKind.Dot;
}

export interface IdentifierToken {
    kind: TokenKind.Identifier;
    text: string;
}

interface NumberToken {
    kind: TokenKind.Number;
    value: number;
}

interface StringToken {
    kind: TokenKind.String;
    value: string;
}

export type Token = BasicToken | IdentifierToken | NumberToken | StringToken;

const isWhitespace = (char: string) => /\s/.test(char);

const isAlphabetic = (char: string) => {
    const charCode = char.charCodeAt(0);

    return (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122);
};

const isDigit = (char: string) => {
    const charCode = char.charCodeAt(0);

    return charCode >= 48 && charCode <= 57;
};

const tokenizeLine = (input: string, y: number, errors: MSyntaxError[]): Token[] => {
    input = input.trimEnd();

    const tokens: Token[] = [];

    let x = 0;

    for (; x < input.length, isWhitespace(input[x]); x++);

    if (x > 0) {
        tokens.push({
            kind: TokenKind.LeadingWhitespace,
        });
    }

    while (x < input.length) {
        const firstChar = input[x];

        if (isAlphabetic(firstChar)) {
            const start = x;

            x++;

            while (x < input.length && isAlphabetic(input[x])) {
                x++;
            }

            tokens.push({
                kind: TokenKind.Identifier,
                text: input.slice(start, x),
            });

            continue;
        }

        if (isDigit(firstChar)) {
            const start = x;

            x++;

            // TODO: Handle decimals.
            while (x < input.length && isDigit(input[x])) {
                x++;
            }

            tokens.push({
                kind: TokenKind.Number,
                value: Number.parseInt(input.slice(start, x)),
            });

            continue;
        }

        switch (firstChar) {
            case '"': {
                const start = x;

                x++;

                // TODO: Handle "" for a literal quote.
                while (x < input.length && input[x] !== '"') {
                    x++;
                }

                tokens.push({
                    kind: TokenKind.String,
                    value: input.slice(start + 1, x),
                });

                x++;

                continue;
            }
            case " ":
                tokens.push({
                    kind: TokenKind.Space,
                });
                break;
            case "(":
                tokens.push({
                    kind: TokenKind.LeftParen,
                });
                break;
            case ")":
                tokens.push({
                    kind: TokenKind.RightParen,
                });
                break;
            case ",":
                tokens.push({
                    kind: TokenKind.Comma,
                });
                break;
            case "^":
                tokens.push({
                    kind: TokenKind.Caret,
                });
                break;
            case "$":
                tokens.push({
                    kind: TokenKind.Dollar,
                });
                break;
            case "#":
                tokens.push({
                    kind: TokenKind.Hash,
                });
                break;
            case ".":
                tokens.push({
                    kind: TokenKind.Dot,
                });
                break;
            default:
                errors.push({
                    message: `Unexpected character ${firstChar}`,
                    line: y,
                    column: x,
                });
                break;
        }

        x++;
    }

    tokens.push({
        kind: TokenKind.TrailingWhitespace,
    });

    return tokens;
};

export const tokenize = (input: string) => {
    const errors: MSyntaxError[] = [];
    const lines = input.split(/\r?\n/);
    const tokenizedLines = [];

    for (let y = 0; y < lines.length; y++) {
        const tokenizedLine = tokenizeLine(lines[y], y, errors);
        tokenizedLines.push(tokenizedLine);
    }

    return {
        tokenizedLines,
        errors,
    };
};
