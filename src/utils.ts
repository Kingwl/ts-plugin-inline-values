export function assert(v: unknown, message?: string): asserts v {
  if (!v) {
    throw new Error(message ?? "Assert failed");
  }
}

export function isDef<T>(v: T): v is NonNullable<T> {
  return v !== null && v !== undefined;
}
