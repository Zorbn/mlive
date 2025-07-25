import { MError } from "./mError.js";

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

interface BasicToken {
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

interface IdentifierToken {
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
        });
    }

    while (x < line.length) {
        const firstChar = line[x];

        if (firstChar === ";") {
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
            });

            continue;
        }

        switch (firstChar) {
            case '"': {
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

                tokens.push({
                    kind: TokenKind.String,
                    value: chars.join(""),
                });

                x++;

                continue;
            }
            // TODO: Collapse all of these similar cases.
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
            case "+":
                tokens.push({
                    kind: TokenKind.Plus,
                });
                break;
            case "-":
                tokens.push({
                    kind: TokenKind.Minus,
                });
                break;
            case "*":
                tokens.push({
                    kind: TokenKind.Asterisk,
                });
                break;
            case "/":
                tokens.push({
                    kind: TokenKind.ForwardSlash,
                });
                break;
            case "_":
                tokens.push({
                    kind: TokenKind.Underscore,
                });
                break;
            case "!":
                tokens.push({
                    kind: TokenKind.ExclamationPoint,
                });
                break;
            case "&":
                tokens.push({
                    kind: TokenKind.Ampersand,
                });
                break;
            case "=":
                tokens.push({
                    kind: TokenKind.Equals,
                });
                break;
            case "<":
                tokens.push({
                    kind: TokenKind.LessThan,
                });
                break;
            case ">":
                tokens.push({
                    kind: TokenKind.GreaterThan,
                });
                break;
            case "'":
                tokens.push({
                    kind: TokenKind.SingleQuote,
                });
                break;
            case ":":
                tokens.push({
                    kind: TokenKind.Colon,
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
