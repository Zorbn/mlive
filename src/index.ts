import { evaluate } from "./evaluate.js";
import { MError } from "./mError.js";

const inputTextArea = document.getElementById("inputTextArea") as HTMLTextAreaElement;
const evaluateButton = document.getElementById("evaluateButton") as HTMLButtonElement;
const copyLinkButton = document.getElementById("copyLinkButton") as HTMLButtonElement;
const outputTextArea = document.getElementById("outputTextArea") as HTMLTextAreaElement;

if (window.location.search.length > 1) {
    inputTextArea.value = atob(window.location.search.slice(1));
} else {
    inputTextArea.value = `main
    f i=1:1:10 d
    . d sayHello
    . w "i: ",i,!
    w "Done!",!
    q

sayHello
    w "Hello, world!",!`;
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

        while (
            indentationEnd < inputTextArea.selectionStart &&
            [" ", "\t"].includes(inputTextArea.value[indentationEnd])
        ) {
            indentationEnd++;
        }

        const nextIndentation =
            inputTextArea.selectionStart === indentationEnd || indentationEnd > lineStart
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
