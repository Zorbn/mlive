import { evaluate } from "./evaluate.js";
import { MError } from "./mError.js";

const expectScript = (script: string, output: string, errors?: MError[]) => {
    expect(evaluate(script)).toEqual({
        output,
        errors: errors ?? [],
    });
};

test("no indent", () => {
    expectScript("w 1", "", [
        {
            line: 0,
            column: 2,
            message: "Expected command name",
        },
    ]);
});

test("print values", () => {
    expectScript(" w 1", "1");
    expectScript(` w "one"`, "one");
});

test("simple math", () => {
    expectScript(" w 3+4-3", "4");
});

test("math with spaces", () => {
    expectScript(" w 3 + 4 - 3", "", [
        {
            line: 0,
            column: 5,
            message: "Expected command name",
        },
    ]);
});

test("print array keys", () => {
    expectScript(
        `
main n varArr
    s varArr(1)="a",varArr(2)="b",varArr(3,"hello")="hello there",varArr(3,"hi")="hi there"
    w !,"After VarArr(3, ""hello"") is VarArr(""",$O(varArr(3,"hello")),""")"
    d printArrayKeys(.varArr)
    q

printArrayKeys(array)
    n key
    f  s key=$O(array(key)) q:key=""  w !,"Key: ",key
    q
    `,
        `
After VarArr(3, "hello") is VarArr("hi")
Key: 1
Key: 2
Key: 3`,
    );
});

test("hello world", () => {
    expectScript(
        ` wRIte !,"Hello, world"`,
        `
Hello, world`,
    );
});

test("if statements", () => {
    expectScript(
        `
    i 100=100,1,3'>-2 d  w !,"The first condition is true"
    . w !,"Hi from within condition 1"
    e  w !,"The first condition is false"
    i 77.7=77.7,430>123,'0 d  w !,"The second condition is true"
    . w !,"Hi from within condition 2"
    e  w !,"The second condition is false"`,
        `
The first condition is false
Hi from within condition 2
The second condition is true`,
    );
});
