// Fixed-depth indexers over the already-split JSON paths the generator emits (design §5.3). The type side only
// indexes; it never parses a path.
type IsAny<T> = 0 extends 1 & T ? true : false

type JsonStep<T, K extends string> = T extends readonly (infer U)[]
  ? K extends `${number}`
    ? U
    : never
  : T extends object
    ? K extends keyof T
      ? T[K]
      : never
    : never

// the value at the path: a missing key, an index past a non-array, or a step through a null all end in `null`
type JsonAt<T, P extends readonly string[]> =
  IsAny<T> extends true
    ? any
    : unknown extends T
      ? unknown
      : P extends readonly [infer H extends string, ...infer R extends string[]]
        ? JsonAt<NonNullable<JsonStep<NonNullable<T>, H>>, R>
        : NonNullable<T>

/**
 * The value `->` returns at `Path` in a `json` / `jsonb` value of type `T`, or `null` when the path doesn't
 * resolve (a missing key, or `null` along the way).
 *
 * @example
 * ```ts
 * type Theme = PgrstJson<{ ui?: { theme: 'light' | 'dark' } }, ['ui', 'theme']>
 * // 'light' | 'dark' | null
 * ```
 */
export type PgrstJson<T, Path extends readonly string[]> = JsonAt<T, Path> | null

type TextOf<V> = V extends string ? V : string

/**
 * The value `->>` returns at `Path`: a string-literal leaf is kept, any other leaf becomes `string`, and `null`
 * when the path doesn't resolve.
 *
 * @example
 * ```ts
 * type Theme = PgrstJsonText<{ theme: 'light' | 'dark'; size: number }, ['size']>
 * // string | null
 * ```
 */
export type PgrstJsonText<T, Path extends readonly string[]> = TextOf<JsonAt<T, Path>> | null
