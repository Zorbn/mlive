import { tokenize } from "./tokenizer.js";
import { MError } from "./mError.js";
import { interpret } from "./interpreter.js";
import { parse } from "./parser.js";

const inputTextArea = document.getElementById("inputTextArea") as HTMLTextAreaElement;
const evaluateButton = document.getElementById("evaluateButton") as HTMLButtonElement;
const outputTextArea = document.getElementById("outputTextArea") as HTMLTextAreaElement;

inputTextArea.value = `    write !,"hi"

SCRIPT
    QUIT

main n var1,var2
    s var1="a",var2="b"
    w !,"Var1: ",var1,", Var 2: ",var2
    wRIte !,"Hello, world"
    d myOtherFunction()
    w !,"Result of identity on 123 is: """,$$identity(123),"""!!!"
    w !,"Result of my function is: ",$$myFunction() d
    . d  w !,"In the block 1"
    . . w !,"In the inner block 1"
    . . w !,"In the inner block 2"
    . w !,"In the block 2",!,"Still in the block"
    d
    . w !,"This will be executed"
    . q
    . w !,"And this won't"
    i 1,1,0 d  w !,"This is false"
    . w !,"Hi from within condition 1"
    i 1,1,1 d  w !,"This is true"
    . w !,"Hi from within condition 2"
    w !,"Done with main!"
    q

myFunction()
    q 1+999-500-100

myOtherFunction()
    w !,"In the other function"
    q 777

identity(x)
    q x`;

const handleErrors = (errors: MError[]) => {
    if (errors.length === 0) {
        return false;
    }

    outputTextArea.value = errors
        .map((error) => `Error at ${error.line + 1}:${error.column + 1}: ${error.message}`)
        .join("\n");

    return true;
};

const evaluate = (script: string) => {
    const tokenizeResult = tokenize(script);

    if (handleErrors(tokenizeResult.errors)) {
        return;
    }

    console.log(tokenizeResult.tokenizedLines);

    const parseResult = parse(tokenizeResult.tokenizedLines);

    if (handleErrors(parseResult.errors) || !parseResult.ast) {
        return;
    }

    console.log(parseResult.ast);

    const interpretResult = interpret(parseResult.ast);

    if (handleErrors(interpretResult.errors)) {
        return;
    }

    outputTextArea.value = interpretResult.output;
    console.log("Evaluation completed successfully!");
};

evaluateButton.addEventListener("click", () => {
    evaluate(inputTextArea.value);
});
