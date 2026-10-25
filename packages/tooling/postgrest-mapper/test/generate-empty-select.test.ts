import type { AcquiredSchema } from '../src'
import { acquireFromStack } from './support/acquired'
import { typecheckConsumer } from './support/consumer'
import { generateText } from './support/declarations'

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

const declarationsOf = (source: string): Promise<string> => generateText(acquired, source)

/** The only entry of `SupabaseSelects`, from its key to its closing brace. */
function onlyEntry(text: string): string {
  const start = text.indexOf('interface SupabaseSelects {')
  expect(start).toBeGreaterThanOrEqual(0)
  const end = text.indexOf('\n  }', start)
  return text.slice(start, end)
}

describe('an empty select of a mutation on a table without a primary key', () => {
  it('prints the constant RETURNING 1 gives instead of rejecting the request', async () => {
    const text = await declarationsOf(`supabase.from('empty_select_nopk').delete().select('')`)
    const entry = onlyEntry(text)
    expect(entry).not.toContain('error:')
    // PostgREST answers [{"?column?":1}]
    expect(entry).toContain("'?column?': number")
    expect(typecheckConsumer({ files: { 'db.d.ts': text } }).byFile.get('db.d.ts') ?? []).toEqual(
      []
    )
  }, 180_000)

  it('still prints the primary key of a table that has one', async () => {
    const text = await declarationsOf(`supabase.from('empty_select_pk').delete().select('')`)
    expect(onlyEntry(text)).toMatch(/\bid: SupabaseColumnType<'public\.empty_select_pk\.id'/)
  }, 180_000)
})
