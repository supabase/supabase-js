import { generateDeclarations, type AcquiredSchema } from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { typecheckConsumer } from './support/consumer'
import { createTempProject, type TempProject } from './support/project'

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

const projects: TempProject[] = []
afterEach(() => {
  for (const p of projects.splice(0)) p.remove()
})

async function declarationsOf(source: string): Promise<string> {
  const p = await createTempProject(acquired, { 'src/app.ts': source })
  projects.push(p)
  const result = await generateDeclarations({
    configFileName: p.configFileName,
    options: { ...p.options, defaultSchema: 'public', unplanned: 'error' },
    deps: { wasmPath: plannerWasmPath(), cacheDirectory: false },
  })
  expect(result.diagnostics).toEqual([])
  return result.text
}

/** The only entry of `SupabaseSelects`, from its key to its closing brace. */
function onlyEntry(text: string): string {
  const start = text.indexOf('interface SupabaseSelects {')
  expect(start).toBeGreaterThanOrEqual(0)
  const end = text.indexOf('\n  }', start)
  return text.slice(start, end)
}

describe('embeds that share an alias', () => {
  it('prints one entry per alias, the one whose value the row holds', async () => {
    const text = await declarationsOf(
      `supabase.from('messages').select('id, x:users(username), x:channels(id)')`
    )
    const entry = onlyEntry(text)
    // the later embed holds the key of the row, as it does in a JSON object
    expect(entry).toMatch(/\bx: \{ id: SupabaseColumnType<'public\.channels\.id'/)
    expect(entry.match(/^\s+x: \{ path:/gm)).toHaveLength(1)
    expect(typecheckConsumer({ files: { 'db.d.ts': text } }).byFile.get('db.d.ts') ?? []).toEqual(
      []
    )
  }, 180_000)

  it('prints the entries of the embeds nested in the surviving one only', async () => {
    const text = await declarationsOf(
      `supabase.from('users').select('x:messages(id, channels(id)), x:messages(id, users(username))')`
    )
    const entry = onlyEntry(text)
    expect(entry).toContain("path: ['x', 'users']")
    expect(entry).not.toContain("path: ['x', 'channels']")
    expect(typecheckConsumer({ files: { 'db.d.ts': text } }).byFile.get('db.d.ts') ?? []).toEqual(
      []
    )
  }, 180_000)

  it('keeps the entry of an embed that shares its alias with a plain field', async () => {
    const text = await declarationsOf(`supabase.from('messages').select('x:id, x:users(username)')`)
    const entry = onlyEntry(text)
    expect(entry).toMatch(/\bx: \{ username: /)
    expect(entry.match(/^\s+x: \{ path:/gm)).toHaveLength(1)
    expect(typecheckConsumer({ files: { 'db.d.ts': text } }).byFile.get('db.d.ts') ?? []).toEqual(
      []
    )
  }, 180_000)
})

describe('embeds that share a key without an alias', () => {
  it('prints one entry for the same relation spread twice, listing the outputs of both', async () => {
    const text = await declarationsOf(
      `supabase.from('messages').select('...channels(id), ...channels(slug)')`
    )
    const entry = onlyEntry(text)
    expect(entry.match(/^\s+channels: \{ path:/gm)).toHaveLength(1)
    expect(entry).toContain("outputs: [['id'], ['slug']]")
    expect(typecheckConsumer({ files: { 'db.d.ts': text } }).byFile.get('db.d.ts') ?? []).toEqual(
      []
    )
  }, 180_000)

  it('prints one entry for a spread and an embed of the same relation', async () => {
    const text = await declarationsOf(
      `supabase.from('messages').select('...channels(id), channels(slug)')`
    )
    const entry = onlyEntry(text)
    expect(entry.match(/^\s+channels: \{ path:/gm)).toHaveLength(1)
    expect(entry).toContain("outputs: [['id'], ['channels']]")
    expect(typecheckConsumer({ files: { 'db.d.ts': text } }).byFile.get('db.d.ts') ?? []).toEqual(
      []
    )
  }, 180_000)

  it('lists as outputs of a spread only the members the row holds', async () => {
    const text = await declarationsOf(
      `supabase.from('messages').select('...users(username, data), ...channels(data)')`
    )
    const entry = onlyEntry(text)
    // the key `data` is the value of the later spread
    expect(entry).toContain("path: ['users']; outputs: [['username']]")
    expect(entry).toContain("path: ['channels']; outputs: [['data']]")
    expect(typecheckConsumer({ files: { 'db.d.ts': text } }).byFile.get('db.d.ts') ?? []).toEqual(
      []
    )
  }, 180_000)
})
