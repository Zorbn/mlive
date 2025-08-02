export interface TextPosition {
    line: number;
    column: number;
}

export interface TextRange {
    start: TextPosition;
    end: TextPosition;
}
