import { tokenize } from "./tokenizer.js";
import { MError } from "./mError.js";
import { interpret } from "./interpreter.js";

const handleErrors = (errors: MError[]) => {
    if (errors.length === 0) {
        return false;
    }

    for (const error of errors) {
        console.log(`Error at ${error.line + 1}:${error.column + 1}: ${error.message}`);
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
    d myOtherFunction()
    w "Result of identity on 123 is: ",$$identity(123),"!!!"
    w "Result of my function is: ",$$myFunction() d
    . d  w "In the block 1"
    . . w "In the inner block 1"
    . . w "In the inner block 2"
    . w "In the block 2","Still in the block"
    d
    . w "This will be executed"
    . q
    . w "And this won't"
    w "Done with main!"
    q

myFunction()
    q 1+999-500-100

myOtherFunction()
    w "In the other function"
    q 777

identity(x)
    q x
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
