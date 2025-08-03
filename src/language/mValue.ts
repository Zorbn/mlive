interface MArrayKeyValuePair {
    key: string;
    value: MValue;
}

export const enum MObjectKind {
    Array,
    ArrayReference,
    EnvironmentReference,
}

export interface MArray {
    kind: MObjectKind.Array;
    value: MScalar;
    children?: MArrayKeyValuePair[];
}

export interface MArrayReference {
    kind: MObjectKind.ArrayReference;
    array: MArray;
    key: string;
}

export interface MEnvironmentReference {
    kind: MObjectKind.EnvironmentReference;
    environment: Environment;
    name: string;
}

export type MReference = MArrayReference | MEnvironmentReference;
export type Environment = Map<string, MValue | MReference>;

export type MScalar = string | number;
export type MValue = MScalar | MArray;

export const mValueToNumber = (value: MValue): number => {
    if (typeof value === "object") {
        return mValueToNumber(value.value);
    }

    if (typeof value === "string") {
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

export const mValueToArray = (value: MValue): MArray => {
    if (typeof value === "object") {
        return value;
    }

    return {
        kind: MObjectKind.Array,
        value,
    };
};

export const mValueCopy = (value: MValue): MValue => {
    if (typeof value !== "object") {
        return value;
    }

    const copy: MArray = {
        kind: MObjectKind.Array,
        value: value.value,
    };

    if (value.children) {
        for (const pair of value.children) {
            mArraySet(copy, pair.key, mValueCopy(pair.value));
        }
    }

    return copy;
};

export const mArraySet = (array: MArray, key: string, value: MValue) => {
    if (!array.children) {
        array.children = [{ key, value }];
        return;
    }

    const index = mArrayGetDesiredIndex(array, key);

    if (index < array.children.length && array.children[index].key === key) {
        array.children[index].value = value;
    } else {
        array.children.splice(index, 0, { key, value });
    }
};

export const mArrayKill = (array: MArray, key: string) => {
    const index = mArrayGetDesiredIndex(array, key);

    if (array.children && index < array.children.length && array.children[index].key === key) {
        array.children.splice(index, 1);
    }
};

export const mArrayGet = (array: MArray, key: string) => {
    const index = mArrayGetDesiredIndex(array, key);

    if (array.children && index < array.children.length && array.children[index].key === key) {
        return array.children[index].value;
    }

    return "";
};

const mArrayGetDesiredIndex = (array: MArray, key: string) => {
    if (!array.children) {
        return 0;
    }

    let left = 0;
    let right = array.children.length;

    while (left < right) {
        const index = ((left + right) / 2) | 0;
        const pair = array.children[index];

        if (pair.key > key) {
            right = index;
        } else if (pair.key < key) {
            left = index + 1;
        } else {
            left = index;
            break;
        }
    }

    return left;
};

export const mArrayGetPreviousKey = (array: MArray, key: string) => {
    if (!array.children) {
        return "";
    }

    let index;

    if (key === "") {
        index = Math.max(array.children.length - 1, 0);
    } else {
        index = mArrayGetDesiredIndex(array, key) - 1;
    }

    return array.children[index]?.key ?? "";
};

export const mArrayGetNextKey = (array: MArray, key: string) => {
    let index = mArrayGetDesiredIndex(array, key);

    if (!array.children || index >= array.children.length) {
        return "";
    }

    if (array.children[index].key === key) {
        index++;
    }

    return array.children[index]?.key ?? "";
};
