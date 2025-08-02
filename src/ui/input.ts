export interface Input {
    heldKeys: Set<string>;
    pressedKeys: Set<string>;
}

export const makeInput = (element: HTMLElement) => {
    const input: Input = {
        heldKeys: new Set(),
        pressedKeys: new Set(),
    };

    element.addEventListener("keydown", (event) => {
        if (!input.heldKeys.has(event.key)) {
            input.pressedKeys.add(event.key);
        }

        input.heldKeys.add(event.key);
    });

    window.addEventListener("keyup", (event) => {
        input.heldKeys.delete(event.key);
        input.pressedKeys.delete(event.key);
    });

    return input;
};

export const clearFrameInput = (input: Input) => {
    input.pressedKeys.clear();
};
