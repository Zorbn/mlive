import { parseScript } from "../language/evaluate.js";
import { Extern, interpretTag, makeInterpreterState } from "../language/interpreter.js";
import { MValue, mValueToNumber, mValueToString } from "../language/mValue.js";
import { MError } from "../language/mError.js";
import { clearFrameInput, makeInput } from "./input.js";
import { addCodeEditingListeners } from "./textArea.js";

// TODO:
// Actually use the end field of AST nodes for error reporting
// Implement ** (power) operator and possibly <=, >=

const inputTextArea = document.getElementById("inputTextArea") as HTMLTextAreaElement;
const runButton = document.getElementById("runButton") as HTMLButtonElement;
const clearButton = document.getElementById("clearButton") as HTMLButtonElement;
const copyLinkButton = document.getElementById("copyLinkButton") as HTMLButtonElement;
const outputTextArea = document.getElementById("outputTextArea") as HTMLTextAreaElement;

const canvas = document.getElementsByTagName("canvas")[0] as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const input = makeInput(canvas);

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
    ["sin", (x: MValue) => Math.sin(mValueToNumber(x))],
    ["cos", (x: MValue) => Math.cos(mValueToNumber(x))],
    ["floor", (x: MValue) => Math.floor(mValueToNumber(x))],
    ["ceil", (x: MValue) => Math.ceil(mValueToNumber(x))],
    ["min", (x: MValue) => Math.min(mValueToNumber(x))],
    ["max", (x: MValue) => Math.max(mValueToNumber(x))],
]);

let isRunning = false;
let output = "";

const clearCanvas = () => {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const handleErrors = (errors: MError[]) => {
    if (errors.length === 0) {
        return false;
    }

    outputTextArea.value += errors
        .map((error) => `Error at ${error.line + 1}:${error.column + 1}: ${error.message}`)
        .join("\n");

    return true;
};

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

addCodeEditingListeners(inputTextArea);

runButton.addEventListener("click", () => {
    if (!isRunning) {
        evaluate();
    } else {
        setIsRunning(false);
    }
});

clearButton.addEventListener("click", () => {
    setIsRunning(false);
    clearOutput();
    clearCanvas();
});

copyLinkButton.addEventListener("click", () => {
    const encodedScript = btoa(inputTextArea.value);
    navigator.clipboard.writeText(`${window.location.origin}/?${encodedScript}`);
});

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

clearCanvas();
