import { MSyntaxError } from "./mSyntaxError.js";
import { BasicToken, IdentifierToken, Token, TokenKind } from "./tokenizer.js";

const enum AstNodeKind {
    TopLevel,
    Tag,
    Write,
    Quit,
    DoBlock,
    Identifier,
    NumberLiteral,
    StringLiteral,
}

interface TopLevelAstNode {
    kind: AstNodeKind.TopLevel;
    children: TagAstNode[];
}

interface TagAstNode {
    kind: AstNodeKind.Tag;
    // Any commands that occur before explicit tag definitions
    // are put in an implicit tag with the name "".
    name: string;
    children: CommandAstNode[];
    // Tags with an empty parameter list are called differently from tags with no parameter list.
    params?: IdentifierAstNode[];
}

interface WriteAstNode {
    kind: AstNodeKind.Write;
    args: ExpressionAstNode[];
}

interface QuitAstNode {
    kind: AstNodeKind.Quit;
    returnValue?: ExpressionAstNode;
}

interface DoBlockAstNode {
    kind: AstNodeKind.DoBlock;
    children: CommandAstNode[];
}

type CommandAstNode = WriteAstNode | QuitAstNode | DoBlockAstNode;

type ExpressionAstNode = IdentifierAstNode | NumberLiteralAstNode | StringLiteralAstNode;

interface IdentifierAstNode {
    kind: AstNodeKind.Identifier;
    text: string;
}

interface NumberLiteralAstNode {
    kind: AstNodeKind.NumberLiteral;
    value: number;
}

interface StringLiteralAstNode {
    kind: AstNodeKind.StringLiteral;
    value: string;
}

export type AstNode =
    | TopLevelAstNode
    | TagAstNode
    | CommandAstNode
    | DoBlockAstNode
    | ExpressionAstNode
    | IdentifierAstNode
    | NumberLiteralAstNode
    | StringLiteralAstNode;

interface ParsePosition {
    line: number;
    column: number;
}

const getToken = (input: Token[][], position: ParsePosition) =>
    input[position.line][position.column];

const nextToken = (input: Token[][], position: ParsePosition) => {
    const token = getToken(input, position);

    if (token.kind !== TokenKind.TrailingWhitespace) {
        position.column += 1;
    }

    return token;
};

const matchToken = <K extends TokenKind, T extends Token & { kind: K }>(
    input: Token[][],
    position: ParsePosition,
    validKind: K,
): T | undefined => {
    const token = getToken(input, position);

    if (token.kind !== validKind) {
        return;
    }

    return nextToken(input, position) as T;
};

const matchWhitespace = (input: Token[][], position: ParsePosition): boolean => {
    const token = getToken(input, position);

    if (
        token.kind !== TokenKind.Space &&
        token.kind !== TokenKind.TrailingWhitespace &&
        token.kind !== TokenKind.LeadingWhitespace
    ) {
        return false;
    }

    nextToken(input, position);

    return true;
};

const reportError = (errors: MSyntaxError[], message: string, position: ParsePosition) => {
    console.log(message, position);
    errors.push({
        message,
        line: position.line,
        // TODO: The column here is actually the index of the token. We should store the real column of each token so it can be reported here.
        column: position.column,
    });
};

const parseExpression = (
    input: Token[][],
    position: ParsePosition,
    errors: MSyntaxError[],
): ExpressionAstNode | undefined => {
    const token = getToken(input, position);

    let node: ExpressionAstNode | undefined;

    switch (token.kind) {
        case TokenKind.String:
            node = {
                kind: AstNodeKind.StringLiteral,
                value: token.value,
            };
            break;
        case TokenKind.Number:
            node = {
                kind: AstNodeKind.NumberLiteral,
                value: token.value,
            };
            break;
        case TokenKind.Identifier:
            node = {
                kind: AstNodeKind.Identifier,
                text: token.text,
            };
            break;
        default:
            reportError(errors, "Expected an expression", position);
            return;
    }

    nextToken(input, position);

    return node;
};

const parseWriteBody = (
    input: Token[][],
    position: ParsePosition,
    errors: MSyntaxError[],
): WriteAstNode | undefined => {
    // TODO: Support formatting with #, ?, and !.

    const args: ExpressionAstNode[] = [];

    if (matchWhitespace(input, position)) {
        return {
            kind: AstNodeKind.Write,
            args,
        };
    }

    while (true) {
        const expression = parseExpression(input, position, errors);

        if (!expression) {
            break;
        }

        args.push(expression);

        if (!matchToken(input, position, TokenKind.Comma)) {
            break;
        }
    }

    return {
        kind: AstNodeKind.Write,
        args,
    };
};

const parseQuitBody = (
    input: Token[][],
    position: ParsePosition,
    errors: MSyntaxError[],
): QuitAstNode | undefined => {
    if (matchWhitespace(input, position)) {
        return {
            kind: AstNodeKind.Quit,
        };
    }

    return {
        kind: AstNodeKind.Quit,
        returnValue: parseExpression(input, position, errors),
    };
};

const parseDoBlockBody = (
    input: Token[][],
    position: ParsePosition,
    errors: MSyntaxError[],
): DoBlockAstNode | undefined => {
    throw "Do block parsing is unimplemented";
    return;
};

const parseCommand = (
    input: Token[][],
    position: ParsePosition,
    errors: MSyntaxError[],
): CommandAstNode | undefined => {
    let nameToken = matchToken(input, position, TokenKind.Identifier);

    if (!nameToken) {
        reportError(errors, "Expected command name", position);
        return;
    }

    if (!matchWhitespace(input, position)) {
        reportError(errors, "Expected space between command and arguments", position);
    }

    let node: CommandAstNode | undefined;

    // TODO: Turn this into a map lookup to get the function to call. The current way results in lots of string cmps.
    switch (nameToken.text.toLowerCase()) {
        case "w":
        case "write":
            node = parseWriteBody(input, position, errors);
            break;
        case "q":
        case "quit":
            node = parseQuitBody(input, position, errors);
            break;
        case "d":
        case "do":
            // TODO: This could also be a subroutine call instead of a block.
            node = parseDoBlockBody(input, position, errors);
            break;
        default:
            reportError(errors, "Unrecognized command name", position);
            return;
    }

    return node;

    // const args: ExpressionAstNode[] = [];

    // if (getToken(input, position).kind !== TokenKind.Space) {
    //     while (true) {
    //         if (!matchToken(input, position, TokenKind.Identifier)) {
    //         }
    //     }
    // }

    // const token = getToken(input, position);

    // if (token.kind === TokenKind.TrailingWhitespace || token.kind === TokenKind.Space) {
    //     nextToken(input, position);
    // } else {
    //     reportError(errors, "Expected space after command", position);
    // }

    // return {
    //     kind: AstNodeKind.Command,
    //     name: {
    //         kind: AstNodeKind.Identifier,
    //         text: nameToken.text,
    //     },
    //     args,
    // };
};

const parseTag = (
    input: Token[][],
    position: ParsePosition,
    errors: MSyntaxError[],
): TagAstNode | undefined => {
    let name = "";
    let params: IdentifierAstNode[] | undefined;

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

                params.push({
                    kind: AstNodeKind.Identifier,
                    text: paramToken.text,
                });

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
    }

    const children: CommandAstNode[] = [];

    while (true) {
        while (
            position.line < input.length &&
            getToken(input, position).kind === TokenKind.TrailingWhitespace
        ) {
            position.column = 0;
            position.line += 1;
        }

        if (
            position.line >= input.length ||
            !matchToken(input, position, TokenKind.LeadingWhitespace)
        ) {
            return {
                name,
                kind: AstNodeKind.Tag,
                children,
                params,
            };
        }

        const command = parseCommand(input, position, errors);

        if (!command) {
            break;
        }

        children.push(command);
    }
};

export const parse = (input: Token[][]) => {
    const errors: MSyntaxError[] = [];
    const position = { line: 0, column: 0 };
    const ast: TopLevelAstNode = {
        kind: AstNodeKind.TopLevel,
        children: [],
    };

    while (position.line < input.length) {
        const tag = parseTag(input, position, errors);

        if (!tag) {
            break;
        }

        ast.children.push(tag);
    }

    return {
        ast,
        errors,
    };
};
