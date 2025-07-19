interface MArrayKeyValuePair {
    key: string;
    value: MValue;
}

export interface MArray {
    value: MScalar;
    children?: MArrayKeyValuePair[];
}

export type MScalar = string | number;
export type MValue = MScalar | MArray;

export const mValueToNumber = (value: MValue): number => {
    if (typeof value === "object") {
        return mValueToNumber(value.value);
    }

    if (typeof value === "string") {
        // TODO: Implement accurate conversion.
        const number = parseFloat(value);

        return isNaN(number) ? 0 : number;
    }

    return value;
};

export const mValueToString = (value: MValue): string => {
    if (typeof value === "object") {
        return mValueToString(value.value);
    }

    if (typeof value === "number") {
        return value.toString();
    }

    return value;
};

export const mValueToScalar = (value: MValue): MScalar => {
    if (typeof value === "object") {
        return value.value;
    }

    return value;
};

export const mArraySet = (array: MArray, key: string, value: MValue) => {
    const pair = {
        key,
        value,
    };

    if (!array.children) {
        array.children = [pair];
        return;
    }

    // TODO: This could use a binary search because keys are sorted.
    for (let i = 0; i < array.children.length; i++) {
        const pair = array.children[i];

        if (pair.key === key) {
            pair.value = value;
            return;
        }

        if (key < pair.key) {
            array.children.splice(i, 0, pair);
            return;
        }
    }

    array.children.push(pair);
};

export const mArrayGet = (array: MArray, key: string) => {
    if (!array.children) {
        return "";
    }

    // TODO: This could use a binary search because keys are sorted.
    for (const pair of array.children) {
        if (pair.key === key) {
            return pair.value;
        }

        if (key < pair.key) {
            return "";
        }
    }
};
