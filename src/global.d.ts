// TODO: Remove this when es2023 is released

export {}

declare global {
  interface Array<T> {
    findLastIndex(
      predicate: (value: T, index: number, obj: T[]) => unknown,
      thisArg?: unknown
    ): number

    findLast(
      predicate: (value: T, index: number, obj: T[]) => unknown,
      thisArg?: unknown
    ): T
  }
}
