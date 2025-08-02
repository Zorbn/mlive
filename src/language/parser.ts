import { MError } from "./mError.js";
import { TextRange } from "./textRange.js";
import { IdentifierToken, Token, TokenKind } from "./tokenizer.js";

export const enum AstNodeKind {
    TopLevel,
    Comment,
    Write,
    Quit,
    Do,
    DoBlock,
    If,
    For,
    ForArgument,
    Else,
    SetArgument,
    Set,
    New,
    Kill,
    Merge,
    Halt,
    Identifier,
    Variable,
    NumberLiteral,
    StringLiteral,
    Call,
    Command,
    Reference,
    BinaryOp,
    UnaryOp,
    ExclamationPointFormatter,
    QuestionMarkFormatter,
    HashFormatter,
    OrderBuiltin,
    LengthBuiltin,
    ExtractBuiltin,
    SelectBuiltin,
    SelectBuiltinArg,
    FindBuiltin,
    RandomBuiltin,
}

export interface Tag {
    index: number;
    params: string[] | null;
}

export interface TopLevelAstNode extends TextRange {
    kind: AstNodeKind.TopLevel;
    tags: Map<string, Tag>;
    children: CommandAstNode[];
}

export interface CommentAstNode extends TextRange {
    kind: AstNodeKind.Comment;
}

export interface WriteAstNode extends TextRange {
    kind: AstNodeKind.Write;
    args: WriteArgumentAstNode[];
}

export interface ExclamationPointFormatter {
    kind: AstNodeKind.ExclamationPointFormatter;
}

export interface QuestionMarkFormatter {
    kind: AstNodeKind.QuestionMarkFormatter;
    minColumn: ExpressionAstNode;
}

export interface HashFormatter {
    kind: AstNodeKind.HashFormatter;
}

export type WriteArgumentAstNode =
    | ExpressionAstNode
    | ExclamationPointFormatter
    | QuestionMarkFormatter
    | HashFormatter;

export interface QuitAstNode extends TextRange {
    kind: AstNodeKind.Quit;
    returnValue?: ExpressionAstNode;
}

export interface DoBlockAstNode extends TextRange {
    kind: AstNodeKind.DoBlock;
    children: CommandAstNode[];
}

export interface IfAstNode extends TextRange {
    kind: AstNodeKind.If;
    conditions: ExpressionAstNode[];
    children: CommandAstNode[];
}

export interface ForArgumentAstNode extends TextRange {
    kind: AstNodeKind.ForArgument;
    variable: VariableAstNode;
    // Either start, start:increment, or start:increment:end.
    expressions: ExpressionAstNode[];
}

export interface ForAstNode extends TextRange {
    kind: AstNodeKind.For;
    arg?: ForArgumentAstNode;
    children: CommandAstNode[];
}

export interface ElseAstNode extends TextRange {
    kind: AstNodeKind.Else;
    children: CommandAstNode[];
}

export interface SetArgAstNode extends TextRange {
    kind: AstNodeKind.SetArgument;
    target: VariableAstNode | ExtractBuiltinAstNode;
    value: ExpressionAstNode;
}

export interface SetAstNode extends TextRange {
    kind: AstNodeKind.Set;
    args: SetArgAstNode[];
}

export interface NewAstNode extends TextRange {
    kind: AstNodeKind.New;
    args: IdentifierAstNode[];
}

export interface KillAstNode extends TextRange {
    kind: AstNodeKind.Kill;
    args: VariableAstNode[];
}

export interface MergeAstNode extends TextRange {
    kind: AstNodeKind.Merge;
    left: VariableAstNode;
    right: VariableAstNode;
}

export interface HaltAstNode extends TextRange {
    kind: AstNodeKind.Halt;
}

export type CommandBodyAstNode =
    | CommentAstNode
    | WriteAstNode
    | QuitAstNode
    | CallAstNode
    | DoBlockAstNode
    | ForAstNode
    | IfAstNode
    | ElseAstNode
    | ForAstNode
    | SetAstNode
    | NewAstNode
    | KillAstNode
    | MergeAstNode
    | HaltAstNode;

export interface CommandAstNode extends TextRange {
    kind: AstNodeKind.Command;
    condition?: ExpressionAstNode;
    body: CommandBodyAstNode;
}

export interface ReferenceAstNode extends TextRange {
    kind: AstNodeKind.Reference;
    name: IdentifierAstNode;
}

export type CallArgumentAstNode = ReferenceAstNode | ExpressionAstNode;

export type ExpressionAstNode =
    | VariableAstNode
    | NumberLiteralAstNode
    | StringLiteralAstNode
    | CallAstNode
    | UnaryOpAstNode
    | BinaryOpAstNode
    | BuiltinAstNode;

export interface IdentifierAstNode extends TextRange {
    kind: AstNodeKind.Identifier;
    text: string;
}

export interface VariableAstNode extends TextRange {
    kind: AstNodeKind.Variable;
    name: IdentifierAstNode;
    subscripts: ExpressionAstNode[];
}

export interface NumberLiteralAstNode extends TextRange {
    kind: AstNodeKind.NumberLiteral;
    value: number;
}

export interface StringLiteralAstNode extends TextRange {
    kind: AstNodeKind.StringLiteral;
    value: string;
}

export interface CallAstNode extends TextRange {
    kind: AstNodeKind.Call;
    name: IdentifierAstNode;
    args: CallArgumentAstNode[];
}

export const enum UnaryOp {
    Not,
    Plus,
    Minus,
}

export interface UnaryOpAstNode extends TextRange {
    kind: AstNodeKind.UnaryOp;
    right: ExpressionAstNode;
    op: UnaryOp;
}

export const enum BinaryOp {
    Or,
    And,
    Equals,
    LessThan,
    GreaterThan,
    Add,
    Subtract,
    Multiply,
    Power,
    Divide,
    IntegerDivide,
    Modulo,
    Concatenate,
}

export interface BinaryOpAstNode extends TextRange {
    kind: AstNodeKind.BinaryOp;
    left: ExpressionAstNode;
    right: ExpressionAstNode;
    op: BinaryOp;
    isNegated: boolean;
}

export interface OrderBuiltinAstNode extends TextRange {
    kind: AstNodeKind.OrderBuiltin;
    arg: VariableAstNode;
}

export interface LengthBuiltinAstNode extends TextRange {
    kind: AstNodeKind.LengthBuiltin;
    arg: ExpressionAstNode;
}

export interface ExtractBuiltinAstNode extends TextRange {
    kind: AstNodeKind.ExtractBuiltin;
    target: ExpressionAstNode;
    extractionStart: ExpressionAstNode;
    extractionEnd: ExpressionAstNode;
}

export interface SelectBuiltinArgAstNode extends TextRange {
    kind: AstNodeKind.SelectBuiltinArg;
    condition: ExpressionAstNode;
    value: ExpressionAstNode;
}

export interface SelectBuiltinAstNode extends TextRange {
    kind: AstNodeKind.SelectBuiltin;
    args: SelectBuiltinArgAstNode[];
}

export interface FindBuiltinAstNode extends TextRange {
    kind: AstNodeKind.FindBuiltin;
    haystack: ExpressionAstNode;
    needle: ExpressionAstNode;
    findStart?: ExpressionAstNode;
}

export interface RandomBuiltinAstNode extends TextRange {
    kind: AstNodeKind.RandomBuiltin;
    max: ExpressionAstNode;
}

export type BuiltinAstNode =
    | OrderBuiltinAstNode
    | LengthBuiltinAstNode
    | ExtractBuiltinAstNode
    | SelectBuiltinAstNode
    | FindBuiltinAstNode
    | RandomBuiltinAstNode;

export type AstNode =
    | TopLevelAstNode
    | CommandBodyAstNode
    | CommandAstNode
    | CallArgumentAstNode
    | IdentifierAstNode
    | NumberLiteralAstNode
    | StringLiteralAstNode;

interface ParserPosition {
    line: number;
    column: number;
    nextUnparsedLine: number;
}

interface CommandBodyVariant {
    name: string;
    parser: (input: Token[][], state: ParserState) => CommandBodyAstNode | undefined;
}

interface BuiltinVariant {
    name: string;
    parser: (
        input: Token[][],
        state: ParserState,
        builtinName: Token,
    ) => BuiltinAstNode | undefined;
}

interface ParserState {
    position: ParserPosition;
    // The number of dots before each line (in addition to leading whitespace).
    indentationLevel: number;
    errors: MError[];
}

export interface ParserResult {
    ast: TopLevelAstNode | undefined;
    errors: MError[];
}

const makeIdentifierAstNode = (token: IdentifierToken): IdentifierAstNode => {
    return {
        kind: AstNodeKind.Identifier,
        text: token.text,
        start: token.start,
        end: token.end,
    };
};

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

const reportError = (message: string, input: Token[][], state: ParserState) => {
    const token = getToken(input, state);

    reportErrorAt(message, token, state);
};

const reportErrorAt = (message: string, textRange: TextRange, state: ParserState) => {
    state.errors.push({
        message,
        line: textRange.start.line,
        column: textRange.start.column,
    });
};

const parseArgs = (input: Token[][], state: ParserState): CallArgumentAstNode[] | undefined => {
    const args: CallArgumentAstNode[] = [];

    if (matchToken(input, state, TokenKind.LeftParen)) {
        for (let i = 0; getToken(input, state).kind !== TokenKind.RightParen; i++) {
            const dot = matchToken(input, state, TokenKind.Dot);

            if (dot) {
                const name = matchToken(input, state, TokenKind.Identifier);

                if (!name) {
                    reportError("Expected variable name to reference", input, state);
                    return;
                }

                args.push({
                    kind: AstNodeKind.Reference,
                    name: makeIdentifierAstNode(name),
                    start: dot.start,
                    end: name.end,
                });
            } else {
                const expression = parseExpression(input, state);

                if (!expression) {
                    break;
                }

                args.push(expression);
            }

            if (!matchToken(input, state, TokenKind.Comma)) {
                break;
            }
        }

        if (!matchToken(input, state, TokenKind.RightParen)) {
            reportError("Unterminated argument list", input, state);
            return;
        }
    }

    return args;
};

const parseSubscripts = (input: Token[][], state: ParserState): ExpressionAstNode[] | undefined => {
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
            reportError("Unterminated subscript list", input, state);
            return;
        }
    }

    return args;
};

const parseCall = (input: Token[][], state: ParserState): CallAstNode | undefined => {
    const nameToken = getToken(input, state);

    if (nameToken.kind !== TokenKind.Identifier) {
        reportError("Expected an identifier", input, state);
        return;
    }

    nextToken(input, state);

    const args = parseArgs(input, state);

    if (!args) {
        return;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.Call,
        name: makeIdentifierAstNode(nameToken),
        args,
        start: nameToken.start,
        end: lastToken.start,
    };
};

const parseVariable = (input: Token[][], state: ParserState): VariableAstNode | undefined => {
    const firstToken = matchToken(input, state, TokenKind.Identifier);

    if (!firstToken) {
        reportError("Expected variable to start with an identifier", input, state);
        return;
    }

    const subscripts = parseSubscripts(input, state);

    if (!subscripts) {
        return;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.Variable,
        name: makeIdentifierAstNode(firstToken),
        subscripts: subscripts,
        start: firstToken.start,
        end: lastToken.start,
    };
};

const parseBuiltinArgs = <T>(
    input: Token[][],
    state: ParserState,
    parser: (input: Token[][], state: ParserState) => T | undefined,
): T[] | undefined => {
    if (!matchToken(input, state, TokenKind.LeftParen)) {
        reportError("Expected argument list after builtin name", input, state);
        return;
    }

    const args = parseNodeList(input, state, parser);

    if (!args) {
        return;
    }

    if (!matchToken(input, state, TokenKind.RightParen)) {
        reportError("Unterminated argument list", input, state);
        return;
    }

    return args;
};

const parseSelectBuiltinArg = (
    input: Token[][],
    state: ParserState,
): SelectBuiltinArgAstNode | undefined => {
    const condition = parseExpression(input, state);

    if (!condition) {
        return;
    }

    if (!matchToken(input, state, TokenKind.Colon)) {
        reportError("Expected colon between select condition and value", input, state);
        return;
    }

    const value = parseExpression(input, state);

    if (!value) {
        return;
    }

    return {
        kind: AstNodeKind.SelectBuiltinArg,
        condition,
        value,
        start: condition.start,
        end: value.end,
    };
};

const parseOrderBuiltin = (
    input: Token[][],
    state: ParserState,
    builtinName: Token,
): OrderBuiltinAstNode | undefined => {
    const args = parseBuiltinArgs(input, state, parseVariable);

    if (!args) {
        return;
    }

    if (args.length !== 1) {
        reportErrorAt("Expected one argument for the order builtin", builtinName, state);
        return;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.OrderBuiltin,
        arg: args[0],
        start: builtinName.start,
        end: lastToken.start,
    };
};

const parseLengthBuiltin = (
    input: Token[][],
    state: ParserState,
    builtinName: Token,
): LengthBuiltinAstNode | undefined => {
    const args = parseBuiltinArgs(input, state, parseExpression);

    if (!args) {
        return;
    }

    if (args.length !== 1) {
        reportErrorAt("Expected one argument for the length builtin", builtinName, state);
        return;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.LengthBuiltin,
        arg: args[0],
        start: builtinName.start,
        end: lastToken.start,
    };
};

const parseExtractBuiltin = (
    input: Token[][],
    state: ParserState,
    builtinName: Token,
): ExtractBuiltinAstNode | undefined => {
    const args = parseBuiltinArgs(input, state, parseExpression);

    if (!args) {
        return;
    }

    if (args.length < 1 || args.length > 3) {
        reportErrorAt(
            "Expected between one and three arguments for extract builtin",
            builtinName,
            state,
        );
        return;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.ExtractBuiltin,
        target: args[0],
        extractionStart: args[1],
        extractionEnd: args[2],
        start: builtinName.start,
        end: lastToken.start,
    };
};

const parseSelectBuiltin = (
    input: Token[][],
    state: ParserState,
    builtinName: Token,
): SelectBuiltinAstNode | undefined => {
    const args = parseBuiltinArgs(input, state, parseSelectBuiltinArg);

    if (!args) {
        return;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.SelectBuiltin,
        args,
        start: builtinName.start,
        end: lastToken.start,
    };
};

const parseFindBuiltin = (
    input: Token[][],
    state: ParserState,
    builtinName: Token,
): FindBuiltinAstNode | undefined => {
    const args = parseBuiltinArgs(input, state, parseExpression);

    if (!args) {
        return;
    }

    if (args.length < 2 || args.length > 3) {
        reportErrorAt(
            "Expected between two and three arguments for find builtin",
            builtinName,
            state,
        );
        return;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.FindBuiltin,
        haystack: args[0],
        needle: args[1],
        findStart: args[2],
        start: builtinName.start,
        end: lastToken.start,
    };
};

const parseRandomBuiltin = (
    input: Token[][],
    state: ParserState,
    builtinName: Token,
): RandomBuiltinAstNode | undefined => {
    const args = parseBuiltinArgs(input, state, parseExpression);

    if (!args) {
        return;
    }

    if (args.length !== 1) {
        reportErrorAt("Expected one argument for the random builtin", builtinName, state);
        return;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.RandomBuiltin,
        max: args[0],
        start: builtinName.start,
        end: lastToken.start,
    };
};

const parseBuiltin = (input: Token[][], state: ParserState): BuiltinAstNode | undefined => {
    const builtinName = matchToken(input, state, TokenKind.Identifier);

    if (!builtinName) {
        reportError("Expected builtin name", input, state);
        return;
    }

    const lowerCaseBuiltinName = builtinName.text.toLowerCase();

    for (const variant of builtinVariants) {
        if (variant.name.startsWith(lowerCaseBuiltinName)) {
            return variant.parser(input, state, builtinName);
        }
    }

    reportErrorAt("Unrecognized builtin", builtinName, state);
    return;
};

const parsePrimary = (input: Token[][], state: ParserState): ExpressionAstNode | undefined => {
    const firstToken = getToken(input, state);

    if (firstToken.kind === TokenKind.Dollar) {
        nextToken(input, state);

        if (!matchToken(input, state, TokenKind.Dollar)) {
            return parseBuiltin(input, state);
        }

        return parseCall(input, state);
    }

    switch (firstToken.kind) {
        case TokenKind.String:
            nextToken(input, state);

            return {
                kind: AstNodeKind.StringLiteral,
                value: firstToken.value,
                start: firstToken.start,
                end: firstToken.end,
            };
        case TokenKind.Number:
            nextToken(input, state);

            return {
                kind: AstNodeKind.NumberLiteral,
                value: firstToken.value,
                start: firstToken.start,
                end: firstToken.end,
            };
        case TokenKind.Identifier:
            return parseVariable(input, state);
        case TokenKind.LeftParen: {
            nextToken(input, state);

            const expression = parseExpression(input, state);

            if (!expression) {
                return;
            }

            if (!matchToken(input, state, TokenKind.RightParen)) {
                reportError("Unterminated parenthesis", input, state);
                return;
            }

            return expression;
        }
        default:
            reportError("Expected an expression", input, state);
            return;
    }
};

const parseUnaryOp = (input: Token[][], state: ParserState): ExpressionAstNode | undefined => {
    const token = getToken(input, state);
    let op: UnaryOp | undefined;

    switch (token.kind) {
        case TokenKind.SingleQuote:
            op = UnaryOp.Not;
            break;
        case TokenKind.Minus:
            op = UnaryOp.Minus;
            break;
        case TokenKind.Plus:
            op = UnaryOp.Plus;
            break;
    }

    if (op === undefined) {
        return parsePrimary(input, state);
    }

    nextToken(input, state);

    const right = parseUnaryOp(input, state);

    if (!right) {
        return;
    }

    return {
        kind: AstNodeKind.UnaryOp,
        right,
        op,
        start: token.start,
        end: right.end,
    };
};

const parseExpression = (input: Token[][], state: ParserState): ExpressionAstNode | undefined => {
    let left = parseUnaryOp(input, state);

    if (!left) {
        return;
    }

    while (true) {
        let isNegated = false;

        if (matchToken(input, state, TokenKind.SingleQuote)) {
            isNegated = true;
        }

        const token = getToken(input, state);
        let op: BinaryOp | undefined;

        switch (token.kind) {
            case TokenKind.ExclamationPoint:
                op = BinaryOp.Or;
                break;
            case TokenKind.Ampersand:
                op = BinaryOp.And;
                break;
            case TokenKind.Equals:
                op = BinaryOp.Equals;
                break;
            case TokenKind.LessThan:
                op = BinaryOp.LessThan;
                break;
            case TokenKind.GreaterThan:
                op = BinaryOp.GreaterThan;
                break;
        }

        if (!isNegated) {
            switch (token.kind) {
                case TokenKind.Plus:
                    op = BinaryOp.Add;
                    break;
                case TokenKind.Minus:
                    op = BinaryOp.Subtract;
                    break;
                case TokenKind.Asterisk:
                    op = BinaryOp.Multiply;
                    break;
                case TokenKind.DoubleAsterisk:
                    op = BinaryOp.Power;
                    break;
                case TokenKind.ForwardSlash:
                    op = BinaryOp.Divide;
                    break;
                case TokenKind.BackSlash:
                    op = BinaryOp.IntegerDivide;
                    break;
                case TokenKind.Hash:
                    op = BinaryOp.Modulo;
                    break;
                case TokenKind.Underscore:
                    op = BinaryOp.Concatenate;
                    break;
            }
        }

        if (op === undefined) {
            break;
        }

        nextToken(input, state);

        const right = parseUnaryOp(input, state);

        if (!right) {
            return;
        }

        left = {
            kind: AstNodeKind.BinaryOp,
            left,
            right,
            op,
            isNegated,
            start: left.start,
            end: right.end,
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
                        reportError("Expected space after dot", input, state);
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

const parseWrite = (input: Token[][], state: ParserState): WriteAstNode | undefined => {
    const firstToken = getToken(input, state);
    const args: WriteArgumentAstNode[] = [];

    let isInFormat = false;

    while (!matchWhitespace(input, state)) {
        const token = getToken(input, state);

        switch (token.kind) {
            case TokenKind.Hash:
                nextToken(input, state);
                args.push({ kind: AstNodeKind.HashFormatter });
                isInFormat = true;
                continue;
            case TokenKind.ExclamationPoint:
                nextToken(input, state);
                args.push({ kind: AstNodeKind.ExclamationPointFormatter });
                isInFormat = true;
                continue;
            case TokenKind.QuestionMark: {
                nextToken(input, state);

                const expression = parseExpression(input, state);

                if (!expression) {
                    return;
                }

                args.push({ kind: AstNodeKind.QuestionMarkFormatter, minColumn: expression });
                isInFormat = true;
                continue;
            }
        }

        if (!isInFormat) {
            const expression = parseExpression(input, state);

            if (!expression) {
                return;
            }

            args.push(expression);
        }

        if (!matchToken(input, state, TokenKind.Comma)) {
            break;
        }

        isInFormat = false;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.Write,
        args,
        start: firstToken.start,
        end: lastToken.start,
    };
};

const parseQuit = (input: Token[][], state: ParserState): QuitAstNode | undefined => {
    const firstToken = getToken(input, state);

    if (getWhitespace(input, state)) {
        return {
            kind: AstNodeKind.Quit,
            start: firstToken.start,
            end: firstToken.end,
        };
    }

    const returnValue = parseExpression(input, state);

    if (!returnValue) {
        return;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.Quit,
        returnValue,
        start: firstToken.start,
        end: lastToken.start,
    };
};

const parseDo = (
    input: Token[][],
    state: ParserState,
): CallAstNode | DoBlockAstNode | undefined => {
    if (!getWhitespace(input, state)) {
        return parseCall(input, state);
    }

    const firstToken = getToken(input, state);

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

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.DoBlock,
        children: block,
        start: firstToken.start,
        end: lastToken.start,
    };
};

const parseIf = (input: Token[][], state: ParserState): IfAstNode | undefined => {
    const conditions: ExpressionAstNode[] = [];
    const children: CommandAstNode[] = [];

    const firstToken = getToken(input, state);

    while (!matchWhitespace(input, state)) {
        const expression = parseExpression(input, state);

        if (!expression) {
            return;
        }

        conditions.push(expression);

        if (!matchToken(input, state, TokenKind.Comma)) {
            if (!matchWhitespace(input, state)) {
                reportError("Expected space after if conditions", input, state);
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

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.If,
        conditions,
        children,
        start: firstToken.start,
        end: lastToken.start,
    };
};

const parseElse = (input: Token[][], state: ParserState): ElseAstNode | undefined => {
    if (!matchWhitespace(input, state)) {
        reportError("Expected no arguments for else command", input, state);
        return;
    }

    const firstToken = getToken(input, state);
    const children: CommandAstNode[] = [];

    while (!matchWhitespace(input, state)) {
        const command = parseCommand(input, state);

        if (!command) {
            return;
        }

        children.push(command);
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.Else,
        children,
        start: firstToken.start,
        end: lastToken.start,
    };
};

const parseForArgument = (input: Token[][], state: ParserState): ForArgumentAstNode | undefined => {
    const variable = parseVariable(input, state);

    if (!variable) {
        return;
    }

    if (!matchToken(input, state, TokenKind.Equals)) {
        reportError("Expected equals after for loop variable", input, state);
        return;
    }

    const expressions = [];

    for (let i = 0; i < 3; i++) {
        const part = parseExpression(input, state);

        if (!part) {
            return;
        }

        expressions[i] = part;

        if (i < 2 && !matchToken(input, state, TokenKind.Colon)) {
            break;
        }
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.ForArgument,
        variable,
        expressions,
        start: variable.start,
        end: lastToken.start,
    };
};

const parseFor = (input: Token[][], state: ParserState): ForAstNode | undefined => {
    const firstToken = getToken(input, state);

    let arg: ForArgumentAstNode | undefined;

    if (!matchWhitespace(input, state)) {
        arg = parseForArgument(input, state);

        if (!matchWhitespace(input, state)) {
            reportError("Expected space after for loop argument", input, state);
            return;
        }
    }

    const children: CommandAstNode[] = [];

    while (!matchWhitespace(input, state)) {
        const command = parseCommand(input, state);

        if (!command) {
            return;
        }

        children.push(command);
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.For,
        arg,
        children,
        start: firstToken.start,
        end: lastToken.start,
    };
};

const parseSet = (input: Token[][], state: ParserState): SetAstNode | undefined => {
    const firstToken = getToken(input, state);

    const args: SetArgAstNode[] = [];

    while (!matchWhitespace(input, state)) {
        let target;

        if (matchToken(input, state, TokenKind.Dollar)) {
            target = parseBuiltin(input, state);

            if (target && target.kind !== AstNodeKind.ExtractBuiltin) {
                reportErrorAt("Extract is the only settable builtin", target, state);
                return;
            }
        } else {
            target = parseVariable(input, state);
        }

        if (!target) {
            return;
        }

        if (!matchToken(input, state, TokenKind.Equals)) {
            reportError("Expected equals after identifier in set command", input, state);
            return;
        }

        const expression = parseExpression(input, state);

        if (!expression) {
            return;
        }

        args.push({
            kind: AstNodeKind.SetArgument,
            target,
            value: expression,
            start: target.start,
            end: expression.end,
        });

        if (!matchToken(input, state, TokenKind.Comma)) {
            break;
        }
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.Set,
        args,
        start: firstToken.start,
        end: lastToken.start,
    };
};

const parseIdentifierList = (
    input: Token[][],
    state: ParserState,
): IdentifierAstNode[] | undefined => {
    const identifiers: IdentifierAstNode[] = [];

    while (!matchWhitespace(input, state)) {
        const token = matchToken(input, state, TokenKind.Identifier);

        if (!token) {
            return;
        }

        identifiers.push(makeIdentifierAstNode(token));

        if (!matchToken(input, state, TokenKind.Comma)) {
            break;
        }
    }

    return identifiers;
};

const parseNodeList = <T>(
    input: Token[][],
    state: ParserState,
    parser: (input: Token[][], state: ParserState) => T | undefined,
): T[] | undefined => {
    const nodes: T[] = [];

    while (!matchWhitespace(input, state)) {
        const expression = parser(input, state);

        if (!expression) {
            return;
        }

        nodes.push(expression);

        if (!matchToken(input, state, TokenKind.Comma)) {
            break;
        }
    }

    return nodes;
};

const parseNew = (input: Token[][], state: ParserState): NewAstNode | undefined => {
    const firstToken = getToken(input, state);

    const args = parseIdentifierList(input, state);

    if (!args) {
        return;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.New,
        args,
        start: firstToken.start,
        end: lastToken.start,
    };
};

const parseKill = (input: Token[][], state: ParserState): KillAstNode | undefined => {
    const firstToken = getToken(input, state);

    const args = parseNodeList(input, state, parseVariable);

    if (!args) {
        return;
    }

    const lastToken = getToken(input, state);

    return {
        kind: AstNodeKind.Kill,
        args,
        start: firstToken.start,
        end: lastToken.start,
    };
};

const parseMerge = (input: Token[][], state: ParserState): MergeAstNode | undefined => {
    const left = parseVariable(input, state);

    if (!left) {
        return;
    }

    if (!matchToken(input, state, TokenKind.Equals)) {
        reportError("Expected equals between variables to merge", input, state);
        return;
    }

    const right = parseVariable(input, state);

    if (!right) {
        return;
    }

    return {
        kind: AstNodeKind.Merge,
        left,
        right,
        start: left.start,
        end: right.end,
    };
};

const parseHalt = (input: Token[][], state: ParserState): HaltAstNode => {
    const token = getToken(input, state);

    return {
        kind: AstNodeKind.Halt,
        start: token.start,
        end: token.end,
    };
};

const parseCommand = (input: Token[][], state: ParserState): CommandAstNode | undefined => {
    const commentToken = matchToken(input, state, TokenKind.Comment);

    if (commentToken) {
        return {
            kind: AstNodeKind.Command,
            body: {
                kind: AstNodeKind.Comment,
                start: commentToken.start,
                end: commentToken.end,
            },
            start: commentToken.start,
            end: commentToken.end,
        };
    }

    const nameToken = matchToken(input, state, TokenKind.Identifier);

    if (!nameToken) {
        reportError("Expected command name", input, state);
        return;
    }

    let condition: ExpressionAstNode | undefined;

    if (matchToken(input, state, TokenKind.Colon)) {
        condition = parseExpression(input, state);

        if (!condition) {
            return;
        }
    }

    if (!matchWhitespace(input, state)) {
        reportError("Expected space between command and arguments", input, state);
        return;
    }

    let body: CommandBodyAstNode | undefined;

    const lowerCaseName = nameToken.text.toLowerCase();

    for (const variant of commandBodyVariants) {
        if (variant.name.startsWith(lowerCaseName)) {
            body = variant.parser(input, state);

            if (!body) {
                return;
            }
        }
    }

    if (!body) {
        reportErrorAt("Unrecognized command name", nameToken, state);
        return;
    }

    if (!matchWhitespace(input, state)) {
        reportError("Expected space between arguments and next commands", input, state);
        return;
    }

    return {
        kind: AstNodeKind.Command,
        condition,
        body,
        start: nameToken.start,
        end: body.end,
    };
};

const parseTag = (input: Token[][], state: ParserState): string[] | null | undefined => {
    let params: string[] | null = null;

    if (getToken(input, state).kind === TokenKind.LeftParen) {
        nextToken(input, state);

        params = [];

        for (let i = 0; ; i++) {
            const paramToken = matchToken(input, state, TokenKind.Identifier);

            if (!paramToken) {
                if (i > 0) {
                    reportError("Expected parameter name", input, state);
                }

                break;
            }

            params.push(paramToken.text);

            if (!matchToken(input, state, TokenKind.Comma)) {
                break;
            }
        }

        if (!matchToken(input, state, TokenKind.RightParen)) {
            reportError("Unterminated parameter list", input, state);
            return;
        }
    }

    if (!matchWhitespace(input, state)) {
        reportError("Expected space after tag name", input, state);
        return;
    }

    return params;
};

const parseTopLevel = (input: Token[][], state: ParserState): TopLevelAstNode | undefined => {
    const topLevel: TopLevelAstNode = {
        kind: AstNodeKind.TopLevel,
        tags: new Map(),
        children: [],
        start: { line: 0, column: 0 },
        end: { line: 0, column: 0 },
    };

    if (input.length > 0) {
        const lastLine = input[input.length - 1];
        topLevel.end = lastLine[lastLine.length - 1].end;
    }

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
            reportError("Expected leading space", input, state);
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

const commandBodyVariants: CommandBodyVariant[] = [
    { name: "write", parser: parseWrite },
    { name: "quit", parser: parseQuit },
    { name: "do", parser: parseDo },
    { name: "if", parser: parseIf },
    { name: "else", parser: parseElse },
    { name: "for", parser: parseFor },
    { name: "set", parser: parseSet },
    { name: "new", parser: parseNew },
    { name: "kill", parser: parseKill },
    { name: "merge", parser: parseMerge },
    { name: "halt", parser: parseHalt },
];

const builtinVariants: BuiltinVariant[] = [
    { name: "order", parser: parseOrderBuiltin },
    { name: "length", parser: parseLengthBuiltin },
    { name: "extract", parser: parseExtractBuiltin },
    { name: "select", parser: parseSelectBuiltin },
    { name: "find", parser: parseFindBuiltin },
    { name: "random", parser: parseRandomBuiltin },
];

export const parse = (input: Token[][]): ParserResult => {
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
