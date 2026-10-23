import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createGenerator,
  createPlannerHost,
  createProjectGenerator,
  generateDeclarations,
  writeSnapshot,
  type AcquiredSchema,
  type GeneratorDeps,
  type PlannerHost,
} from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { TYPE_HELPERS, typecheckConsumer, type ConsumerResult } from './support/consumer'
import { createTempProject, type TempProject } from './support/project'

const HELPERS = `${TYPE_HELPERS}
type Ok<P> = Awaited<P> extends infer R ? (R extends { error: null } ? R : never) : never
export type Data<P> = Ok<P> extends { data: infer D } ? D : never
`

const APP = `
import type { PostgrestClient, PgrstJson, PgrstJsonText } from '@supabase/postgrest-js'
import type { Data, Equal, Expect } from './helpers'
import type { Json } from './db'
declare const supabase: PostgrestClient
type Status = 'ONLINE' | 'OFFLINE'

// alias, count, max, cast, json paths
const q1 = supabase.from('users').select('username, s:status, c:status.count(), m:status.max(), t:username::text, theme:data->>theme, deep:data->a->b')
export type T1 = Expect<Equal<Data<typeof q1>, {
  username: string
  s: Status | null
  c: number
  m: Status | null
  t: string
  theme: PgrstJsonText<Json, ['theme']>
  deep: PgrstJson<Json, ['a', 'b']>
}[]>>

// many-to-one embed, the key proves the row
const q2 = supabase.from('messages').select('id, channels(id)')
export type T2 = Expect<Equal<Data<typeof q2>, { id: number; channels: { id: number } }[]>>

// nullable foreign key column
const q3 = supabase.from('best_friends').select('id, third:users!third_wheel(username)')
export type T3 = Expect<Equal<Data<typeof q3>, { id: number; third: { username: string } | null }[]>>

// one-to-many embed
const q4 = supabase.from('users').select('username, messages(id)')
export type T4 = Expect<Equal<Data<typeof q4>, { username: string; messages: { id: number }[] }[]>>

// inner join
const q5 = supabase.from('messages').select('id, channels!inner(id, slug)')
export type T5 = Expect<Equal<Data<typeof q5>, { id: number; channels: { id: number; slug: string | null } }[]>>

// spreads
const q6 = supabase.from('messages').select('id, ...channels(slug)')
export type T6 = Expect<Equal<Data<typeof q6>, { id: number; slug: string | null }[]>>
const q7 = supabase.from('users').select('username, ...messages(id)')
export type T7 = Expect<Equal<Data<typeof q7>, { username: string; id: number[] }[]>>

// a mutation with .select(): a left to-one embed is nullable there
const q8 = supabase.from('messages').update({ message: 'x' }).eq('id', 1).select('id, channels(id)')
export type T8 = Expect<Equal<Data<typeof q8>, { id: number; channels: { id: number } | null }[]>>

// the planner rejects the embed
// @ts-expect-error not indexed: nope is not a relationship of users
const q9 = supabase.from('users').select('username, nope(id)')
`

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

const projects: TempProject[] = []
async function project(files: Record<string, string>): Promise<TempProject> {
  const p = await createTempProject(acquired, files)
  projects.push(p)
  return p
}
afterEach(() => {
  for (const p of projects.splice(0)) p.remove()
})

const optionsOf = (p: TempProject, extra: Record<string, unknown> = {}) => ({
  ...p.options,
  defaultSchema: 'public',
  ...extra,
})

/** What the planner was asked: hosts created and schemas loaded, to see what a cache hit saves. */
function countingDeps(extra: GeneratorDeps = {}) {
  const calls = { hosts: 0, loads: 0 }
  const logs: string[] = []
  const deps: GeneratorDeps = {
    wasmPath: plannerWasmPath(),
    logger: { debug: (m) => logs.push(m), warn: (m) => logs.push(`warn: ${m}`) },
    createHost: () => {
      calls.hosts++
      const host: PlannerHost = createPlannerHost({ wasmPath: plannerWasmPath() })
      return {
        ...host,
        load: (a) => (calls.loads++, host.load(a)),
        close: () => host.close(),
        plan: (r) => host.plan(r),
        planMany: (r) => host.planMany(r),
      }
    },
    ...extra,
  }
  return { deps, calls, logs }
}

describe('generated declarations of a project', () => {
  it('type-checks the builder chains of the project against the entries', async () => {
    const p = await project({ 'src/app.ts': APP })
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: optionsOf(p, { unplanned: 'error' }),
      deps: { wasmPath: plannerWasmPath() },
    })
    expect(result.diagnostics).toEqual([])
    expect(result.optionDiagnostics).toEqual([])
    expect(result.watchedFiles).toEqual([join(p.dir, 'src/app.ts'), p.snapshotPath].sort())
    expect(result.text).toContain("'r|public|messages|id, channels(id)': {")
    // an embed the planner rejects is an error entry carrying the planner's code and message
    expect(result.text).toMatch(
      /'r\|public\|users\|username, nope\(id\)': \{\n\s+error: "PGRST200: Could not find a relationship between 'users' and 'nope'/
    )
    // every source-backed leaf names its column, through the embed's own relation
    expect(result.text).toContain("slug: SupabaseColumnType<'public.channels.slug', string> | null")
    const checked: ConsumerResult = typecheckConsumer({
      files: { 'db.d.ts': result.text, 'helpers.ts': HELPERS, 'app.ts': APP },
    })
    expect(checked.byFile.get('db.d.ts') ?? []).toEqual([])
    expect(checked.byFile.get('app.ts') ?? []).toEqual([])
  }, 120_000)

  it('rejects a wrong expectation: the entries are what the types read', async () => {
    const wrong = APP.replace(
      '{ id: number; channels: { id: number } }[]>>\n\n// nullable',
      '{ id: number; channels: { id: number } | null }[]>>\n\n// nullable'
    )
    expect(wrong).not.toBe(APP)
    const p = await project({ 'src/app.ts': wrong })
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: optionsOf(p, { unplanned: 'error' }),
      deps: { wasmPath: plannerWasmPath() },
    })
    const checked = typecheckConsumer({
      files: { 'db.d.ts': result.text, 'helpers.ts': HELPERS, 'app.ts': wrong },
    })
    expect([...checked.byFile.keys()]).toEqual(['app.ts'])
    expect(checked.byFile.get('app.ts')).toHaveLength(1)
  }, 120_000)

  it('honours the scan globs', async () => {
    const p = await project({
      'src/a.ts': `supabase.from('users').select('username')`,
      'src/b.ts': `supabase.from('users').select('status')`,
    })
    const generator = createGenerator({ wasmPath: plannerWasmPath() })
    try {
      const run = (scan?: string[]) =>
        generator.generate({
          configFileName: p.configFileName,
          options: { ...p.options, defaultSchema: 'public', ...(scan ? { scan } : {}) } as never,
        })
      expect((await run()).keys).toEqual(['r|public|users|status', 'r|public|users|username'])
      const only = await run(['src/a.ts'])
      expect(only.keys).toEqual(['r|public|users|username'])
      expect(only.watchedFiles).toEqual([join(p.dir, 'src/a.ts'), p.snapshotPath].sort())
    } finally {
      await generator.close()
    }
  }, 120_000)
})

describe('failures are diagnostics, not exceptions', () => {
  it('reports invalid options without generating', async () => {
    const result = await generateDeclarations({
      projectDir: '/nowhere',
      options: { postgrest: 'latest', schema: { source: 'snapshot', path: 'x' } },
    })
    expect(result.text).toBe('export {}\n')
    expect(result.optionDiagnostics.map((d) => d.path)).toEqual([['postgrest']])
  })

  it('points a missing snapshot at its option and still watches it', async () => {
    const p = await project({ 'src/app.ts': '' })
    const missing = join(p.dir, 'nope.json')
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: { ...p.options, schema: { source: 'snapshot', path: 'nope.json' } },
    })
    expect(result.text).toBe('export {}\n')
    expect(result.optionDiagnostics).toMatchObject([{ path: ['schema', 'path'], code: 1003 }])
    expect(result.watchedFiles).toEqual([missing])
  })

  it('reports a schema that cannot be acquired as 2002 on the index file', async () => {
    const p = await project({ 'src/app.ts': '' })
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: { postgrest: '14.4', schema: { source: 'postgrest', dbUrlEnv: 'NO_SUCH_DB_URL' } },
      deps: { env: {} },
    })
    expect(result.optionDiagnostics).toMatchObject([{ path: ['schema', 'dbUrlEnv'] }])
    expect(result.text).toBe('export {}\n')
  })

  it('reports a planner that cannot start as 2003', async () => {
    const p = await project({ 'src/app.ts': `supabase.from('users').select('username')` })
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: optionsOf(p),
      deps: { wasmPath: join(p.dir, 'missing.wasm'), cacheDirectory: false },
    })
    expect(result.diagnostics).toMatchObject([{ code: 2003, start: 0, length: 0 }])
    expect(result.text).toBe('export {}\n')
  }, 60_000)
})

describe('caching and identity', () => {
  const CHAINS = `
    supabase.from('users').select('username, messages(id)')
    supabase.from('messages').select('id, channels(id)')
  `

  it('serves a second run from the disk cache without starting the planner', async () => {
    const p = await project({ 'src/app.ts': CHAINS })
    const first = countingDeps()
    const g1 = createGenerator(first.deps)
    const miss = await g1.generate({
      configFileName: p.configFileName,
      options: optionsOf(p) as never,
    })
    await g1.close()
    expect(miss.cache).toBe('miss')
    expect(first.calls).toEqual({ hosts: 1, loads: 1 })

    const cacheDirectory = join(p.dir, 'node_modules', '.cache', 'postgrest-mapper')
    const files = readdirSync(cacheDirectory)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^postgrest-mapper-[0-9a-f]{32}\.json$/)
    const stored = JSON.parse(readFileSync(join(cacheDirectory, files[0]!), 'utf8'))
    expect(Object.keys(stored.entries)).toEqual(miss.keys)

    // a new generator is a new process as far as memory goes
    const second = countingDeps()
    const g2 = createGenerator(second.deps)
    const hit = await g2.generate({
      configFileName: p.configFileName,
      options: optionsOf(p) as never,
    })
    await g2.close()
    expect(hit.cache).toBe('hit')
    expect(second.calls).toEqual({ hosts: 0, loads: 0 })
    expect(second.logs.some((m) => m.startsWith('cache hit'))).toBe(true)
    expect(hit.text).toBe(miss.text)
    expect(hit.identity).toBe(miss.identity)
  }, 120_000)

  it('plans only the keys the cache lacks, and changes identity with the key set', async () => {
    const p = await project({ 'src/app.ts': CHAINS })
    const gen = countingDeps()
    const g = createGenerator(gen.deps)
    try {
      const run = () =>
        g.generate({ configFileName: p.configFileName, options: optionsOf(p) as never })
      const first = await run()
      p.write('src/app.ts', `${CHAINS}\nsupabase.from('channels').select('id, slug')\n`)
      const grown = await run()
      expect(grown.cache).toBe('partial')
      expect(grown.keys).toHaveLength(first.keys.length + 1)
      expect(grown.identity).not.toBe(first.identity)
      expect(gen.logs).toContain('planning 1 of 3 keys')
      // the host is shared and the schema is loaded once
      expect(gen.calls).toEqual({ hosts: 1, loads: 1 })
      // removing the chain again gives the first identity back
      p.write('src/app.ts', CHAINS)
      expect((await run()).identity).toBe(first.identity)
    } finally {
      await g.close()
    }
  }, 120_000)

  it('gives another identity and a new cache file for another schema', async () => {
    const p = await project({ 'src/app.ts': CHAINS })
    const gen = countingDeps()
    const g = createGenerator(gen.deps)
    try {
      const run = () =>
        g.generate({ configFileName: p.configFileName, options: optionsOf(p) as never })
      const before = await run()
      // rewriting the snapshot with the same schema changes nothing
      await writeSnapshot(p.snapshotPath, acquired)
      expect((await run()).identity).toBe(before.identity)
      await writeSnapshot(p.snapshotPath, { ...acquired, pgVersionNum: acquired.pgVersionNum + 1 })
      const after = await run()
      expect(after.identity).not.toBe(before.identity)
      expect(after.cache).toBe('miss')
      expect(readdirSync(join(p.dir, 'node_modules', '.cache', 'postgrest-mapper'))).toHaveLength(2)
      expect(gen.calls.loads).toBe(2)
    } finally {
      await g.close()
    }
  }, 120_000)

  it('changes identity with the options', async () => {
    const p = await project({ 'src/app.ts': CHAINS })
    const g = createGenerator({ wasmPath: plannerWasmPath(), cacheDirectory: false })
    try {
      const run = (extra: Record<string, unknown>) =>
        g.generate({ configFileName: p.configFileName, options: optionsOf(p, extra) as never })
      const loose = await run({})
      const strict = await run({ unplanned: 'error' })
      expect(loose.cache).toBe('disabled')
      expect(strict.identity).not.toBe(loose.identity)
      expect(strict.text).toContain("unplanned: 'error'")
    } finally {
      await g.close()
    }
  }, 120_000)

  it('shares the loaded schema and the host between projects of one process', async () => {
    const a = await project({ 'src/app.ts': CHAINS })
    const b = await project({ 'src/app.ts': `supabase.from('channels').select('id')` })
    const gen = countingDeps({ cacheDirectory: false })
    const generate = createProjectGenerator(gen.deps)
    try {
      const params = (p: TempProject) => ({
        configFileName: p.configFileName,
        projectHandle: p.dir,
        options: optionsOf(p) as never,
        compilerOptions: {},
      })
      const [ra, rb] = await Promise.all([generate(params(a)), generate(params(b))])
      expect(ra.text).toContain("'r|public|messages|id, channels(id)'")
      expect(rb.text).toContain("'r|public|channels|id'")
      expect(gen.calls).toEqual({ hosts: 1, loads: 1 })
    } finally {
      await generate.close()
    }
  }, 120_000)

  it('does not write the cache where there is none to write to', async () => {
    const p = await project({ 'src/app.ts': CHAINS })
    const g = createGenerator({ wasmPath: plannerWasmPath(), cacheDirectory: false })
    try {
      await g.generate({ configFileName: p.configFileName, options: optionsOf(p) as never })
    } finally {
      await g.close()
    }
    expect(existsSync(join(p.dir, 'node_modules'))).toBe(false)
    writeFileSync(join(p.dir, 'keep'), '')
  }, 120_000)
})
