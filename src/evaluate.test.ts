import { evaluate } from "./evaluate.js";

test("no indent", () => {
    expect(evaluate("w 1")).toEqual({
        output: "",
        errors: [
            {
                line: 0,
                column: 2,
                message: "Expected command name",
            },
        ],
    });
});

test("print values", () => {
    expect(evaluate(" w 1")).toEqual({
        output: "1",
        errors: [],
    });

    expect(evaluate(` w "one"`)).toEqual({
        output: "one",
        errors: [],
    });
});

test("simple math", () => {
    expect(evaluate(" w 3+4-3")).toEqual({
        output: "4",
        errors: [],
    });
});
