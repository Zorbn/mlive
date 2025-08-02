import { parseScript } from "../language/evaluate.js";
import { Extern, interpretTag, makeInterpreterState } from "../language/interpreter.js";
import { MValue, mValueToNumber, mValueToString } from "../language/mValue.js";
import { MError } from "../language/mError.js";
import { clearFrameInput, makeInput } from "./input.js";

const inputTextArea = document.getElementById("inputTextArea") as HTMLTextAreaElement;
const runButton = document.getElementById("runButton") as HTMLButtonElement;
const clearButton = document.getElementById("clearButton") as HTMLButtonElement;
const copyLinkButton = document.getElementById("copyLinkButton") as HTMLButtonElement;
const outputTextArea = document.getElementById("outputTextArea") as HTMLTextAreaElement;

const canvas = document.getElementsByTagName("canvas")[0] as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const input = makeInput(canvas);

const clearCanvas = () => {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
};

clearCanvas();

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

    outputTextArea.value += errors
        .map((error) => `Error at ${error.line + 1}:${error.column + 1}: ${error.message}`)
        .join("\n");

    return true;
};

const externs: Map<string, Extern> = new Map([
    [
        "setFillStyle",
        (style: MValue) => {
            ctx.fillStyle = mValueToString(style);
        },
    ],
    [
        "fillRect",
        (x: MValue, y: MValue, width: MValue, height: MValue) => {
            ctx.fillRect(
                mValueToNumber(x),
                mValueToNumber(y),
                mValueToNumber(width),
                mValueToNumber(height),
            );
        },
    ],
    ["isKeyHeld", (key: MValue) => (input.heldKeys.has(mValueToString(key)) ? 1 : 0)],
    ["isKeyPressed", (key: MValue) => (input.pressedKeys.has(mValueToString(key)) ? 1 : 0)],
]);

let isRunning = false;
let output = "";

const setIsRunning = (value: boolean) => {
    isRunning = value;

    if (isRunning) {
        runButton.textContent = "End";
    } else {
        runButton.textContent = "Run";
    }
};

const pushOutput = (values: string[]) => {
    output += values.join("");
    outputTextArea.value = output;
    outputTextArea.scrollTop = outputTextArea.scrollHeight;
};

const clearOutput = () => {
    output = "";
    outputTextArea.value = output;
};

runButton.addEventListener("click", () => {
    if (!isRunning) {
        evaluate();
    } else {
        setIsRunning(false);
    }
});

const evaluate = () => {
    clearOutput();
    clearCanvas();

    const start = performance.now();

    const parseResult = parseScript(inputTextArea.value);

    if (handleErrors(parseResult.errors)) {
        return;
    }

    const ast = parseResult.ast!;
    const state = makeInterpreterState(ast, externs);

    clearFrameInput(input);
    let didHalt = interpretTag(ast.tags.get("main"), [], state) === undefined;

    if (handleErrors(state.errors) || didHalt) {
        return;
    }

    pushOutput(state.output);

    const frameTag = ast.tags.get("frame");

    if (!frameTag) {
        const end = performance.now();
        console.log(`Evaluation completed successfully in ${end - start}ms!`);

        return;
    }

    let lastTime: number;

    const onFrame = (time: number) => {
        if (!isRunning) {
            return;
        }

        lastTime ??= time;
        const delta = (time - lastTime) * 0.001;
        lastTime = time;

        state.output.length = 0;
        clearFrameInput(input);
        didHalt = interpretTag(frameTag, [delta], state) === undefined;

        if (handleErrors(state.errors) || didHalt) {
            isRunning = false;
            return;
        }

        pushOutput(state.output);
        requestAnimationFrame(onFrame);
    };

    setIsRunning(true);
    requestAnimationFrame(onFrame);
};

clearButton.addEventListener("click", () => {
    setIsRunning(false);
    clearOutput();
    clearCanvas();
});

copyLinkButton.addEventListener("click", () => {
    const encodedScript = btoa(inputTextArea.value);
    navigator.clipboard.writeText(`${window.location.origin}/?${encodedScript}`);
});
