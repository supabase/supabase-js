import type { AcquiredSchema } from '../src'
import { acquireFromStack } from './support/acquired'
import { generateText } from './support/declarations'

/**
 * The caller reads a function's rows as its declared output types. PostgreSQL coerces the value the body selects to
 * each of them (an assignment coercion), and a coercion can turn a non-null value into NULL (`timestamptz` `infinity`
 * to `time`) or into another representation. The generator keeps what the body proves only where the value arrives
 * unchanged, or where the planner proves the coercion never yields NULL.
 */
let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

async function rowOf(name: string): Promise<string> {
  const text = await generateText(acquired, `supabase.rpc('${name}')`)
  const row = new RegExp(`f\\|public\\|${name}\\|\\*'[\\s\\S]*?row: (.*)\\n`).exec(text)?.[1]
  expect(row).toBeDefined()
  return row!
}

describe('the rows of a function whose output types differ from the selected ones', () => {
  it('is nullable where the coercion can return NULL, and keeps a column of the same type', async () => {
    // `timestamptz` to `time` is NULL for infinity; `n` selects an integer into an integer
    expect(await rowOf('output_time_from_timestamptz')).toBe('{ t: string | null; n: number }')
  }, 180_000)

  it('keeps the nullability along coercions the planner proves non-null, without the source of the value', async () => {
    // `varchar` to `text` and `integer` to `bigint` never yield NULL, but the value is no longer the column's
    expect(await rowOf('output_text_and_bigint_from_varchar_and_integer')).toBe(
      '{ label: string; total: number }'
    )
  }, 180_000)

  it('drops the JSON Schema of a column coerced to text', async () => {
    expect(await rowOf('output_text_from_jsonb')).toBe('{ payload: string | null }')
  }, 180_000)

  it('treats a domain over the selected type as another type, and the same domain as the same type', async () => {
    expect(await rowOf('output_base_type_of_domain')).toBe('{ b: number | null }')
    expect(await rowOf('output_same_domain')).toMatch(
      /^\{ b: SupabaseColumnType<'public\.cast_cases\.b', /
    )
  }, 180_000)
})
