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
  type ShapeEmbed,
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

  describe('result shape of embeds', () => {
    const plan = (h: number, url: string, extra: Partial<PlanRequest> = {}) =>
      ok(planner.plan(h, { method: 'GET', url, ...extra }))
    const embedsOf = (p: PlanSuccess): ShapeEmbed[] => {
      if (!p.shape) throw new Error(`no shape: ${JSON.stringify(p)}`)
      return p.shape.embeds
    }
    const only = (p: PlanSuccess): ShapeEmbed => {
      const embeds = embedsOf(p)
      expect(embeds).toHaveLength(1)
      return embeds[0]
    }
    /** [path, cardinality, nullable, reason, fkProven] */
    const verdict = (e: ShapeEmbed) => [
      e.path.join('.'),
      e.cardinality,
      e.nullable,
      e.reason,
      e.fkProven,
    ]
    const names = (fields: ShapeField[]) => fields.map((f) => [f.name, f.pgType, f.nullable])
    const mutate = (url: string, prefer = 'return=representation') =>
      ok(
        planner.plan(catalog, {
          method: 'POST',
          url,
          headers: { 'Content-Type': 'application/json', Prefer: prefer },
          body: JSON.stringify({ message: 'hi', username: 'supabot', channel_id: 1 }),
        })
      )

    it('shapes a to-many embed as an array: fields first, star in attnum order, nested embeds', () => {
      const p = plan(catalog, '/channels?select=id,messages(*,users(username))')
      expect(p.degraded).toEqual([])
      expect(p.shape?.fields.map((f) => f.name)).toEqual(['id'])
      const messages = only(p)
      expect(messages).toMatchObject({
        name: 'messages',
        alias: null,
        key: 'messages',
        spread: false,
        empty: false,
        path: ['messages'],
        outputs: [['messages']],
        join: 'left',
        cardinality: 'many',
        nullable: false,
        reason: 'array',
        fkProven: false,
        relationship: {
          kind: 'o2m',
          fkSide: 'target',
          constraint: 'messages_channel_id_fkey',
          columns: [{ from: 'id', to: 'channel_id' }],
        },
        target: { schema: 'public', name: 'messages', kind: 'table' },
      })
      expect(messages.shape.relation).toEqual({ schema: 'public', name: 'messages' })
      expect(names(messages.shape.fields)).toEqual([
        ['id', 'int8', false],
        ['data', 'jsonb', true],
        ['message', 'text', true],
        ['username', 'text', false],
        ['channel_id', 'int8', false],
      ])
      expect(messages.shape.fields[2].provenance).toEqual({
        kind: 'plain',
        source: { schema: 'public', relation: 'messages', column: 'message' },
      })
      expect(messages.shape.embeds.map((e) => e.path)).toEqual([['messages', 'users']])
      expect(messages.shape.embeds[0].outputs).toEqual([['messages', 'users']])
    })

    it('describes a many-to-many embed by its junction', () => {
      const e = only(plan(catalog, '/products?select=id,categories(name)'))
      expect(e).toMatchObject({
        cardinality: 'many',
        nullable: false,
        reason: 'array',
        relationship: {
          kind: 'm2m',
          fkSide: null,
          junction: {
            schema: 'public',
            name: 'product_categories',
            constraints: [
              'product_categories_product_id_fkey',
              'product_categories_category_id_fkey',
            ],
          },
        },
      })
    })

    it('makes a many-to-one non-null when the key is NOT NULL and validated', () => {
      const p = plan(catalog, '/messages?select=id,users(username),channels(slug)')
      expect(embedsOf(p).map(verdict)).toEqual([
        ['users', 'one', false, 'fk-proven', true],
        ['channels', 'one', false, 'fk-proven', true],
      ])
      expect(embedsOf(p)[0].relationship).toEqual({
        kind: 'm2o',
        fkSide: 'origin',
        constraint: 'messages_username_fkey',
        columns: [{ from: 'username', to: 'username' }],
        junction: null,
        function: null,
      })
      // the columns of the embed are nullable on their own account
      expect(names(embedsOf(p)[1].shape.fields)).toEqual([['slug', 'text', true]])
    })

    it('keeps a to-one nullable when a key column is nullable', () => {
      expect(verdict(only(plan(catalog, '/user_profiles?select=id,users(username)')))).toEqual([
        'users',
        'one',
        true,
        'nullable-fk-column',
        false,
      ])
      expect(verdict(only(plan(catalog, '/booking?select=id,hotel(name)')))).toEqual([
        'hotel',
        'one',
        true,
        'nullable-fk-column',
        false,
      ])
    })

    it('does not prove a key that is NOT VALID, or one the catalog does not describe', () => {
      const supp = JSON.parse(supplementaryText())
      const fk = supp.foreignKeys.find(
        (k: { constraint: string }) => k.constraint === 'messages_username_fkey'
      )
      fk.validated = false
      const notValid = loaded(planner.load({ ...baseInput(), supplementary: supp })).handle
      try {
        const p = plan(notValid, '/messages?select=id,users(username),channels(id)')
        expect(embedsOf(p).map(verdict)).toEqual([
          ['users', 'one', true, 'fk-not-validated', false],
          ['channels', 'one', false, 'fk-proven', true],
        ])
        expect(p.degraded).toEqual([])
      } finally {
        planner.freeCache(notValid)
      }

      const p = plan(handle, '/messages?select=id,users(username)')
      expect(verdict(only(p))).toEqual(['users', 'one', true, 'fk-unknown', false])
      expect(p.degraded).toContain('fk-validation:public.messages.messages_username_fkey')
    })

    it('makes the inverse side of a one-to-one nullable and the owning side non-null', () => {
      const inverse = only(plan(catalog, '/channels?select=id,channel_details(details)'))
      expect(verdict(inverse)).toEqual(['channel_details', 'one', true, 'inverse-o2o', false])
      expect(inverse.relationship).toMatchObject({ kind: 'o2o', fkSide: 'target' })

      const owning = only(plan(catalog, '/channel_details?select=id,channels(slug)'))
      expect(verdict(owning)).toEqual(['channels', 'one', false, 'fk-proven', true])
      expect(owning.relationship).toMatchObject({ kind: 'o2o', fkSide: 'origin' })
    })

    it('makes a view target nullable', () => {
      const toOne = only(plan(catalog, '/messages?select=id,active_users(username)'))
      expect(toOne.target).toEqual({ schema: 'public', name: 'active_users', kind: 'view' })
      expect(verdict(toOne)).toEqual(['active_users', 'one', true, 'view-target', false])

      const toMany = only(plan(catalog, '/users?select=username,recent_messages(id)'))
      expect(toMany.target.kind).toBe('view')
      expect(verdict(toMany)).toEqual(['recent_messages', 'many', false, 'array', false])
    })

    it('does not prove a row from a view origin, and resolves a computed relationship by its table', () => {
      expect(verdict(only(plan(catalog, '/recent_messages?select=id,users(username)')))).toEqual([
        'users',
        'one',
        true,
        'view-origin',
        false,
      ])

      const toOne = only(plan(catalog, '/users?select=username,get_user_profile(*)'))
      expect(toOne.target).toEqual({ schema: 'public', name: 'user_profiles', kind: 'function' })
      expect(toOne.relationship).toMatchObject({
        kind: 'computed',
        function: { schema: 'public', name: 'get_user_profile' },
      })
      expect(verdict(toOne)).toEqual(['get_user_profile', 'one', true, 'computed', false])
      // the fields are those of the table the function returns
      expect(toOne.shape.relation).toEqual({ schema: 'public', name: 'user_profiles' })
      expect(names(toOne.shape.fields)).toEqual([
        ['id', 'int8', false],
        ['username', 'text', true],
      ])

      const toMany = only(plan(catalog, '/channels?select=id,get_messages(id)'))
      expect(verdict(toMany)).toEqual(['get_messages', 'many', false, 'array', false])
    })

    it('makes !inner non-null, and a filter, offset or limit of 0 on a left join nullable', () => {
      const inner = only(plan(catalog, '/booking?select=id,hotel!inner(name)'))
      expect(inner.join).toBe('inner')
      expect(verdict(inner)).toEqual(['hotel', 'one', false, 'inner-join', false])

      const url = (q: string) => `/messages?select=id,users${q}(username)`
      expect(verdict(only(plan(catalog, url('') + '&users.username=eq.supabot')))).toEqual([
        'users',
        'one',
        true,
        'filtered',
        true,
      ])
      expect(verdict(only(plan(catalog, url('') + '&users.limit=0')))[3]).toBe('filtered')
      expect(verdict(only(plan(catalog, url('') + '&users.offset=1')))[3]).toBe('filtered')
      expect(verdict(only(plan(catalog, url('!inner') + '&users.username=eq.supabot')))).toEqual([
        'users',
        'one',
        false,
        'inner-join',
        true,
      ])
    })

    it('makes a parent drop-capable when a nested !inner can remove its row', () => {
      const p = plan(catalog, '/messages?select=id,channels(id,channel_details!inner(details))')
      const channels = only(p)
      expect(verdict(channels)).toEqual(['channels', 'one', true, 'nested-inner', true])
      expect(verdict(channels.shape.embeds[0])).toEqual([
        'channels.channel_details',
        'one',
        false,
        'inner-join',
        false,
      ])
      expect(channels.shape.embeds[0].outputs).toEqual([['channels', 'channel_details']])

      // an !inner parent drops the root row instead of being null
      const inner = only(
        plan(catalog, '/messages?select=id,channels!inner(id,channel_details!inner(details))')
      )
      expect(verdict(inner)).toEqual(['channels', 'one', false, 'inner-join', true])
    })

    it('gives an empty embed no key and no output', () => {
      const p = plan(catalog, '/messages?select=id,users()&users.username=eq.supabot')
      const e = only(p)
      expect(e).toMatchObject({
        name: 'users',
        key: null,
        empty: true,
        outputs: [],
        path: ['users'],
      })
      expect(e.shape.fields).toEqual([])
      expect(p.shape?.fields.map((f) => f.name)).toEqual(['id'])
    })

    it('merges a to-one spread into the parent: non-null when the join cannot miss', () => {
      const e = only(plan(catalog, '/messages?select=id,...users(username,status)'))
      expect(e).toMatchObject({
        spread: true,
        key: null,
        path: ['users'],
        outputs: [['username'], ['status']],
        cardinality: 'one',
        nullable: false,
        reason: 'fk-proven',
      })
      expect(names(e.shape.fields)).toEqual([
        ['username', 'text', false],
        ['status', 'public.user_status', true],
      ])
    })

    it('ors the nullability of a to-one spread into every merged field and nested embed', () => {
      const e = only(plan(catalog, '/booking?select=id,...hotel(id,name,b:booking(id))'))
      expect(e).toMatchObject({
        spread: true,
        nullable: true,
        reason: 'nullable-fk-column',
        outputs: [['id'], ['name'], ['b']],
      })
      expect(names(e.shape.fields)).toEqual([
        ['id', 'int8', true],
        ['name', 'text', true],
      ])
      expect(e.shape.embeds.map(verdict)).toEqual([
        ['hotel.b', 'many', true, 'spread-parent', false],
      ])

      const inverse = only(
        plan(catalog, '/channels?select=id,...channel_details(*,channels(slug))')
      )
      expect(names(inverse.shape.fields)).toEqual([
        ['id', 'int8', true],
        ['details', 'text', true],
      ])
      expect(verdict(inverse.shape.embeds[0])).toEqual([
        'channel_details.channels',
        'one',
        true,
        'spread-parent',
        true,
      ])
    })

    it('spreads a to-many embed as per-field arrays', () => {
      const e = only(plan(catalog, '/users?select=username,...messages(id,message)'))
      expect(e).toMatchObject({
        spread: true,
        key: null,
        cardinality: 'many',
        nullable: false,
        reason: 'array',
        outputs: [['id'], ['message']],
      })
      // the fields are the elements of the arrays
      expect(names(e.shape.fields)).toEqual([
        ['id', 'int8', false],
        ['message', 'text', true],
      ])

      expect(
        planner.plan(catalog, { method: 'GET', url: '/users?select=username,...messages(count())' })
      ).toMatchObject({ ok: false, error: { code: 'PGRST127' } })
    })

    it('puts hoisted spread aggregates back on the fields of the spread that wrote them', () => {
      const e = only(
        plan(
          catalog,
          '/messages?select=id,...channels(slug,...channel_details(d:details.max(),c:id.count()))'
        )
      )
      expect(e.outputs).toEqual([['slug'], ['d'], ['c']])
      expect(names(e.shape.fields)).toEqual([['slug', 'text', true]])
      const nested = e.shape.embeds[0]
      expect(nested.outputs).toEqual([['d'], ['c']])
      expect(names(nested.shape.fields)).toEqual([
        ['d', 'text', true],
        ['c', 'int8', false],
      ])
      expect(nested.shape.fields[0].provenance).toEqual({
        kind: 'aggregate',
        function: 'max',
        of: {
          kind: 'plain',
          source: { schema: 'public', relation: 'channel_details', column: 'details' },
        },
      })

      // a * is one entry of the spread, not one per column
      const star = only(
        plan(catalog, '/messages?select=*,...channels(*,...channel_details(d:details.max()))')
      )
      expect(names(star.shape.fields)).toEqual([
        ['id', 'int8', false],
        ['data', 'jsonb', true],
        ['slug', 'text', true],
      ])
      expect(names(star.shape.embeds[0].shape.fields)).toEqual([['d', 'text', true]])
    })

    it('makes every left-joined to-one of a mutation nullable, but not !inner', () => {
      const get = plan(catalog, '/messages?select=id,users(username),channels!inner(slug)')
      expect(embedsOf(get).map(verdict)).toEqual([
        ['users', 'one', false, 'fk-proven', true],
        ['channels', 'one', false, 'inner-join', true],
      ])
      const post = mutate('/messages?select=id,users(username,m:messages(id)),channels!inner(slug)')
      expect(post.form).toBe('rowset')
      expect(embedsOf(post).map(verdict)).toEqual([
        ['users', 'one', true, 'write', true],
        ['channels', 'one', false, 'inner-join', true],
      ])
      expect(embedsOf(post)[0].shape.embeds.map(verdict)).toEqual([
        ['users.m', 'many', false, 'array', false],
      ])
      expect(mutate('/messages?select=id,users(username)', 'return=minimal').shape).toBeNull()
    })

    it('fails the plan when a filter targets an embed that is not selected', () => {
      expect(
        planner.plan(catalog, { method: 'GET', url: '/messages?select=id&users.username=eq.x' })
      ).toMatchObject({ ok: false, error: { code: 'PGRST108' } })
    })

    it('identifies aliased embeds by their keys', () => {
      const p = plan(
        catalog,
        '/messages?select=id,u:users(username),v:users(username,m:messages(id))'
      )
      expect(embedsOf(p).map((e) => [e.name, e.alias, e.key, e.path, e.outputs])).toEqual([
        ['users', 'u', 'u', ['u'], [['u']]],
        ['users', 'v', 'v', ['v'], [['v']]],
      ])
      const nested = embedsOf(p)[1].shape.embeds[0]
      expect(nested).toMatchObject({ name: 'messages', alias: 'm', path: ['v', 'm'] })
      expect(nested.outputs).toEqual([['v', 'm']])

      // the keys of a spread are those of the row it is merged into
      const spread = only(
        plan(catalog, '/messages?select=id,c:channels(slug,...channel_details(details))')
      )
      expect(spread.shape.embeds[0]).toMatchObject({
        spread: true,
        path: ['c', 'channel_details'],
        outputs: [['c', 'details']],
      })
    })
  })

  it('throws when the wasm file is missing', async () => {
    await expect(loadPlanner({ wasmPath: '/nonexistent.wasm' })).rejects.toThrow(
      'nx build:wasm postgrest-planner'
    )
  })
})
