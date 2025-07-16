import { tokenize } from "./tokenizer.js";
import { MSyntaxError } from "./mSyntaxError.js";
import { interpret } from "./interpreter.js";

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

    const interpretResult = interpret(tokenizeResult.tokenizedLines);

    if (handleErrors(interpretResult.errors)) {
        return;
    }

    console.log("Evaluation completed successfully!");
};

document.getElementById("evaluateButton")?.addEventListener("click", () => {
    evaluate(`
    write "hi"

SCRIPT
    QUIT

main
    wRIte "Hello, world"
    w "Result of my function is: " d
    . d  w "In the block 1"
    . . w "In the inner block 1"
    . . w "In the inner block 2"
    . w "In the block 2","Still in the block"
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
