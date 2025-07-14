const isWhitespace = (char) => /\s/.test(char);
const isAlphabetic = (char) => {
    const charCode = char.charCodeAt(0);
    return (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122);
};
const isDigit = (char) => {
    const charCode = char.charCodeAt(0);
    return charCode >= 48 && charCode <= 57;
};
const tokenizeLine = (input, y, errors) => {
    const tokens = [];
    let x = 0;
    for (; x < input.length, isWhitespace(input[x]); x++)
        ;
    if (x > 0) {
        tokens.push({
            kind: 0 /* TokenKind.LeadingWhitespace */,
        });
    }
    for (; x < input.length; x++) {
        const firstChar = input[x];
        if (isAlphabetic(firstChar)) {
            const start = x;
            x++;
            while (x < input.length && isAlphabetic(input[x])) {
                x++;
            }
            tokens.push({
                kind: 2 /* TokenKind.Identifier */,
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
                kind: 3 /* TokenKind.Number */,
                value: Number.parseInt(input.slice(start, x)),
            });
            continue;
        }
        switch (firstChar) {
            case '"': {
                const start = x;
                x++;
                // TODO: Handle "" for a literal quote.
                while (x < input.length && input[x] != '"') {
                    x++;
                }
                tokens.push({
                    kind: 4 /* TokenKind.String */,
                    value: input.slice(start + 1, x),
                });
                x++;
                break;
            }
            case " ":
                tokens.push({
                    kind: 1 /* TokenKind.Space */,
                });
                break;
            case "(":
                tokens.push({
                    kind: 5 /* TokenKind.LeftParen */,
                });
                break;
            case ")":
                tokens.push({
                    kind: 6 /* TokenKind.RightParen */,
                });
                break;
            case ",":
                tokens.push({
                    kind: 7 /* TokenKind.Comma */,
                });
                break;
            case "^":
                tokens.push({
                    kind: 8 /* TokenKind.Caret */,
                });
                break;
            case "$":
                tokens.push({
                    kind: 9 /* TokenKind.Dollar */,
                });
                break;
            case "#":
                tokens.push({
                    kind: 10 /* TokenKind.Hash */,
                });
                break;
            case ".":
                tokens.push({
                    kind: 11 /* TokenKind.Dot */,
                });
                break;
            default:
                errors.push({
                    message: `Unexpected character ${firstChar}`,
                    line: y,
                    column: x,
                });
                continue;
        }
    }
    return tokens;
};
export const tokenize = (input) => {
    const errors = [];
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
//# sourceMappingURL=tokenizer.js.map