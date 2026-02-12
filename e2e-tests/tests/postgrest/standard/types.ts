// Copied from ts-expect
// https://github.com/TypeStrong/ts-expect/blob/master/src/index.ts#L23-L27
export type TypeEqual<Target, Value> =
  (<T>() => T extends Target ? 1 : 2) extends <T>() => T extends Value ? 1 : 2 ? true : false

export function expectType<T>(_expression: T) {
  return
}
