export const parse = (input) => {
    const errors = [];
    const ast = {
        kind: 0 /* AstNodeKind.TopLevel */,
        children: [],
    };
    return {
        ast,
        errors,
    };
};
//# sourceMappingURL=parser.js.map