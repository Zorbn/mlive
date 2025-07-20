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

main n var1,var2,varArr
    s var1="a",var2="b",varArr(1)="a",varArr(2)="b",varArr(3,"hello")="hello there",varArr(3,"hi")="hi there"
    d printArray1and2(varArr)
    d printArray1and2(.varArr)
    w !,"Var 1: ",var1,", Var 2: ",var2
    d updateVars(.var1,var2)
    w !,"Var 1: ",var1,", Var 2: ",var2
    d updateVars(var1,.var2)
    w !,"Var 1: ",var1,", Var 2: ",var2
    w !,"VarArr 1: ",varArr(1),", VarArr 2: ",varArr(2)
    w !,"VarArr 3, Hi: ",varArr(3,"hi"),", VarArr 3, Hello: ",varArr(3,"hello")
    w !,"After VarArr(1) is VarArr(",$O(varArr(1)),")"
    w !,"After VarArr(3, ""hello"") is VarArr(""",$O(varArr(3,"hello")),""")"
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
    i 1,1,0 d  w !,"The first condition is true"
    . w !,"Hi from within condition 1"
    e  w !,"The first condition is false"
    i 1,1,1 d  w !,"The second condition is true"
    . w !,"Hi from within condition 2"
    e  w !,"The second condition is false"
    w !,"Done with main!"
    q

printArray1and2(array) w !,"Array 1: ",array(1) d printArray2(.array) q

printArray2(array) w !,"Array 2: ",array(2) q

updateVars(firstVar,secondVar)
    s firstVar="updated a"
    s secondVar="update b"
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
