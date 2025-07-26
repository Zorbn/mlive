import { evaluate } from "./evaluate.js";
import { MError } from "./mError.js";

const inputTextArea = document.getElementById("inputTextArea") as HTMLTextAreaElement;
const evaluateButton = document.getElementById("evaluateButton") as HTMLButtonElement;
const copyLinkButton = document.getElementById("copyLinkButton") as HTMLButtonElement;
const outputTextArea = document.getElementById("outputTextArea") as HTMLTextAreaElement;

inputTextArea.value = `    write !,"hi"

SCRIPT
    QUIT

main n var1,var2,varArr
    s var1="a",var2="b",varArr(1)="a",varArr(2)="b",varArr(3,"hello")="hello there",varArr(3,"hi")="hi there"
    d printArrayKeys(.varArr)
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
    i 100=100,1,3'>-2 d  w !,"The first condition is true"
    . w !,"Hi from within condition 1"
    e  w !,"The first condition is false"
    i 77.7=77.7,430>123,'0 d  w !,"The second condition is true"
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

printArrayKeys(array)
    n key
    f  s key=$O(array(key)) q:key=""  w !,"Key: ",key
    q

identity(x)
    q x`;

if (window.location.search.length > 1) {
    inputTextArea.value = atob(window.location.search.slice(1));
}

const insertIntoTextArea = (text: string, textArea: HTMLTextAreaElement) => {
    const textBefore = textArea.value.slice(0, textArea.selectionStart);
    const textAfter = textArea.value.slice(textArea.selectionEnd);

    const selectionPosition = textArea.selectionStart + text.length;
    textArea.value = textBefore + text + textAfter;
    textArea.selectionStart = textArea.selectionEnd = selectionPosition;

    const event = new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        data: text,
    });

    textArea.dispatchEvent(event);
};

// Prevent MacOS "  " -> ". " conversion when typing in the input text area.
// It's common to need to type two spaces in M code.
inputTextArea.addEventListener("beforeinput", (event) => {
    const inputEvent = event as InputEvent;

    if (inputEvent.data !== ". ") {
        return;
    }

    event.preventDefault();
    insertIntoTextArea("  ", inputTextArea);
});

inputTextArea.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();

        let lineStart = inputTextArea.selectionStart;

        while (lineStart > 0 && inputTextArea.value[lineStart - 1] !== "\n") {
            lineStart--;
        }

        let indentationEnd = lineStart;

        while ([" ", "\t"].includes(inputTextArea.value[indentationEnd])) {
            indentationEnd++;
        }

        const nextIndentation =
            indentationEnd > lineStart
                ? inputTextArea.value.slice(lineStart, indentationEnd)
                : "    ";

        insertIntoTextArea("\n" + nextIndentation, inputTextArea);
        return;
    }

    if (event.key === "Tab") {
        event.preventDefault();
        insertIntoTextArea("    ", inputTextArea);
        return;
    }

    if (event.key !== "Backspace") {
        return;
    }

    if (
        inputTextArea.selectionStart !== inputTextArea.selectionEnd ||
        inputTextArea.selectionStart < 4
    ) {
        return;
    }

    const indentStart = inputTextArea.selectionStart - 4;

    for (let i = indentStart; i < inputTextArea.selectionStart; i++) {
        if (inputTextArea.value[i] !== " ") {
            return;
        }
    }

    event.preventDefault();

    const textBefore = inputTextArea.value.slice(0, indentStart);
    const textAfter = inputTextArea.value.slice(inputTextArea.selectionEnd);

    inputTextArea.value = textBefore + textAfter;
    inputTextArea.selectionStart = inputTextArea.selectionEnd = indentStart;
});

const handleErrors = (errors: MError[]) => {
    if (errors.length === 0) {
        return false;
    }

    outputTextArea.value = errors
        .map((error) => `Error at ${error.line + 1}:${error.column + 1}: ${error.message}`)
        .join("\n");

    return true;
};

evaluateButton.addEventListener("click", () => {
    const start = performance.now();

    const result = evaluate(inputTextArea.value);

    const end = performance.now();

    if (!handleErrors(result.errors)) {
        console.log(`Evaluation completed successfully in ${end - start}ms!`);
        outputTextArea.value = result.output;
    }
});

copyLinkButton.addEventListener("click", () => {
    const encodedScript = btoa(inputTextArea.value);
    navigator.clipboard.writeText(`${window.location.origin}/?${encodedScript}`);
});
