import { tokenize } from "./tokenizer.js";
import { interpret } from "./interpreter.js";
import { parse } from "./parser.js";

export const evaluate = (script: string) => {
    const tokenizeResult = tokenize(script);

    if (tokenizeResult.errors.length > 0) {
        return {
            output: "",
            errors: tokenizeResult.errors,
        };
    }

    const parseResult = parse(tokenizeResult.tokenizedLines);

    if (parseResult.errors.length > 0 || !parseResult.ast) {
        return {
            output: "",
            errors: parseResult.errors,
        };
    }

    return interpret(parseResult.ast);
};
