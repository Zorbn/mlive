import { MError } from "./mError.js";
import { TextRange } from "./textRange.js";

export const enum TokenKind {
    // No leading whitespace on a line indicates the first identifier is a tag name.
    LeadingWhitespace,
    TrailingWhitespace,
    Space,
    // Comments must start in positions where a command could appear.
    Comment,
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
    Plus,
    Minus,
    Asterisk,
    ForwardSlash,
    Underscore,
    ExclamationPoint,
    Ampersand,
    Equals,
    LessThan,
    GreaterThan,
    SingleQuote,
    Colon,
}

interface BasicToken extends TextRange {
    kind:
        | TokenKind.LeadingWhitespace
        | TokenKind.TrailingWhitespace
        | TokenKind.Space
        | TokenKind.Comment
        | TokenKind.LeftParen
        | TokenKind.RightParen
        | TokenKind.Comma
        | TokenKind.Caret
        | TokenKind.Dollar
        | TokenKind.Hash
        | TokenKind.Dot
        | TokenKind.Plus
        | TokenKind.Minus
        | TokenKind.Asterisk
        | TokenKind.ForwardSlash
        | TokenKind.Underscore
        | TokenKind.ExclamationPoint
        | TokenKind.Ampersand
        | TokenKind.Equals
        | TokenKind.LessThan
        | TokenKind.GreaterThan
        | TokenKind.SingleQuote
        | TokenKind.Colon;
}

export interface IdentifierToken extends TextRange {
    kind: TokenKind.Identifier;
    text: string;
}

interface NumberToken extends TextRange {
    kind: TokenKind.Number;
    value: number;
}

interface StringToken extends TextRange {
    kind: TokenKind.String;
    value: string;
}

export type Token = BasicToken | IdentifierToken | NumberToken | StringToken;

const isWhitespace = (char: string) => /\s/.test(char);

const isAlphabetic = (char: string) => {
    const charCode = char.charCodeAt(0);

    return (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122);
};

const isAlphaNumeric = (char: string) => {
    const charCode = char.charCodeAt(0);

    return (
        (charCode >= 65 && charCode <= 90) ||
        (charCode >= 97 && charCode <= 122) ||
        (charCode >= 48 && charCode <= 57)
    );
};

const isDigit = (char: string) => {
    const charCode = char.charCodeAt(0);

    return charCode >= 48 && charCode <= 57;
};

const tokenizeLine = (line: string, y: number, errors: MError[]): Token[] => {
    line = line.trimEnd();

    const tokens: Token[] = [];

    let x = 0;

    for (; x < line.length, isWhitespace(line[x]); x++);

    if (x > 0) {
        tokens.push({
            kind: TokenKind.LeadingWhitespace,
            start: {
                line: y,
                column: 0,
            },
            end: {
                line: y,
                column: x,
            },
        });
    }

    while (x < line.length) {
        const firstChar = line[x];

        if (firstChar === ";") {
            tokens.push({
                kind: TokenKind.Comment,
                start: {
                    line: y,
                    column: x,
                },
                end: {
                    line: y,
                    column: line.length,
                },
            });
            break;
        }

        if (isAlphabetic(firstChar)) {
            const start = x;

            x++;

            while (x < line.length && isAlphaNumeric(line[x])) {
                x++;
            }

            tokens.push({
                kind: TokenKind.Identifier,
                text: line.slice(start, x),
                start: {
                    line: y,
                    column: start,
                },
                end: {
                    line: y,
                    column: x,
                },
            });

            continue;
        }

        if (isDigit(firstChar)) {
            const start = x;
            let hasDot = false;

            x++;

            while (x < line.length && (isDigit(line[x]) || (!hasDot && line[x] === "."))) {
                hasDot = hasDot || line[x] === ".";
                x++;
            }

            tokens.push({
                kind: TokenKind.Number,
                value: Number.parseFloat(line.slice(start, x)),
                start: {
                    line: y,
                    column: start,
                },
                end: {
                    line: y,
                    column: x,
                },
            });

            continue;
        }

        let kind: TokenKind;

        switch (firstChar) {
            case '"': {
                const start = x;
                const chars = [];

                x++;

                while (true) {
                    if (x > line.length) {
                        errors.push({
                            message: "Unterminated string",
                            line: y,
                            column: x,
                        });
                        break;
                    }

                    if (line[x] !== '"') {
                        chars.push(line[x]);
                        x++;
                        continue;
                    }

                    if (x + 1 >= line.length || line[x + 1] !== '"') {
                        break;
                    }

                    chars.push('"');
                    x += 2;
                }

                x++;

                tokens.push({
                    kind: TokenKind.String,
                    value: chars.join(""),
                    start: {
                        line: y,
                        column: start,
                    },
                    end: {
                        line: y,
                        column: x,
                    },
                });

                continue;
            }
            case " ":
                kind = TokenKind.Space;
                break;
            case "(":
                kind = TokenKind.LeftParen;
                break;
            case ")":
                kind = TokenKind.RightParen;
                break;
            case ",":
                kind = TokenKind.Comma;
                break;
            case "^":
                kind = TokenKind.Caret;
                break;
            case "$":
                kind = TokenKind.Dollar;
                break;
            case "#":
                kind = TokenKind.Hash;
                break;
            case ".":
                kind = TokenKind.Dot;
                break;
            case "+":
                kind = TokenKind.Plus;
                break;
            case "-":
                kind = TokenKind.Minus;
                break;
            case "*":
                kind = TokenKind.Asterisk;
                break;
            case "/":
                kind = TokenKind.ForwardSlash;
                break;
            case "_":
                kind = TokenKind.Underscore;
                break;
            case "!":
                kind = TokenKind.ExclamationPoint;
                break;
            case "&":
                kind = TokenKind.Ampersand;
                break;
            case "=":
                kind = TokenKind.Equals;
                break;
            case "<":
                kind = TokenKind.LessThan;
                break;
            case ">":
                kind = TokenKind.GreaterThan;
                break;
            case "'":
                kind = TokenKind.SingleQuote;
                break;
            case ":":
                kind = TokenKind.Colon;
                break;
            default:
                errors.push({
                    message: `Unexpected character ${firstChar}`,
                    line: y,
                    column: x,
                });

                x++;
                continue;
        }

        tokens.push({
            kind,
            start: {
                line: y,
                column: x,
            },
            end: {
                line: y,
                column: x + 1,
            },
        });

        x++;
    }

    tokens.push({
        kind: TokenKind.TrailingWhitespace,
        start: {
            line: y,
            column: x,
        },
        end: {
            line: y,
            column: x + 1,
        },
    });

    return tokens;
};

export const tokenize = (code: string) => {
    const errors: MError[] = [];
    const lines = code.split(/\r?\n/);
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
