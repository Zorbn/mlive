import { tokenize } from "./tokenizer.js";
import { Extern, interpret } from "./interpreter.js";
import { parse } from "./parser.js";

export const parseScript = (script: string) => {
    const tokenizeResult = tokenize(script);

    if (tokenizeResult.errors.length > 0) {
        return {
            ast: undefined,
            errors: tokenizeResult.errors,
        };
    }

    return parse(tokenizeResult.tokenizedLines);
};

export const evaluate = (script: string, externs?: Map<string, Extern>) => {
    const parseResult = parseScript(script);

    if (parseResult.errors.length > 0 || !parseResult.ast) {
        return {
            output: "",
            errors: parseResult.errors,
        };
    }

    return interpret(parseResult.ast, externs);
};
