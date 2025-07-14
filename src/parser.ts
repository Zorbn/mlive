import { SyntaxError } from "./syntaxError.js";
import { Token } from "./tokenizer.js";

const enum AstNodeKind {
    TopLevel,
    Tag,
    Command,
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
}

interface CommandAstNode {
    kind: AstNodeKind.Tag;
    name: IdentifierAstNode;
    arguments: ExpressionAstNode[];
}

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

type AstNode =
    | TopLevelAstNode
    | TagAstNode
    | CommandAstNode
    | ExpressionAstNode
    | IdentifierAstNode
    | NumberLiteralAstNode
    | StringLiteralAstNode;

export const parse = (input: Token[][]) => {
    const errors: SyntaxError[] = [];
    const ast: TopLevelAstNode = {
        kind: AstNodeKind.TopLevel,
        children: [],
    };

    return {
        ast,
        errors,
    };
};
