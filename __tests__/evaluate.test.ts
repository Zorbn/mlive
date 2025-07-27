import test from "node:test";
import assert from "node:assert";
import { evaluate } from "../src/evaluate.js";
import { MError } from "../src/mError.js";

const assertScript = (script: string, output: string, errors?: MError[]) => {
    assert.deepStrictEqual(evaluate(script), {
        output,
        errors: errors ?? [],
    });
};

test("no indent", () => {
    assertScript(`w 1`, ``, [
        {
            line: 0,
            column: 2,
            message: "Expected command name",
        },
    ]);
});

test("print values", () => {
    assertScript(` w 1`, `1`);
    assertScript(` w "one"`, `one`);
});

test("simple math", () => {
    assertScript(` w 3+4-3`, `4`);
});

test("simple math with parenthesis", () => {
    assertScript(` w 3+-(4-3)`, `2`);
    assertScript(` w 3+--(4-3)`, `4`);
});

test("left to right precedence", () => {
    assertScript(` w 3+4*3`, `21`);
    assertScript(` w 3+(4*3)`, `15`);
    assertScript(` w 4+10/2`, `7`);
    assertScript(` w 4+(10/2)`, `9`);
});

test("math with spaces", () => {
    assertScript(` w 3 + 4 - 3`, ``, [
        {
            line: 0,
            column: 5,
            message: "Expected command name",
        },
    ]);
});

test("print array keys", () => {
    assertScript(
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
    assertScript(
        ` wRIte !,"Hello, world"`,
        `
Hello, world`,
    );
});

test("if statements", () => {
    assertScript(
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
    assertScript(` s x=42 w !,x`, `\n42`);
});

test("nested arrays", () => {
    assertScript(` s arr(1,2)=99 w !,arr(1,2)`, `\n99`);
});

test("string concatenation", () => {
    assertScript(
        ` s a="Hello" s b="World" w !,a_", "_b`,
        `
Hello, World`,
    );
});

test("for loops", () => {
    assertScript(
        ` f i=1:1:5 w !,"i: ",i`,
        `
i: 1
i: 2
i: 3
i: 4
i: 5`,
    );
    assertScript(
        ` f i=1:1 q:i>3  w !,"i: ",i`,
        `
i: 1
i: 2
i: 3`,
    );
    assertScript(
        ` f i=1 w !,"i: ",i`,
        `
i: 1`,
    );
});

test("logical and/or", () => {
    assertScript(` w '""&1`, `1`);
    assertScript(` w '""&""`, `0`);
    assertScript(` w ""&1`, `0`);
    assertScript(` w ""&""`, `0`);
});

test("logical or", () => {
    assertScript(` w '""!1`, `1`);
    assertScript(` w '""!""`, `1`);
    assertScript(` w ""!1`, `1`);
    assertScript(` w ""!""`, `0`);
});

test("undefined variable", () => {
    assertScript(
        ` w !,y`,
        `
`,
    );
});

test("function call with argument", () => {
    assertScript(
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
    assertScript(
        `
    ; this is a comment
    s x=5 w !,x`,
        `
5`,
    );

    assertScript(` w !,"Hi"; This comment should be in a command position`, ``, [
        {
            line: 0,
            column: 9,
            message: "Expected space between arguments and next commands",
        },
    ]);
});

test("kill one identifier", () => {
    assertScript(
        `
    n a
    s a="hi"
    n a
    s a="hello"
    w !,a
    k a
    w !,a
    k a
    w !,a`,
        `
hello
hi
`,
    );
});

test("kill all variables", () => {
    assertScript(
        `
    n a
    s a="hi"
    n a,b
    s a="hello"
    s b="there"
    k
    w a,b`,
        ``,
    );
});

test("length", () => {
    assertScript(
        `
        w !,$L("hello world")
        n letters
        s letters="abcdefghijklmnopqrstuvwxyz"
        w !,$LeNgTh(letters)`,
        `
11
26`,
    );
});
