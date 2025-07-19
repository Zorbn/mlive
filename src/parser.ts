import { MError } from "./mError.js";
import { Token, TokenKind } from "./tokenizer.js";

export const enum AstNodeKind {
    TopLevel,
    Write,
    Quit,
    Do,
    DoBlock,
    If,
    SetArgument,
    Set,
    New,
    Identifier,
    Variable,
    NumberLiteral,
    StringLiteral,
    Call,
    BinaryOp,
    ExclamationPointFormatter,
    HashFormatter,
}

interface Tag {
    index: number;
    params: string[] | null;
}

export interface TopLevelAstNode {
    kind: AstNodeKind.TopLevel;
    tags: Map<string, Tag>;
    children: CommandAstNode[];
}

export interface WriteAstNode {
    kind: AstNodeKind.Write;
    args: WriteArgumentAstNode[];
}

export type WriteArgumentAstNode = ExpressionAstNode | ExclamationFormatter | HashFormatter;

export interface QuitAstNode {
    kind: AstNodeKind.Quit;
    returnValue?: ExpressionAstNode;
}

export interface DoBlockAstNode {
    kind: AstNodeKind.DoBlock;
    children: CommandAstNode[];
}

export interface IfAstNode {
    kind: AstNodeKind.If;
    conditions: ExpressionAstNode[];
    children: CommandAstNode[];
}

export interface SetArgumentAstNode {
    kind: AstNodeKind.SetArgument;
    variable: VariableAstNode;
    value: ExpressionAstNode;
}

export interface SetAstNode {
    kind: AstNodeKind.Set;
    args: SetArgumentAstNode[];
}

export interface NewAstNode {
    kind: AstNodeKind.New;
    args: IdentifierAstNode[];
}

export type CommandAstNode =
    | WriteAstNode
    | QuitAstNode
    | CallAstNode
    | DoBlockAstNode
    | IfAstNode
    | SetAstNode
    | NewAstNode;

export type ExpressionAstNode =
    | VariableAstNode
    | NumberLiteralAstNode
    | StringLiteralAstNode
    | CallAstNode
    | BinaryOpAstNode;

export interface IdentifierAstNode {
    kind: AstNodeKind.Identifier;
    text: string;
}

export interface VariableAstNode {
    kind: AstNodeKind.Variable;
    name: IdentifierAstNode;
    subscripts: ExpressionAstNode[];
}

export interface NumberLiteralAstNode {
    kind: AstNodeKind.NumberLiteral;
    value: number;
}

export interface StringLiteralAstNode {
    kind: AstNodeKind.StringLiteral;
    value: string;
}

export interface CallAstNode {
    kind: AstNodeKind.Call;
    name: IdentifierAstNode;
    args: ExpressionAstNode[];
}

export const enum BinaryOp {
    Plus,
    Minus,
}

export interface BinaryOpAstNode {
    kind: AstNodeKind.BinaryOp;
    left: ExpressionAstNode;
    right: ExpressionAstNode;
    op: BinaryOp;
}

export interface ExclamationFormatter {
    kind: AstNodeKind.ExclamationPointFormatter;
}

export interface HashFormatter {
    kind: AstNodeKind.HashFormatter;
}

export type AstNode =
    | TopLevelAstNode
    | CommandAstNode
    | DoBlockAstNode
    | ExpressionAstNode
    | IdentifierAstNode
    | NumberLiteralAstNode
    | StringLiteralAstNode;

interface ParserPosition {
    line: number;
    column: number;
    nextUnparsedLine: number;
}

interface ParserState {
    position: ParserPosition;
    // The number of dots before each line (in addition to leading whitespace).
    indentationLevel: number;
    errors: MError[];
}

const makeParserPosition = (): ParserPosition => ({
    line: 0,
    column: 0,
    nextUnparsedLine: 1,
});

const moveToNextUnparsedLine = (state: ParserState) => {
    jumpToLine(state.position.nextUnparsedLine, state);
};

const jumpToLine = (line: number, state: ParserState) => {
    state.position.column = 0;
    state.position.line = line;
    state.position.nextUnparsedLine = line + 1;
};

const getToken = (input: Token[][], state: ParserState) =>
    input[state.position.line][state.position.column];

const nextToken = (input: Token[][], state: ParserState) => {
    const token = getToken(input, state);

    if (token.kind !== TokenKind.TrailingWhitespace) {
        state.position.column += 1;
    }

    return token;
};

const matchToken = <K extends TokenKind, T extends Token & { kind: K }>(
    input: Token[][],
    state: ParserState,
    validKind: K,
): T | undefined => {
    const token = getToken(input, state);

    if (token.kind !== validKind) {
        return;
    }

    return nextToken(input, state) as T;
};

const matchWhitespace = (input: Token[][], state: ParserState): boolean => {
    if (!getWhitespace(input, state)) {
        return false;
    }

    nextToken(input, state);

    return true;
};

const getWhitespace = (input: Token[][], state: ParserState): boolean => {
    const token = getToken(input, state);

    return (
        token.kind === TokenKind.Space ||
        token.kind === TokenKind.TrailingWhitespace ||
        token.kind === TokenKind.LeadingWhitespace
    );
};

const reportError = (message: string, state: ParserState) => {
    console.log(message, state);
    state.errors.push({
        message,
        line: state.position.line,
        // TODO: The column here is actually the index of the token. We should store the real column of each token so it can be reported here.
        column: state.position.column,
    });
};

const parseArgs = (input: Token[][], state: ParserState): ExpressionAstNode[] | undefined => {
    const args = [];

    if (matchToken(input, state, TokenKind.LeftParen)) {
        for (let i = 0; getToken(input, state).kind !== TokenKind.RightParen; i++) {
            const expression = parseExpression(input, state);

            if (!expression) {
                break;
            }

            args.push(expression);

            if (!matchToken(input, state, TokenKind.Comma)) {
                break;
            }
        }

        if (!matchToken(input, state, TokenKind.RightParen)) {
            reportError("Unterminated argument list", state);
            return;
        }
    }

    return args;
};

const parseCall = (input: Token[][], state: ParserState): CallAstNode | undefined => {
    const nameToken = getToken(input, state);

    if (nameToken.kind != TokenKind.Identifier) {
        reportError("Expected an identifier", state);
        return;
    }

    nextToken(input, state);

    const args = parseArgs(input, state);

    if (!args) {
        return;
    }

    return {
        kind: AstNodeKind.Call,
        name: {
            kind: AstNodeKind.Identifier,
            text: nameToken.text,
        },
        args,
    };
};

const parseVariable = (input: Token[][], state: ParserState): VariableAstNode | undefined => {
    const firstToken = matchToken(input, state, TokenKind.Identifier);

    if (!firstToken) {
        reportError("Expected variable to start with an identifier", state);
        return;
    }

    const args = parseArgs(input, state);

    if (!args) {
        return;
    }

    return {
        kind: AstNodeKind.Variable,
        name: {
            kind: AstNodeKind.Identifier,
            text: firstToken.text,
        },
        subscripts: args,
    };
};

const parsePrimary = (input: Token[][], state: ParserState): ExpressionAstNode | undefined => {
    const firstToken = getToken(input, state);

    if (firstToken.kind == TokenKind.Dollar) {
        nextToken(input, state);

        if (!matchToken(input, state, TokenKind.Dollar)) {
            reportError("Builtins are not supported yet", state);
            return;
        }

        return parseCall(input, state);
    }

    switch (firstToken.kind) {
        case TokenKind.String:
            nextToken(input, state);

            return {
                kind: AstNodeKind.StringLiteral,
                value: firstToken.value,
            };
        case TokenKind.Number:
            nextToken(input, state);

            return {
                kind: AstNodeKind.NumberLiteral,
                value: firstToken.value,
            };
        case TokenKind.Identifier:
            return parseVariable(input, state);
        default:
            reportError("Expected an expression", state);
            return;
    }
};

const parseExpression = (input: Token[][], state: ParserState): ExpressionAstNode | undefined => {
    let left = parsePrimary(input, state);

    if (!left) {
        return;
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

        const right = parsePrimary(input, state);

        if (!right) {
            return;
        }

        let op: BinaryOp;

        switch (token.kind) {
            case TokenKind.Plus:
                op = BinaryOp.Plus;
                break;
            case TokenKind.Minus:
                op = BinaryOp.Minus;
                break;
            default:
                reportError("Unimplemented binary op", state);
                return;
        }

        left = {
            kind: AstNodeKind.BinaryOp,
            left,
            right,
            op,
        };
    }

    return left;
};

const parseBlock = (
    input: Token[][],
    state: ParserState,
    startOnNextLine: boolean,
): CommandAstNode[] | undefined => {
    const commands = [];

    while (true) {
        while (
            state.position.line < input.length &&
            (startOnNextLine || getToken(input, state).kind === TokenKind.TrailingWhitespace)
        ) {
            moveToNextUnparsedLine(state);
            startOnNextLine = false;

            if (state.position.line >= input.length) {
                return commands;
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
                        return;
                    }
                }
            }

            if (didBlockEnd) {
                state.position.column = startColumn;
                return commands;
            }
        }

        const command = parseCommand(input, state);

        if (!command) {
            return;
        }

        commands.push(command);
    }
};

const parseWriteBody = (input: Token[][], state: ParserState): WriteAstNode | undefined => {
    // TODO: Support formatting with ?.
    const args: WriteArgumentAstNode[] = [];

    while (!matchWhitespace(input, state)) {
        const token = getToken(input, state);

        switch (token.kind) {
            case TokenKind.Hash:
                nextToken(input, state);
                args.push({ kind: AstNodeKind.HashFormatter });
                break;
            case TokenKind.ExclamationPoint:
                nextToken(input, state);
                args.push({ kind: AstNodeKind.ExclamationPointFormatter });
                break;
            default:
                const expression = parseExpression(input, state);

                if (!expression) {
                    return;
                }

                args.push(expression);
                break;
        }

        if (!matchToken(input, state, TokenKind.Comma)) {
            break;
        }
    }

    return {
        kind: AstNodeKind.Write,
        args,
    };
};

const parseQuitBody = (input: Token[][], state: ParserState): QuitAstNode | undefined => {
    if (getWhitespace(input, state)) {
        return {
            kind: AstNodeKind.Quit,
        };
    }

    const returnValue = parseExpression(input, state);

    if (!returnValue) {
        return;
    }

    return {
        kind: AstNodeKind.Quit,
        returnValue,
    };
};

const parseDoBody = (
    input: Token[][],
    state: ParserState,
): CallAstNode | DoBlockAstNode | undefined => {
    if (!getWhitespace(input, state)) {
        return parseCall(input, state);
    }

    const startLine = state.position.line;
    const startColumn = state.position.column;

    state.indentationLevel++;
    const block = parseBlock(input, state, true);
    state.indentationLevel--;

    if (!block) {
        return;
    }

    state.position.nextUnparsedLine = state.position.line;
    state.position.line = startLine;
    state.position.column = startColumn;

    return {
        kind: AstNodeKind.DoBlock,
        children: block,
    };
};

const parseIfBody = (input: Token[][], state: ParserState): IfAstNode | undefined => {
    const conditions: ExpressionAstNode[] = [];
    const children: CommandAstNode[] = [];

    while (!matchWhitespace(input, state)) {
        const expression = parseExpression(input, state);

        if (!expression) {
            return;
        }

        conditions.push(expression);

        if (!matchToken(input, state, TokenKind.Comma)) {
            if (!matchWhitespace(input, state)) {
                reportError("Expected space after if conditions", state);
                return;
            }

            break;
        }
    }

    while (!matchWhitespace(input, state)) {
        const command = parseCommand(input, state);

        if (!command) {
            return;
        }

        children.push(command);
    }

    return {
        kind: AstNodeKind.If,
        conditions,
        children,
    };
};

const parseSetBody = (input: Token[][], state: ParserState): SetAstNode | undefined => {
    const args: SetArgumentAstNode[] = [];

    while (!matchWhitespace(input, state)) {
        const variable = parseVariable(input, state);

        if (!variable) {
            return;
        }

        if (!matchToken(input, state, TokenKind.Equals)) {
            reportError("Expected equals after identifier in set command", state);
            return;
        }

        const expression = parseExpression(input, state);

        if (!expression) {
            return;
        }

        args.push({
            kind: AstNodeKind.SetArgument,
            variable,
            value: expression,
        });

        if (!matchToken(input, state, TokenKind.Comma)) {
            break;
        }
    }

    return {
        kind: AstNodeKind.Set,
        args,
    };
};

const parseNewBody = (input: Token[][], state: ParserState): NewAstNode | undefined => {
    const args: IdentifierAstNode[] = [];

    while (!matchWhitespace(input, state)) {
        const token = matchToken(input, state, TokenKind.Identifier);

        if (!token) {
            return;
        }

        args.push({
            kind: AstNodeKind.Identifier,
            text: token.text,
        });

        if (!matchToken(input, state, TokenKind.Comma)) {
            break;
        }
    }

    return {
        kind: AstNodeKind.New,
        args,
    };
};

const parseCommand = (input: Token[][], state: ParserState): CommandAstNode | undefined => {
    let nameToken = matchToken(input, state, TokenKind.Identifier);

    if (!nameToken) {
        reportError("Expected command name", state);
        return;
    }

    if (!matchWhitespace(input, state)) {
        reportError("Expected space between command and arguments", state);
        return;
    }

    let node: CommandAstNode | undefined;

    const lowerCaseName = nameToken.text.toLowerCase();

    // TODO: Turn this into a map lookup to get the function to call. The current way results in lots of string cmps.
    if ("write".startsWith(lowerCaseName)) {
        node = parseWriteBody(input, state);
    } else if ("quit".startsWith(lowerCaseName)) {
        node = parseQuitBody(input, state);
    } else if ("do".startsWith(lowerCaseName)) {
        node = parseDoBody(input, state);
    } else if ("if".startsWith(lowerCaseName)) {
        node = parseIfBody(input, state);
    } else if ("set".startsWith(lowerCaseName)) {
        node = parseSetBody(input, state);
    } else if ("new".startsWith(lowerCaseName)) {
        node = parseNewBody(input, state);
    } else {
        reportError("Unrecognized command name", state);
    }
    if (!node) {
        return;
    }

    if (!matchWhitespace(input, state)) {
        reportError("Expected space between arguments and next commands", state);
        return;
    }

    return node;
};

const parseTag = (input: Token[][], state: ParserState): string[] | null | undefined => {
    let params: string[] | null = null;

    if (getToken(input, state).kind === TokenKind.LeftParen) {
        nextToken(input, state);

        params = [];

        for (let i = 0; ; i++) {
            let paramToken = matchToken(input, state, TokenKind.Identifier);

            if (!paramToken) {
                if (i > 0) {
                    reportError("Expected parameter name", state);
                }

                break;
            }

            params.push(paramToken.text);

            if (!matchToken(input, state, TokenKind.Comma)) {
                break;
            }
        }

        if (!matchToken(input, state, TokenKind.RightParen)) {
            reportError("Unterminated parameter list", state);
            return;
        }
    }

    if (!matchWhitespace(input, state)) {
        reportError("Expected space after tag name", state);
        return;
    }

    return params;
};

const parseTopLevel = (input: Token[][], state: ParserState): TopLevelAstNode | undefined => {
    const topLevel: TopLevelAstNode = {
        kind: AstNodeKind.TopLevel,
        tags: new Map(),
        children: [],
    };

    while (state.position.line < input.length) {
        const firstToken = getToken(input, state);

        if (firstToken.kind === TokenKind.Identifier) {
            nextToken(input, state);

            const name = firstToken.text;
            const params = parseTag(input, state);

            if (params === undefined) {
                return;
            }

            if (!topLevel.tags.has(name)) {
                topLevel.tags.set(name, {
                    index: topLevel.children.length,
                    params,
                });
            }
        } else if (!matchWhitespace(input, state)) {
            reportError("Expected leading space", state);
            return;
        }

        const block = parseBlock(input, state, false);

        if (!block) {
            return;
        }

        topLevel.children.push(...block);
    }

    return topLevel;
};

export const parse = (input: Token[][]) => {
    const state = {
        position: makeParserPosition(),
        indentationLevel: 0,
        errors: [],
    };

    return {
        ast: parseTopLevel(input, state),
        errors: state.errors,
    };
};
