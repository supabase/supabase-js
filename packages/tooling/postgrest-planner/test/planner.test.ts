import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  defaultWasmPath,
  loadPlanner,
  parseConfigDump,
  type EmbedPlan,
  type LoadSuccess,
  type Planner,
  type PlanRequest,
  type PlanResult,
  type PlanSuccess,
} from '../src'

const fixtures = join(__dirname, 'fixtures')

let planner: Planner
let handle: number

beforeAll(async () => {
  if (!existsSync(defaultWasmPath())) {
    throw new Error(`${defaultWasmPath()} is missing: run "nx build:wasm postgrest-planner"`)
  }
  planner = await loadPlanner()
  const res = planner.load({
    config: parseConfigDump(readFileSync(join(fixtures, 'dump-config.txt'), 'utf8')),
    schema: readFileSync(join(fixtures, 'dump-schema.json'), 'utf8'),
  })
  if (!res.ok) throw new Error(`load failed: ${JSON.stringify(res)}`)
  handle = res.handle
})

afterAll(() => planner?.freeCache(handle))

const ok = (res: PlanResult): PlanSuccess => {
  if (!res.ok) throw new Error(`plan failed: ${JSON.stringify(res)}`)
  return res
}
const cols = (items: { outputName: string; type: string }[]) =>
  items.map((s) => [s.outputName, s.type])

describe('postgrest-planner', () => {
  it('reports abi and upstream tag', () => {
    const info = planner.info()
    expect(info.ok).toBe(true)
    expect(info.abi).toBe(1)
    expect(info.postgrest).toMatchObject({ version: '16.4', tag: 'v16.4' })
  })

  it('loads a schema cache and lists schemas', () => {
    const res = planner.load({
      config: parseConfigDump(readFileSync(join(fixtures, 'dump-config.txt'), 'utf8')),
      schema: readFileSync(join(fixtures, 'dump-schema.json'), 'utf8'),
    }) as LoadSuccess
    expect(res.ok).toBe(true)
    expect(res.handle).toEqual(expect.any(Number))
    expect(res.schemas).toEqual(['public', 'personal', 'graphql_public'])
    planner.freeCache(res.handle)
  })

  it('plans a one-to-many embed', () => {
    const p = ok(
      planner.plan(handle, {
        method: 'GET',
        url: '/users?select=username,status,messages(id,message)',
      })
    )
    expect(p.action).toBe('read')
    expect(p.txMode).toBe('read')
    expect(p.target).toEqual({ name: 'users', schema: 'public' })
    expect(cols(p.select)).toEqual([
      ['username', 'text'],
      ['status', 'public.user_status'],
    ])
    const [e] = p.embeds as EmbedPlan[]
    expect(p.embeds).toHaveLength(1)
    expect(e).toMatchObject({ name: 'messages', jsonMode: 'array', toOne: false })
    expect(e.relationship).toMatchObject({ kind: 'o2m', constraint: 'messages_username_fkey' })
    expect(cols(e.select)).toEqual([
      ['id', 'bigint'],
      ['message', 'text'],
    ])
  })

  it('returns PGRST200 with a hint for an unknown embed', () => {
    const res = planner.plan(handle, { method: 'GET', url: '/users?select=username,message(id)' })
    expect(res).toMatchObject({
      ok: false,
      status: 400,
      error: {
        code: 'PGRST200',
        hint: "Perhaps you meant 'messages' instead of 'message'.",
      },
    })
  })

  it('plans an aliased many-to-one embed by fk hint', () => {
    const p = ok(
      planner.plan(handle, {
        method: 'GET',
        url: '/messages?select=id,user:users!messages_username_fkey(username)',
      })
    )
    expect(cols(p.select)).toEqual([['id', 'bigint']])
    expect(p.embeds[0]).toMatchObject({
      alias: 'user',
      outputName: 'user',
      name: 'users',
      hint: 'messages_username_fkey',
      jsonMode: 'object',
      toOne: true,
    })
    expect(p.embeds[0].relationship).toMatchObject({ kind: 'm2o' })
  })

  it('plans an aggregate embed count', () => {
    const p = ok(
      planner.plan(handle, { method: 'GET', url: '/users?select=username,messages(count)' })
    )
    expect(p.embeds[0].name).toBe('messages')
    expect(cols(p.embeds[0].select)).toEqual([['count', '']])
  })

  it('plans an insert with return=representation', () => {
    const req: PlanRequest = {
      method: 'POST',
      url: '/messages?select=id',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ message: 'hi', username: 'supabot', channel_id: 1 }),
    }
    const p = ok(planner.plan(handle, req))
    expect(p.action).toBe('insert')
    expect(p.txMode).toBe('write')
    expect(p.mutation).toMatchObject({
      kind: 'insert',
      columns: ['channel_id', 'message', 'username'],
      returning: ['id'],
    })
    expect(cols(p.select)).toEqual([['id', 'bigint']])
  })

  it('plans an rpc call', () => {
    const p = ok(
      planner.plan(handle, {
        method: 'POST',
        url: '/rpc/get_status',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name_param: 'supabot' }),
      })
    )
    expect(p.action).toBe('rpc')
    expect(p.txMode).toBe('read')
    expect(p.payloadKeys).toEqual(['name_param'])
    expect(p.routine).toMatchObject({
      name: 'get_status',
      volatility: 'Immutable',
      params: [{ name: 'name_param', required: true, type: 'text' }],
    })
  })

  it('selects the schema from Accept-Profile', () => {
    const p = ok(
      planner.plan(handle, {
        method: 'GET',
        url: '/user_notes?select=*',
        headers: { 'Accept-Profile': 'personal' },
      })
    )
    expect(p.target).toEqual({ name: 'user_notes', schema: 'personal' })
  })

  it('returns an invalid request as an ok:false value', () => {
    const res = planner.plan(handle, { method: 'GET', url: '/nope?select=*' })
    expect(res.ok).toBe(false)
    expect(res).toMatchObject({ error: { code: 'PGRST205' } })
  })

  it('throws when the wasm file is missing', async () => {
    await expect(loadPlanner({ wasmPath: '/nonexistent.wasm' })).rejects.toThrow(
      'nx build:wasm postgrest-planner'
    )
  })
})
