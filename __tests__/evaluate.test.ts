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

test("division", () => {
    assertScript(` w 5/2`, `2.5`);
    assertScript(` w 5\\2`, `2`);
});

test("modulo", () => {
    assertScript(` w 5#2`, `1`);
    assertScript(` w 5.5#2`, `1.5`);
    assertScript(` w -5#2`, `-1`);
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

test("merge", () => {
    assertScript(
        `
    s dst("a")="1",dst("b")="2",dst("c")="3"
    s src("c")="4",src("d")="5"
    m dst=src
    n key
    f  s key=$O(dst(key)) q:key=""  w !,"Key: ",key," -> Value: ",dst(key)`,
        `
Key: a -> Value: 1
Key: b -> Value: 2
Key: c -> Value: 4
Key: d -> Value: 5`,
    );
});

test("merge into subscript", () => {
    assertScript(
        `
    s dst("a")="1",dst("b")="2",dst("c")="3",dst("d")="4"
    s src("c")="4",src("d")="5"
    k dst("b")
    m dst("d")=src
    n key
    f  s key=$O(dst(key)) q:key=""  w !,"Key: ",key," -> Value: ",dst(key)
    f  s key=$O(dst("d",key)) q:key=""  w !,"Within ""d"" { Key: ",key," -> Value: ",dst("d",key)," }"`,
        `
Key: a -> Value: 1
Key: c -> Value: 3
Key: d -> Value: 4
Within "d" { Key: c -> Value: 4 }
Within "d" { Key: d -> Value: 5 }`,
    );
});

test("merge overlapping", () => {
    assertScript(
        `
    s arr("a")="1",arr("b")="2",arr("c")="3"
    s arr("inner","a")="4"
    m arr=arr("inner")`,
        ``,
        [
            {
                line: 3,
                column: 6,
                message: "Cannot merge overlapping variables",
            },
        ],
    );
});

test("extract", () => {
    assertScript(
        `
    s string="Hello, world!"
    w !,$E(string)
    w !,$E(string,6)
    w !,$E(string,3,5)`,
        `
H
,
llo`,
    );
});

test("set extract", () => {
    assertScript(
        `
    s string="Hello, world!"
    s $E(string)="A"
    w !,string
    s $E(string,6)="!"
    w !,string
    s arr("string")=string
    s $E(arr("string"))="B"
    w !,arr("string")
    s $E(string,3,5)="110"
    w !,string`,
        `
Aello, world!
Aello! world!
Bello! world!
Ae110! world!`,
    );
});

test("set non settable builtins", () => {
    assertScript(
        `
    s arr("a")="b"
    s $O(arr("a"))="c"`,
        ``,
        [
            {
                line: 2,
                column: 7,
                message: "Extract is the only settable builtin",
            },
        ],
    );

    assertScript(
        `
    s string="Hello, world!"
    s $L(string)="Goodbye, world!"`,
        ``,
        [
            {
                line: 2,
                column: 7,
                message: "Extract is the only settable builtin",
            },
        ],
    );
});

test("select", () => {
    assertScript(
        `
    s var=$S(0:"a",1&1:"b",1!1:"c")
    w var`,
        `b`,
    );

    assertScript(
        `
    s var=$S(0:"a",1&0:"b",0!0:"c")`,
        ``,
        [
            {
                line: 1,
                column: 11,
                message: "All select conditions were false",
            },
        ],
    );
});

test("halt", () => {
    assertScript(
        `
    w "a"
    h
    w "b"`,
        `a`,
    );
});
