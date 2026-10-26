import type { AcquiredSchema } from '../src'
import { acquireFromStack } from './support/acquired'
import { TYPE_HELPERS, typecheckConsumer } from './support/consumer'
import { generateText } from './support/declarations'

/**
 * A type is what the catalog says it is: an array type of a user type is an array of that type, a domain is its base
 * type wherever it is mentioned, and a name that reads like a builtin in a schema of its own is no builtin.
 */
let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

const generate = (source: string): Promise<string> => generateText(acquired, source)

const HELPERS = `${TYPE_HELPERS}
type Ok<P> = Awaited<P> extends infer R ? (R extends { error: null } ? R : never) : never
export type Data<P> = Ok<P> extends { data: infer D } ? D : never
`

describe('the rows of a scalar function that returns a user type', () => {
  const APP = `
import type { PostgrestClient } from '@supabase/postgrest-js'
import type { Data, Equal, Expect } from './helpers'
declare const supabase: PostgrestClient
type Status = 'ONLINE' | 'OFFLINE'

const a1 = supabase.rpc('user_statuses_online')
export type A1 = Expect<Equal<Data<typeof a1>, Status[] | null>>
const a2 = supabase.rpc('user_statuses_online_set')
export type A2 = Expect<Equal<Data<typeof a2>, (Status[] | null)[]>>
// a domain only a function returns: the type it is defined over
const d1 = supabase.rpc('return_only_amount_of_one')
export type D1 = Expect<Equal<Data<typeof d1>, number | null>>
const d2 = supabase.rpc('return_only_amounts')
export type D2 = Expect<Equal<Data<typeof d2>, number[] | null>>
`

  it('is an array of the enum for an enum array, and the base type for a domain', async () => {
    const text = await generate(APP)
    const checked = typecheckConsumer({
      files: { 'db.d.ts': text, 'helpers.ts': HELPERS, 'app.ts': APP },
    })
    expect(checked.byFile.get('db.d.ts') ?? []).toEqual([])
    expect(checked.byFile.get('app.ts') ?? []).toEqual([])
    expect(text).toMatch(
      /form: 'single-scalar'\n\s+row: SupabaseDatabase\['public'\]\['Enums'\]\['user_status'\]\[\] \| null/
    )
  }, 180_000)
})

describe('a column whose enum type is named like a builtin', () => {
  it('is the enum of its schema, not the builtin', async () => {
    const text = await generate(`supabase.from('builtin_named_enum_cases').select('id, greeting')`)
    const row = /builtin_named_enum_cases[^\n]*\n\s+row: (.*)\n/.exec(text)?.[1]
    expect(row).toBeDefined()
    expect(row).toMatch(/greeting: [^;]*unknown/)
    expect(row).not.toMatch(/greeting: [^;]*number/)
  }, 180_000)
})
