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

export const addCodeEditingListeners = (textArea: HTMLTextAreaElement) => {
    // Prevent MacOS "  " -> ". " conversion when typing in the input text area.
    // It's common to need to type two spaces in M code.
    textArea.addEventListener("beforeinput", (event) => {
        const inputEvent = event as InputEvent;

        if (inputEvent.data !== ". ") {
            return;
        }

        event.preventDefault();
        insertIntoTextArea("  ", textArea);
    });

    textArea.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();

            let lineStart = textArea.selectionStart;

            while (lineStart > 0 && textArea.value[lineStart - 1] !== "\n") {
                lineStart--;
            }

            let indentationEnd = lineStart;

            while (
                indentationEnd < textArea.selectionStart &&
                [" ", "\t"].includes(textArea.value[indentationEnd])
            ) {
                indentationEnd++;
            }

            const nextIndentation =
                textArea.selectionStart === indentationEnd || indentationEnd > lineStart
                    ? textArea.value.slice(lineStart, indentationEnd)
                    : "    ";

            insertIntoTextArea("\n" + nextIndentation, textArea);
            return;
        }

        if (event.key === "Tab") {
            event.preventDefault();
            insertIntoTextArea("    ", textArea);
            return;
        }

        if (event.key !== "Backspace") {
            return;
        }

        if (textArea.selectionStart !== textArea.selectionEnd || textArea.selectionStart < 4) {
            return;
        }

        const indentStart = textArea.selectionStart - 4;

        for (let i = indentStart; i < textArea.selectionStart; i++) {
            if (textArea.value[i] !== " ") {
                return;
            }
        }

        event.preventDefault();

        const textBefore = textArea.value.slice(0, indentStart);
        const textAfter = textArea.value.slice(textArea.selectionEnd);

        textArea.value = textBefore + textAfter;
        textArea.selectionStart = textArea.selectionEnd = indentStart;
    });
};
