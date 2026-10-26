import type { PgrstJson, PgrstJsonText } from '../../../src/index'
import type { Equal, Expect } from '../helpers'

type Doc = { ui?: { theme: 'light' | 'dark'; size: number }; tags: string[] }

// `->`: the value at the path, `null` when it doesn't resolve
type _19a = Expect<Equal<PgrstJson<Doc, ['ui', 'theme']>, 'light' | 'dark' | null>>
type _19b = Expect<Equal<PgrstJson<Doc, ['tags', '0']>, string | null>>
type _19c = Expect<Equal<PgrstJson<Doc, ['nope']>, null>>
type _19d = Expect<Equal<PgrstJson<Doc, []>, Doc | null>>

// `->>`: a string-literal leaf is kept, any other leaf becomes `string`
type _19e = Expect<Equal<PgrstJsonText<Doc, ['ui', 'theme']>, 'light' | 'dark' | null>>
type _19f = Expect<Equal<PgrstJsonText<Doc, ['ui', 'size']>, string | null>>
type _19g = Expect<Equal<PgrstJsonText<Doc, ['nope']>, null>>

// untyped json stays untyped
type _19h = Expect<Equal<PgrstJson<unknown, ['a']>, unknown>>
type _19i = Expect<Equal<PgrstJson<any, ['a']>, any>>
