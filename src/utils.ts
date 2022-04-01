import type * as ts from 'typescript';
import type * as tsserver from 'typescript/lib/tsserverlibrary';

export function assert(v: unknown, message?: string): asserts v {
    if (!v) {
        throw new Error(message ?? "Assert failed")
    }
}

export function assertTs(v: typeof ts | typeof tsserver): asserts v is typeof ts {
    // do nothing
}