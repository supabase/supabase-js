import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createGenerator, generateDeclarations, type AcquiredSchema } from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { TYPE_HELPERS, typecheckConsumer } from './support/consumer'
import { createTempProject, type TempProject } from './support/project'

const HELPERS = `${TYPE_HELPERS}
type Ok<P> = Awaited<P> extends infer R ? (R extends { error: null } ? R : never) : never
export type Data<P> = Ok<P> extends { data: infer D } ? D : never
`

// every chain of a category the generator has to type, with one wrong usage per category
const APP = `
import type { PostgrestClient, PgrstJson } from '@supabase/postgrest-js'
import type { Data, Equal, Expect } from './helpers'
import type { Json } from './db'
declare const supabase: PostgrestClient
type Status = 'ONLINE' | 'OFFLINE'

// scalar function: the value, or null
const r1 = supabase.rpc('get_status', { name_param: 'x' })
export type R1 = Expect<Equal<Data<typeof r1>, Status | null>>
// the same function over GET: a stable function allows it, and it is a call of its own
const r2 = supabase.rpc('get_status', { name_param: 'x' }, { get: true })
export type R2 = Expect<Equal<Data<typeof r2>, Status | null>>
const r2h = supabase.rpc('get_status', { name_param: 'x' }, { head: true, count: 'exact' })

// void
const r10 = supabase.rpc('void_func')
export type R10 = Expect<Equal<Data<typeof r10>, null>>

// setof table, with a projection and a to-many embed: the trace of the body proves the primary key non-null
const r3 = supabase.rpc('function_returning_set_of_rows').select('username, messages(id)')
export type R3 = Expect<Equal<Data<typeof r3>, { username: string; messages: { id: number }[] }[]>>
const r3g = supabase.rpc('function_returning_set_of_rows', undefined, { get: true }).select('username')
export type R3g = Expect<Equal<Data<typeof r3g>, { username: string }[]>>

// RETURNS TABLE
const r4 = supabase.rpc('get_username_and_status', { name_param: 'x' })
export type R4 = Expect<Equal<Data<typeof r4>, { username: string; status: Status | null }[]>>

// composite: one row of a table, every column nullable (a function can return what the table refuses)
const r5 = supabase.rpc('function_returning_row')
export type R5 = Expect<Equal<Data<typeof r5>['username'], string | null>>

// overloads: the key set picks one
const r6 = supabase.rpc('postgrest_resolvable_with_override_function', { a: 'x' })
export type R6 = Expect<Equal<Data<typeof r6>, number | null>>
const r7 = supabase.rpc('postgrest_resolvable_with_override_function', { b: 1 })
export type R7 = Expect<Equal<Data<typeof r7>, string | null>>
// @ts-expect-error PGRST203: a text or an integer, no best candidate
const r8 = supabase.rpc('postgrest_unresolvable_function', { a: 'x' })
// @ts-expect-error PGRST202: no function takes this key
const r9 = supabase.rpc('get_status', { nope: 'x' })

// operands: a JSON path, the column of an embed, a tested embed
const o1 = supabase.from('users').select('username, data').eq('data->theme', 'dark')
const o2 = supabase.from('messages').select('id, channels(id, slug)').eq('channels.slug', 'x')
// @ts-expect-error the value is compared with channels.slug, a string
const o2w = supabase.from('messages').select('id, channels(id, slug)').eq('channels.slug', 5)
const o3 = supabase.from('messages').select('id, channels(id)').not('channels', 'is', null)
const o4 = supabase.from('messages').select('id, channels(id)').order('id', { referencedTable: 'channels' })
// operands of a function: a plain column is the row's, the others are planned per call
const o5 = supabase.rpc('get_username_and_status', { name_param: 'x' }).eq('username', 'a')
const o6 = supabase.rpc('function_returning_set_of_rows').select('username, messages(id, message)').eq('messages.message', 'x')
// @ts-expect-error the value is compared with messages.message, a string
const o6w = supabase.rpc('function_returning_set_of_rows').select('username, messages(id, message)').eq('messages.message', 5)
const o7 = supabase.rpc('function_returning_set_of_rows').select('username, data').eq('data->theme', 'x')
`

// overloads PostgREST cannot call are not in the database type: only a lone unnamed json, jsonb, text, xml or bytea
// parameter takes the request body
const APP_UNNAMED = `
import type { PostgrestClient } from '@supabase/postgrest-js'
import type { Data, Equal, Expect } from './helpers'
declare const supabase: PostgrestClient

// the text overload is the only callable one of three
const u1 = supabase.rpc('polymorphic_function_with_different_return', { '': 'x' })
export type U1 = Expect<Equal<Data<typeof u1>, string | null>>
// @ts-expect-error a boolean body has no function: the boolean overload is not callable
const u2 = supabase.rpc('polymorphic_function_with_different_return', { '': true })
// @ts-expect-error a single unnamed integer parameter is not callable at all
const u3 = supabase.rpc('polymorphic_function_with_unnamed_integer', { '': 1 })
// a single unnamed json parameter is
const u4 = supabase.rpc('polymorphic_function_with_unnamed_json', { '': { a: 1 } })
export type U4 = Expect<Equal<Data<typeof u4>, number | null>>
// the no-argument overload stays next to the unnamed text one
const u5 = supabase.rpc('polymorphic_function_with_no_params_or_unnamed')
export type U5 = Expect<Equal<Data<typeof u5>, number | null>>
const u6 = supabase.rpc('polymorphic_function_with_no_params_or_unnamed', { '': 'x' })
export type U6 = Expect<Equal<Data<typeof u6>, string | null>>
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

describe('rpc entries and operands of a project', () => {
  it('prints a call per key set and method, and types the chains against them', async () => {
    const p = await project({ 'src/app.ts': APP })
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: { ...p.options, defaultSchema: 'public', unplanned: 'error' },
      deps: { wasmPath: plannerWasmPath(), cacheDirectory: false },
    })
    expect(result.diagnostics).toEqual([])
    const { text } = result

    // scalar: one call per method the project sends; a key set no function takes is the planner's error
    expect(text).toContain(`'f|public|get_status|*': {
      calls: [
        {
          keys: 'name_param'
          method: 'GET'
          form: 'single-scalar'
          row: SupabaseDatabase['public']['Enums']['user_status'] | null
          source: never
        },`)
    expect(text).toMatch(
      /keys: 'nope'\n\s+method: 'POST'\n\s+error: "PGRST202: Could not find the function public\.get_status\(nope\)/
    )
    // HEAD is a call of its own
    expect(text).toMatch(/keys: 'name_param'\n\s+method: 'HEAD'/)
    // the ambiguous overload is an error call, the resolvable ones carry their own return type
    expect(text).toMatch(
      /keys: 'a'\n\s+method: 'POST'\n\s+error: "PGRST203: Could not choose the best candidate function/
    )
    expect(text).toMatch(
      /keys: 'a'\n\s+method: 'POST'\n\s+form: 'single-scalar'\n\s+row: number \| null/
    )
    expect(text).toMatch(
      /keys: 'b'\n\s+method: 'POST'\n\s+form: 'single-scalar'\n\s+row: string \| null/
    )
    expect(text).toMatch(/form: 'single-scalar'\n\s+row: null\n/) // void
    // a projected call has the star row as its source, its own sources and embeds
    expect(text).toContain(`'f|public|function_returning_set_of_rows|username, messages(id)': {`)
    expect(text).toMatch(
      /row: \{ username: SupabaseColumnType<'public\.users\.username', string>; messages: \{ id: SupabaseColumnType<'public\.messages\.id', number> \}\[\] \}\n\s+source: \{ row: \{ username: SupabaseColumnType<'public\.users\.username', string>; data:/
    )
    expect(text).toContain(
      "messages: { path: ['messages']; outputs: [['messages']]; join: 'left'; cardinality: 'many' }"
    )

    // operands: a column of the row has no entry; a path, an embed's column and a tested embed do
    expect(text).toContain(
      "'r|public|users|username, data|data->theme': { type: import('@supabase/postgrest-js').PgrstJson<SupabaseColumnType<'public.users.data', Json>, ['theme']> }"
    )
    expect(text).toContain(
      "'r|public|messages|id, channels(id, slug)|channels.slug': { type: SupabaseColumnType<'public.channels.slug', string>; embed: ['channels'] }"
    )
    expect(text).toContain(
      "'r|public|messages|id, channels(id)|channels': { type: unknown; embed: ['channels'] }"
    )
    expect(text).not.toContain('|username, data|username')
    expect(text).not.toMatch(/\|get_username_and_status\|\*\|username/)
    // an operand of a function is planned per call
    expect(text).toMatch(
      /'f\|public\|function_returning_set_of_rows\|username, messages\(id, message\)\|messages\.message': \{\n\s+calls: \[\n\s+\{ keys: never; method: 'POST'; type: SupabaseColumnType<'public\.messages\.message', string>; embed: \['messages'\] \},/
    )
    // a referencedTable option is read from the call, not looked up
    expect(text).not.toContain('|@channels')

    const checked = typecheckConsumer({
      files: { 'db.d.ts': text, 'helpers.ts': HELPERS, 'app.ts': APP },
    })
    expect(checked.byFile.get('db.d.ts') ?? []).toEqual([])
    expect(checked.byFile.get('app.ts') ?? []).toEqual([])
  }, 180_000)

  it('leaves the overloads PostgREST cannot call out of the database type and the plan', async () => {
    const p = await project({ 'src/app.ts': APP_UNNAMED })
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: { ...p.options, defaultSchema: 'public', unplanned: 'error' },
      deps: { wasmPath: plannerWasmPath(), cacheDirectory: false },
    })
    expect(result.diagnostics).toEqual([])
    const { text } = result

    // the integer and boolean overloads, and a function whose only overload is unnamed non-body, are gone
    expect(text).toMatch(
      /polymorphic_function_with_different_return: \{\n\s+Args: \{\n\s+'': string\n\s+\}\n\s+Returns: string \| null\n\s+\}\n/
    )
    expect(text).not.toContain('polymorphic_function_with_unnamed_integer')
    // the callable ones are still there
    expect(text).toContain('polymorphic_function_with_unnamed_json: {')
    expect(text).toContain('polymorphic_function_with_unnamed_jsonb: {')
    expect(text).toContain('polymorphic_function_with_unnamed_text: {')
    expect(text).toMatch(
      /polymorphic_function_with_no_params_or_unnamed: \n\s+\| \{\n\s+Args: Record<string, never>\n\s+Returns: number \| null\n\s+\}\n\s+\| \{\n\s+Args: \{\n\s+'': string\n/
    )
    // a computed field's function (one unnamed row parameter) is not an rpc target
    expect(text).not.toContain('blurb_message: {')
    // planned: the one callable overload of the key set '', not one per printed overload
    const entry = text.slice(
      text.indexOf("'f|public|polymorphic_function_with_different_return|*'"),
      text.indexOf("'f|public|polymorphic_function_with_no_params_or_unnamed|*'")
    )
    expect(entry.match(/keys: ''/g)).toHaveLength(1)
    expect(entry).not.toContain('error:')

    const checked = typecheckConsumer({
      files: { 'db.d.ts': text, 'helpers.ts': HELPERS, 'app.ts': APP_UNNAMED },
    })
    expect(checked.byFile.get('db.d.ts') ?? []).toEqual([])
    expect(checked.byFile.get('app.ts') ?? []).toEqual([])
  }, 180_000)

  it('keeps rpc calls and operands in the same cache entries as the selects', async () => {
    const p = await project({ 'src/app.ts': APP })
    const options = { ...p.options, defaultSchema: 'public' }
    const hosts = { started: 0 }
    const deps = {
      wasmPath: plannerWasmPath(),
      logger: { debug: () => undefined, warn: () => undefined },
    }
    const g1 = createGenerator(deps)
    let miss
    try {
      miss = await g1.generate({ configFileName: p.configFileName, options: options as never })
    } finally {
      await g1.close()
    }
    expect(miss.cache).toBe('miss')
    const directory = join(p.dir, 'node_modules', '.cache', 'postgrest-mapper')
    const files = readdirSync(directory)
    expect(files).toHaveLength(1)
    const stored = JSON.parse(readFileSync(join(directory, files[0]!), 'utf8'))
    expect(Object.keys(stored.entries)).toEqual(miss.keys)
    const ids = miss.keys
    expect(ids.some((id) => id.startsWith('r|public|messages|'))).toBe(true)
    expect(ids).toContain('call|public|get_status|*|["name_param"]|GET')
    expect(ids).toContain('call|public|get_status|*|["name_param"]|HEAD')
    expect(ids.some((id) => id.startsWith('op|r|public|users|username, data|data->theme'))).toBe(
      true
    )
    expect(ids.some((id) => id.startsWith('rpcop|f|public|function_returning_set_of_rows|'))).toBe(
      true
    )

    // nothing is planned again: a host that cannot start proves the second run is served from the file
    const g2 = createGenerator({
      ...deps,
      createHost: () => {
        hosts.started++
        throw new Error('the planner must not start on a cache hit')
      },
    })
    try {
      const hit = await g2.generate({ configFileName: p.configFileName, options: options as never })
      expect(hit.cache).toBe('hit')
      expect(hit.text).toBe(miss.text)
      expect(hit.identity).toBe(miss.identity)
      expect(hosts.started).toBe(0)
    } finally {
      await g2.close()
    }
  }, 180_000)
})

describe('a select no chain reaches', () => {
  it('has a call for a function the file calls, whatever builder the select lands on', async () => {
    const p = await project({
      'src/app.ts': `
        declare const supabase: any
        function projected(builder: any) { return builder.select('username') }
        projected(supabase.rpc('function_returning_set_of_rows'))
      `,
    })
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: { ...p.options, defaultSchema: 'public' },
      deps: { wasmPath: plannerWasmPath(), cacheDirectory: false },
    })
    expect(result.diagnostics).toEqual([])
    expect(result.text).toContain("'f|public|function_returning_set_of_rows|username': {")
  }, 120_000)
})
