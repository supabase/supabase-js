import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  defaultWasmPath,
  loadPlanner,
  parseConfigDump,
  type EmbedPlan,
  type LoadInput,
  type LoadSuccess,
  type Planner,
  type PlanRequest,
  type PlanResult,
  type PlanSuccess,
  type ShapeField,
} from '../src'

const fixtures = join(__dirname, 'fixtures')

const baseInput = (): LoadInput => ({
  config: parseConfigDump(readFileSync(join(fixtures, 'dump-config.txt'), 'utf8')),
  schema: readFileSync(join(fixtures, 'dump-schema.json'), 'utf8'),
})
const supplementaryText = () => readFileSync(join(fixtures, 'supplementary.json'), 'utf8')

let planner: Planner
/** Loaded without a supplementary catalog. */
let handle: number
/** Loaded with `fixtures/supplementary.json`. */
let catalog: number

const loaded = (res: ReturnType<Planner['load']>): LoadSuccess => {
  if (!res.ok) throw new Error(`load failed: ${JSON.stringify(res)}`)
  return res
}

beforeAll(async () => {
  if (!existsSync(defaultWasmPath())) {
    throw new Error(`${defaultWasmPath()} is missing: run "nx build:wasm postgrest-planner"`)
  }
  planner = await loadPlanner()
  handle = loaded(planner.load(baseInput())).handle
  catalog = loaded(planner.load({ ...baseInput(), supplementary: supplementaryText() })).handle
})

afterAll(() => {
  planner?.freeCache(handle)
  planner?.freeCache(catalog)
})

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
    expect(info.abi).toBe(2)
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

  describe('supplementary catalog', () => {
    it('reports a missing catalog as degraded', () => {
      const res = loaded(planner.load(baseInput()))
      expect(res).toMatchObject({ degraded: ['no-supplementary-catalog'], columnOrderKnown: false })
      planner.freeCache(res.handle)
    })

    it('accepts the catalog as a string or an object and reports a known column order', () => {
      const asString = loaded(planner.load({ ...baseInput(), supplementary: supplementaryText() }))
      const asObject = loaded(
        planner.load({ ...baseInput(), supplementary: JSON.parse(supplementaryText()) })
      )
      for (const res of [asString, asObject]) {
        expect(res).toMatchObject({ degraded: [], columnOrderKnown: true })
        planner.freeCache(res.handle)
      }
    })

    it('flags the relations the catalog does not list', () => {
      const partial = JSON.parse(supplementaryText())
      partial.relations = partial.relations.filter(
        (r: { schema: string; name: string }) => !(r.schema === 'public' && r.name === 'messages')
      )
      const res = loaded(planner.load({ ...baseInput(), supplementary: partial }))
      expect(res.columnOrderKnown).toBe(false)
      expect(res.degraded).toEqual(['column-order:public.messages'])
      planner.freeCache(res.handle)
    })

    it('ignores keys it does not know, at any level', () => {
      const extended = JSON.parse(supplementaryText())
      extended.viewDefinitions = [{ schema: 'public', name: 'active_users', sql: 'select 1' }]
      extended.relations[0].comment = 'ignored'
      extended.relations[0].columns[0].jsonSchema = { type: 'integer' }
      const res = loaded(planner.load({ ...baseInput(), supplementary: extended }))
      expect(res).toMatchObject({ degraded: [], columnOrderKnown: true })
      planner.freeCache(res.handle)
    })

    it('fails the load on a document it cannot trust', () => {
      expect(planner.load({ ...baseInput(), supplementary: '{"format":2}' })).toMatchObject({
        ok: false,
        error: { code: 'PLANNER_BAD_SUPPLEMENTARY' },
      })
      expect(planner.load({ ...baseInput(), supplementary: 'not json' })).toMatchObject({
        ok: false,
        error: { code: 'PLANNER_BAD_SUPPLEMENTARY' },
      })
    })
  })

  describe('result shape of the root relation', () => {
    const plan = (h: number, url: string, extra: Partial<PlanRequest> = {}) =>
      ok(planner.plan(h, { method: 'GET', url, ...extra }))
    const fieldsOf = (p: PlanSuccess): ShapeField[] => {
      if (!p.shape) throw new Error(`no shape: ${JSON.stringify(p)}`)
      return p.shape.fields
    }
    const summary = (fields: ShapeField[]) =>
      fields.map((f) => [f.name, f.pgType, f.nullable, f.provenance.kind])

    it('expands * in attnum order, with the source of every column', () => {
      const p = plan(catalog, '/users?select=*')
      expect(p).toMatchObject({ form: 'rowset', degraded: [] })
      expect(p.shape?.relation).toEqual({ schema: 'public', name: 'users' })
      expect(summary(fieldsOf(p))).toEqual([
        ['username', 'text', false, 'plain'],
        ['data', 'jsonb', true, 'plain'],
        ['age_range', 'int4range', true, 'plain'],
        ['status', 'public.user_status', true, 'plain'],
        ['catchphrase', 'tsvector', true, 'plain'],
      ])
      expect(fieldsOf(p)[0].provenance).toEqual({
        kind: 'plain',
        source: { schema: 'public', relation: 'users', column: 'username' },
      })
    })

    it('keeps attnum order when upstream expands * next to an aggregate', () => {
      const p = plan(catalog, '/users?select=*,count()')
      expect(p.degraded).toEqual([])
      expect(fieldsOf(p).map((f) => f.name)).toEqual([
        'username',
        'data',
        'age_range',
        'status',
        'catchphrase',
        'count',
      ])
    })

    it('uses the select order, aliases and the schema of Accept-Profile', () => {
      const p = plan(catalog, '/users?select=status,who:username', {
        headers: { 'Accept-Profile': 'personal' },
      })
      expect(p.shape?.relation).toEqual({ schema: 'personal', name: 'users' })
      expect(summary(fieldsOf(p))).toEqual([
        ['status', 'public.user_status', true, 'plain'],
        ['who', 'text', false, 'plain'],
      ])
      expect(fieldsOf(p)[1].provenance).toMatchObject({
        kind: 'plain',
        source: { schema: 'personal', relation: 'users', column: 'username' },
      })
    })

    it('names and types aggregates: count is a non-null int8, the others are nullable', () => {
      const p = plan(
        catalog,
        '/inference_cases?select=count(),n:count(),price.sum(),quantity.sum(),price.avg(),quantity.avg(),price.min(),quantity.max(),total:id.sum()'
      )
      expect(summary(fieldsOf(p))).toEqual([
        ['count', 'int8', false, 'aggregate'],
        ['n', 'int8', false, 'aggregate'],
        ['sum', 'numeric', true, 'aggregate'],
        ['sum', 'int8', true, 'aggregate'],
        ['avg', 'numeric', true, 'aggregate'],
        ['avg', 'numeric', true, 'aggregate'],
        ['min', 'numeric', true, 'aggregate'],
        ['max', 'int4', true, 'aggregate'],
        ['total', 'numeric', true, 'aggregate'],
      ])
      expect(fieldsOf(p)[2].provenance).toMatchObject({ kind: 'aggregate', function: 'sum' })
      expect(plan(catalog, '/messages?select=id.count()').shape?.fields[0]).toMatchObject({
        name: 'count',
        pgType: 'int8',
        nullable: false,
      })
    })

    it('names JSON paths after the last key and makes them nullable', () => {
      const p = plan(catalog, '/events?select=data->a,data->>b,data->c->>d,data->>0,id::text')
      expect(summary(fieldsOf(p))).toEqual([
        ['a', 'jsonb', true, 'jsonPath'],
        ['b', 'text', true, 'jsonPath'],
        ['d', 'text', true, 'jsonPath'],
        ['data', 'text', true, 'jsonPath'],
        ['id', 'text', false, 'cast'],
      ])
      expect(fieldsOf(p)[2].provenance).toEqual({
        kind: 'jsonPath',
        of: {
          kind: 'plain',
          source: { schema: 'public', relation: 'events', column: 'data' },
        },
        path: [
          { op: '->', key: 'c' },
          { op: '->>', key: 'd' },
        ],
      })
      expect(fieldsOf(p)[3].provenance).toMatchObject({ path: [{ op: '->>', index: 0 }] })
    })

    it('types casts with the normalised target and keeps the nullability of the source', () => {
      const p = plan(
        catalog,
        '/inference_cases?select=id::text,note::varchar,price::float,sequence_id::int,count()::float'
      )
      expect(summary(fieldsOf(p))).toEqual([
        ['id', 'text', false, 'cast'],
        ['note', 'varchar', true, 'cast'],
        ['price', 'float8', false, 'cast'],
        ['sequence_id', 'int4', false, 'cast'],
        ['count', 'float8', false, 'cast'],
      ])
      expect(fieldsOf(p)[1].provenance).toMatchObject({
        kind: 'cast',
        to: 'varchar',
        of: { kind: 'plain' },
      })
    })

    it('reports array, composite and enum columns by their normalised type', () => {
      const p = plan(catalog, '/inference_cases?select=tags,scores,shipping_address,status')
      expect(summary(fieldsOf(p)).map(([, type]) => type)).toEqual([
        'text[]',
        'int4[]',
        'public.address',
        'public.user_status',
      ])
    })

    it('resolves a computed field through the catalog', () => {
      const p = plan(catalog, '/messages?select=id,blurb_message')
      expect(p.degraded).toEqual([])
      expect(fieldsOf(p)[1]).toEqual({
        name: 'blurb_message',
        pgType: 'varchar',
        nullable: true,
        provenance: {
          kind: 'computed',
          function: { schema: 'public', name: 'blurb_message' },
          relation: { schema: 'public', name: 'messages' },
        },
      })
      const personal = plan(catalog, '/users?select=username_label', {
        headers: { 'Accept-Profile': 'personal' },
      })
      expect(fieldsOf(personal)[0]).toMatchObject({ pgType: 'text', nullable: true })
      expect(fieldsOf(personal)[0].provenance).toMatchObject({
        kind: 'computed',
        function: { schema: 'personal', name: 'username_label' },
      })
    })

    it('marks a field that is neither a column nor a computed field as unresolved', () => {
      const [field] = fieldsOf(plan(catalog, '/users?select=nope'))
      expect(field).toMatchObject({ name: 'nope', pgType: null, nullable: true })
      expect(field.provenance).toMatchObject({ kind: 'unresolved' })
    })

    it('degrades without the catalog: * is in dump order and computed fields are unknown', () => {
      const star = plan(handle, '/users?select=*')
      expect(star.degraded).toEqual(['column-order:public.users'])
      expect(
        fieldsOf(star)
          .map((f) => f.name)
          .sort()
      ).toEqual(['age_range', 'catchphrase', 'data', 'status', 'username'])
      // Upstream expands this one itself; the order is a guess all the same.
      expect(plan(handle, '/users?select=*,count()').degraded).toEqual([
        'column-order:public.users',
      ])

      const computed = plan(handle, '/messages?select=id,blurb_message')
      expect(computed.degraded).toEqual(['computed-field:public.messages.blurb_message'])
      expect(fieldsOf(computed)[1]).toMatchObject({ pgType: null, nullable: true })
      expect(fieldsOf(computed)[1].provenance).toMatchObject({ kind: 'unresolved' })

      // What does not depend on the catalog is exact and not degraded.
      expect(plan(handle, '/users?select=username,count()').degraded).toEqual([])
    })

    it('shapes the representation of a mutation', () => {
      const body = JSON.stringify({ message: 'hi', username: 'supabot', channel_id: 1 })
      const mutate = (url: string, prefer?: string) =>
        ok(
          planner.plan(catalog, {
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
            body,
          })
        )

      const star = mutate('/messages', 'return=representation')
      expect(star).toMatchObject({ form: 'rowset', degraded: [] })
      expect(star.shape?.relation).toEqual({ schema: 'public', name: 'messages' })
      expect(summary(fieldsOf(star))).toEqual([
        ['id', 'int8', false, 'plain'],
        ['data', 'jsonb', true, 'plain'],
        ['message', 'text', true, 'plain'],
        ['username', 'text', false, 'plain'],
        ['channel_id', 'int8', false, 'plain'],
      ])

      const picked = mutate('/messages?select=id,msg:message', 'return=representation')
      expect(summary(fieldsOf(picked))).toEqual([
        ['id', 'int8', false, 'plain'],
        ['msg', 'text', true, 'plain'],
      ])
      expect(fieldsOf(picked)[1].provenance).toMatchObject({
        kind: 'plain',
        source: { schema: 'public', relation: 'messages', column: 'message' },
      })

      const noBody = mutate('/messages')
      expect(noBody).toMatchObject({ form: 'none', shape: null })

      const del = ok(
        planner.plan(catalog, {
          method: 'DELETE',
          url: '/users?username=eq.a&select=username',
          headers: { Prefer: 'return=representation' },
        })
      )
      expect(summary(fieldsOf(del))).toEqual([['username', 'text', false, 'plain']])
    })

    it('says what it does not shape yet', () => {
      expect(plan(catalog, '/users?select=username,messages(id)').degraded).toEqual([
        'embeds-unshaped',
      ])
      const rpc = ok(
        planner.plan(catalog, {
          method: 'POST',
          url: '/rpc/get_status',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name_param: 'supabot' }),
        })
      )
      expect(rpc).toMatchObject({ form: 'single-scalar', shape: null, degraded: ['rpc-shape'] })
    })
  })

  it('throws when the wasm file is missing', async () => {
    await expect(loadPlanner({ wasmPath: '/nonexistent.wasm' })).rejects.toThrow(
      'nx build:wasm postgrest-planner'
    )
  })
})
