import test from "node:test";
import assert from "node:assert";
import { evaluate } from "../src/evaluate.js";
import { MError } from "../src/mError.js";

const expectScript = (script: string, output: string, errors?: MError[]) => {
    assert.deepStrictEqual(evaluate(script), {
        output,
        errors: errors ?? [],
    });
};

test("no indent", () => {
    expectScript(`w 1`, ``, [
        {
            line: 0,
            column: 2,
            message: "Expected command name",
        },
    ]);
});

test("print values", () => {
    expectScript(` w 1`, `1`);
    expectScript(` w "one"`, `one`);
});

test("simple math", () => {
    expectScript(` w 3+4-3`, `4`);
});

test("simple math with parenthesis", () => {
    expectScript(` w 3+-(4-3)`, `2`);
});

test("left to right precedence", () => {
    expectScript(` w 3+4*3`, `21`);
    expectScript(` w 3+(4*3)`, `15`);
    expectScript(` w 4+10/2`, `7`);
    expectScript(` w 4+(10/2)`, `9`);
});

test("math with spaces", () => {
    expectScript(` w 3 + 4 - 3`, ``, [
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
    q`,
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

test("variable assignment and retrieval", () => {
    expectScript(` s x=42 w !,x`, `\n42`);
});

test("nested arrays", () => {
    expectScript(` s arr(1,2)=99 w !,arr(1,2)`, `\n99`);
});

test("string concatenation", () => {
    expectScript(
        ` s a="Hello" s b="World" w !,a_", "_b`,
        `
Hello, World`,
    );
});

test("for loop", () => {
    expectScript(
        ` f i=1:1:3 w !,"i=",i`,
        `
i=1
i=2
i=3`,
    );
});

test("undefined variable", () => {
    expectScript(` w !,y`, `\n`);
});

test("function call with argument", () => {
    expectScript(
        `
    d greet("Test") q

greet(name)
    w !,"Hello, ",name
    q`,
        `
Hello, Test`,
    );
});

test("comments", () => {
    expectScript(
        `
    ; this is a comment
    s x=5 w !,x`,
        `
5`,
    );
});
