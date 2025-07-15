import { tokenize } from "./tokenizer.js";
import { MSyntaxError } from "./mSyntaxError.js";
import { parse } from "./parser.js";

const handleErrors = (errors: MSyntaxError[]) => {
    if (errors.length === 0) {
        return false;
    }

    for (const error of errors) {
        console.log(`Syntax error at ${error.line + 1}:${error.column + 1}: ${error.message}`);
    }

    return true;
};

const evaluate = (script: string) => {
    const tokenizeResult = tokenize(script);

    if (handleErrors(tokenizeResult.errors)) {
        return;
    }

    console.log(tokenizeResult.tokenizedLines);

    const parseResult = parse(tokenizeResult.tokenizedLines);

    if (handleErrors(parseResult.errors)) {
        return;
    }

    console.log(parseResult.ast);
};

document.getElementById("evaluateButton")?.addEventListener("click", () => {
    evaluate(`
    write "hi"

SCRIPT
    QUIT

main
    wRIte "Hello, world"
    w "Result of my function is: "
    q

myFunction()
    q 777
    `);
});

/*
`
    write "hi"

SCRIPT
    QUIT

main n aVar
    wRIte "Hello, world"
    w "Result of my function is: ",$$myFunction()
    q

myFunction()
    q 777
    `
*/
