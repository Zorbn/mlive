import { MError } from "./mError.js";
import {
    AstNode,
    AstNodeKind,
    BinaryOp,
    CallAstNode,
    CommandAstNode,
    DoBlockAstNode,
    ExpressionAstNode,
    QuitAstNode,
    TopLevelAstNode,
    WriteAstNode,
} from "./parser.js";
import { Token, TokenKind } from "./tokenizer.js";

// TODO: Most important/unique things to interpret right now:
// if: controls the whole rest of the line like for,
// unary/binary ops: simple precedence (unary ops before binary ops, left to right),
// negation of operators: '< means >=,
// builtins like $O: $O(array("subscript")),

type MValue = string | number;

const mValueToNumber = (value: MValue): number => {
    if (typeof value === "string") {
        // TODO: Implement accurate conversion.
        const number = parseFloat(value);

        return isNaN(number) ? 0 : number;
    }

    return value;
};

interface Tag {
    line: number;
    params: string[];
}

interface InterpreterState {
    ast: TopLevelAstNode;
    valueStack: MValue[];
    environmentStack: Map<string, MValue>[];
    output: string[];
    errors: MError[];
}

const enum CommandResult {
    Continue,
    Quit,
    Halt,
}

const lookupVariable = (name: string, state: InterpreterState): MValue => {
    for (let i = state.environmentStack.length - 1; i >= 0; i--) {
        const value = state.environmentStack[i].get(name);

        if (value !== undefined) {
            return value;
        }
    }

    return "";
};

const reportError = (message: string, state: InterpreterState) => {
    console.log(message, state);
    state.errors.push({
        message,
        // TODO: These values need to be stored in the AST to be available here.
        line: 0,
        column: 0,
    });
};

const interpretCall = (
    node: CallAstNode,
    state: InterpreterState,
    hasReturnValue: boolean,
): boolean => {
    const tag = state.ast.tags.get(node.name.text);

    if (tag === undefined) {
        reportError(`Tag \"${node.name.text}\" not found`, state);
        return false;
    }

    let didPushEnvironment = false;

    if (tag.params) {
        for (let i = 0; i < tag.params.length; i++) {
            if (!interpretExpression(node.args[i], state)) {
                break;
            }

            if (!didPushEnvironment) {
                state.environmentStack.push(new Map());
                didPushEnvironment = true;
            }

            state.environmentStack[state.environmentStack.length - 1].set(
                tag.params[i],
                state.valueStack.pop()!,
            );
        }
    }

    const callEnvironmentStackLength = state.environmentStack.length;
    const callValueStackLength = state.valueStack.length;

    interpretTopLevel(state, tag.index);

    if (hasReturnValue) {
        if (state.valueStack.length === callValueStackLength) {
            state.valueStack.push("");
        }
    } else {
        state.valueStack.length = callValueStackLength;
    }

    state.environmentStack.length = callEnvironmentStackLength;

    return true;
};

const interpretExpression = (node: ExpressionAstNode, state: InterpreterState): boolean => {
    switch (node.kind) {
        case AstNodeKind.Identifier: {
            const value = lookupVariable(node.text, state);
            state.valueStack.push(value);
            break;
        }
        case AstNodeKind.NumberLiteral:
            state.valueStack.push(node.value);
            break;
        case AstNodeKind.StringLiteral:
            state.valueStack.push(node.value);
            break;
        case AstNodeKind.Call:
            return interpretCall(node, state, true);
        case AstNodeKind.BinaryOp: {
            if (!interpretExpression(node.left, state)) {
                return false;
            }

            if (!interpretExpression(node.right, state)) {
                return false;
            }

            const right = state.valueStack.pop()!;
            const left = state.valueStack.pop()!;

            switch (node.op) {
                case BinaryOp.Plus:
                    state.valueStack.push(mValueToNumber(left) + mValueToNumber(right));
                    break;
                case BinaryOp.Minus:
                    state.valueStack.push(mValueToNumber(left) - mValueToNumber(right));
                    break;
                default:
                    reportError("Unimplemented binary op", state);
                    break;
            }

            break;
        }
    }

    return true;
};

const interpretWrite = (node: WriteAstNode, state: InterpreterState): boolean => {
    // TODO: Support formatting with ?.

    for (const arg of node.args) {
        switch (arg.kind) {
            case AstNodeKind.HashFormatter:
                state.output.length = 0;
                break;
            case AstNodeKind.ExclamationPointFormatter:
                state.output.push("\n");
                break;
            default:
                if (!interpretExpression(arg, state)) {
                    return false;
                }

                state.output.push(state.valueStack.pop()!.toString());
                break;
        }
    }

    return true;
};

const interpretQuit = (node: QuitAstNode, state: InterpreterState): boolean => {
    if (!node.returnValue) {
        return true;
    }

    return interpretExpression(node.returnValue, state);
};

const interpretDoBlock = (node: DoBlockAstNode, state: InterpreterState): boolean => {
    const startEnvironmentStackLength = state.environmentStack.length;

    for (const command of node.children) {
        const blockResult = interpretCommand(command, state);

        if (blockResult === CommandResult.Quit) {
            break;
        }

        if (blockResult == CommandResult.Halt) {
            return false;
        }
    }

    state.environmentStack.length = startEnvironmentStackLength;

    return true;
};

const interpretCommand = (node: CommandAstNode, state: InterpreterState): CommandResult => {
    switch (node.kind) {
        case AstNodeKind.Write:
            return interpretWrite(node, state) ? CommandResult.Continue : CommandResult.Halt;
        case AstNodeKind.Quit:
            return interpretQuit(node, state) ? CommandResult.Quit : CommandResult.Halt;
        case AstNodeKind.DoBlock:
            return interpretDoBlock(node, state) ? CommandResult.Continue : CommandResult.Halt;
        case AstNodeKind.Call:
            return interpretCall(node, state, false) ? CommandResult.Continue : CommandResult.Halt;
        default:
            reportError("Unrecognized command", state);
            return CommandResult.Halt;
    }
};

const interpretTopLevel = (state: InterpreterState, start: number) => {
    for (let i = start; i < state.ast.children.length; i++) {
        const result = interpretCommand(state.ast.children[i], state);

        if (result == CommandResult.Quit || result == CommandResult.Halt) {
            break;
        }
    }
};

export const interpret = (ast: TopLevelAstNode) => {
    const state = {
        ast,
        valueStack: [],
        environmentStack: [],
        output: [],
        errors: [],
    };

    interpretTopLevel(state, ast.tags.get("main")!.index);

    return {
        output: state.output.join(""),
        errors: state.errors,
    };
};
