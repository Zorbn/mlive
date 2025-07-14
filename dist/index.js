import { tokenize } from "./tokenizer.js";
const script = `
SCRIPT
    QUIT

main
    wRIte "Hello, world"
    w "Result of my function is: ",$$myFunction()
    q

myFunction()
    q 777
`;
const tokenizeResult = tokenize(script);
if (tokenizeResult.errors.length > 0) {
    for (const error of tokenizeResult.errors) {
        console.log(`Syntax error at ${error.line}:${error.column}: ${error.message}`);
    }
}
else {
    console.log(tokenizeResult.tokenizedLines);
}
//# sourceMappingURL=index.js.map