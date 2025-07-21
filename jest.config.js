export default {
    preset: "ts-jest/presets/default-esm",
    roots: ["<rootDir>/src"],
    moduleNameMapper: {
        "@src/(.*)": "<rootDir>/src/$1",
        "^(\\./.+|\\../.+).js$": "$1",
    },
};
