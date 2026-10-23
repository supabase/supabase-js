import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  defaultWasmPath,
  loadPlanner,
  parseConfigDump,
  type EmbedPlan,
  type LoadInput,
  type LoadSuccess,
  type PlanCrud,
  type PlanMutation,
  type Planner,
  type PlanRequest,
  type PlanResult,
  type PlanRpc,
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

/** A successful CRUD plan; the mutation and RPC parts are optional so one helper serves every test. */
type Crud = PlanCrud &
  Partial<Pick<PlanMutation, 'mutation'> & Pick<PlanRpc, 'call' | 'routine' | 'payloadKeys'>>
const ok = (res: PlanResult): Crud => {
  if (!res.ok) throw new Error(`plan failed: ${JSON.stringify(res)}`)
  if (!('select' in res)) throw new Error(`not a crud plan: ${res.action}`)
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

    it('reads an empty select as *', () => {
      const star = plan(catalog, '/users?select=*')
      const empty = plan(catalog, '/users?select=')
      expect(summary(fieldsOf(empty))).toEqual(summary(fieldsOf(star)))
      expect(summary(fieldsOf(empty))).toHaveLength(5)
      // an embed next to nothing is not an empty select
      expect(fieldsOf(plan(catalog, '/users?select=messages(id)'))).toEqual([])
      // without the order of the columns it degrades as * does
      expect(plan(handle, '/users?select=').degraded).toEqual(
        plan(handle, '/users?select=*').degraded
      )
    })

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

    it('keeps non-null through a cast to text and a cast the allowlist covers, not into a user type', () => {
      // the cast to a domain, enum, composite or extension type can return NULL; the output function of any
      // type to text cannot (the allowlist is in castKeepsNonNull)
      const p = plan(
        catalog,
        '/inference_cases?select=a:status::text,b:id::user_status,c:id::text,d:tags::text,e:count()::text,f:shipping_address::text'
      )
      expect(summary(fieldsOf(p))).toEqual([
        ['a', 'text', false, 'cast'],
        ['b', 'public.user_status', true, 'cast'],
        ['c', 'text', false, 'cast'],
        ['d', 'text', false, 'cast'],
        ['e', 'text', false, 'cast'],
        ['f', 'text', true, 'cast'], // the column is nullable
      ])
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

    it('reads a bare count as count(): the Postgres row-attribute spelling of the aggregate', () => {
      const embedded = plan(catalog, '/users?select=username,messages(count)').shape?.embeds[0]
      expect(embedded?.shape.fields).toEqual([
        {
          name: 'count',
          pgType: 'int8',
          nullable: false,
          provenance: { kind: 'aggregate', function: 'count', of: null },
        },
      ])
      const nested = plan(catalog, '/users?select=username,messages(channels(count))').shape
        ?.embeds[0].shape.embeds[0]
      expect(nested?.cardinality).toBe('one')
      expect(nested?.shape.fields[0]).toMatchObject({
        name: 'count',
        pgType: 'int8',
        nullable: false,
      })
      expect(summary(fieldsOf(plan(catalog, '/messages?select=count,n:count::text')))).toEqual([
        ['count', 'int8', false, 'aggregate'],
        ['n', 'text', false, 'cast'],
      ])
      // only that name has the spelling: any other aggregate, or an unknown name, stays unresolved
      for (const url of [
        '/users?select=username,messages(sum)',
        '/users?select=username,messages(foo)',
        '/messages?select=sum',
      ]) {
        const p = plan(catalog, url)
        const field = p.shape?.embeds[0]?.shape.fields[0] ?? p.shape?.fields[0]
        expect(field?.provenance).toMatchObject({ kind: 'unresolved' })
      }
      // a path is not the legacy spelling: it reads a column that is not there
      expect(fieldsOf(plan(catalog, '/events?select=count->>a'))[0].provenance).toMatchObject({
        kind: 'jsonPath',
        of: { kind: 'unresolved' },
      })
    })

    describe('expression typing', () => {
      /** The fixture plus domain and json columns on inference_cases and a json attribute on public.address. */
      let typed: number
      const column = (name: string, nominal: string, type: string) => ({
        colDefault: null,
        colDescription: null,
        colEnum: [],
        colMaxLen: null,
        colName: name,
        colNominalType: nominal,
        colNullable: true,
        colType: type,
      })
      beforeAll(() => {
        const dump = JSON.parse(readFileSync(join(fixtures, 'dump-schema.json'), 'utf8'))
        for (const [qi, table] of dump.dbTables) {
          if (qi.qiSchema !== 'public' || qi.qiName !== 'inference_cases') continue
          table.tableColumns.dom_int = column('dom_int', 'public.dom_int', 'integer')
          table.tableColumns.dom_num = column('dom_num', 'public.dom_num', 'numeric')
          table.tableColumns.dom_float = column('dom_float', 'public.dom_float', 'real')
          table.tableColumns.dom_json = column('dom_json', 'public.dom_json', 'json')
          table.tableColumns.json_col = column('json_col', 'json', 'json')
        }
        const supp = JSON.parse(supplementaryText())
        for (const c of supp.composites) {
          if (c.schema === 'public' && c.name === 'address') {
            c.attributes.push({ name: 'data', type: 'json', attnum: 3 })
          }
        }
        typed = loaded(
          planner.load({ ...baseInput(), schema: JSON.stringify(dump), supplementary: supp })
        ).handle
      })
      afterAll(() => planner.freeCache(typed))

      it('dispatches an aggregate over a domain on its base type', () => {
        const p = plan(
          typed,
          '/inference_cases?select=dom_int.sum(),a:dom_int.avg(),dom_int.min(),dom_int.max(),dom_num.sum(),dom_float.sum(),dom_float.avg()'
        )
        expect(summary(fieldsOf(p))).toEqual([
          ['sum', 'int8', true, 'aggregate'],
          ['a', 'numeric', true, 'aggregate'],
          ['min', 'int4', true, 'aggregate'],
          ['max', 'int4', true, 'aggregate'],
          ['sum', 'numeric', true, 'aggregate'],
          ['sum', 'float4', true, 'aggregate'],
          ['avg', 'float8', true, 'aggregate'],
        ])
      })

      it('types min and max as Postgres resolves them: coerced to the variant that exists, else unresolved', () => {
        const p = plan(
          catalog,
          '/aggregate_types?select=v.min(),a:v.max(),bp.min(),nm.min(),qc.max(),cd.min(),ip.max(),rc.min(),ts.max(),nu.min(),ar.max(),st.min()'
        )
        // varchar, name and "char" read as text, cidr as inet, the reg* types as oid; the others keep their type
        expect(summary(fieldsOf(p))).toEqual([
          ['min', 'text', true, 'aggregate'],
          ['a', 'text', true, 'aggregate'],
          ['min', 'bpchar', true, 'aggregate'],
          ['min', 'text', true, 'aggregate'],
          ['max', 'text', true, 'aggregate'],
          ['min', 'inet', true, 'aggregate'],
          ['max', 'inet', true, 'aggregate'],
          ['min', 'oid', true, 'aggregate'],
          ['max', 'timestamptz', true, 'aggregate'],
          ['min', 'numeric', true, 'aggregate'],
          ['max', 'int4[]', true, 'aggregate'],
          ['min', 'public.user_status', true, 'aggregate'],
        ])
        // no min or max exists for these (42883 in Postgres): unresolved, not the input type
        const none = plan(catalog, '/aggregate_types?select=u.min(),flag.max(),doc.min()')
        expect(summary(fieldsOf(none))).toEqual([
          ['min', null, true, 'unresolved'],
          ['max', null, true, 'unresolved'],
          ['min', null, true, 'unresolved'],
        ])
        expect(fieldsOf(none)[0].provenance).toMatchObject({
          kind: 'unresolved',
          reason: expect.stringContaining('uuid'),
        })
      })

      it('types an aggregate over a computed field of a domain on the base type of the domain', () => {
        // domain_items.qty is a column of the domain, which is how the catalog learns its base type
        const p = plan(catalog, '/domain_items?select=amount.sum(),a:amount.avg(),amount.min()')
        expect(summary(fieldsOf(p))).toEqual([
          ['sum', 'int8', true, 'aggregate'],
          ['a', 'numeric', true, 'aggregate'],
          ['min', 'int4', true, 'aggregate'],
        ])
        // without the aggregate the field is the domain
        expect(fieldsOf(plan(catalog, '/domain_items?select=amount'))[0]).toMatchObject({
          pgType: 'public.item_amount',
          baseType: 'int4',
        })
      })

      it('ignores a second cast when there is no aggregate', () => {
        // upstream parses it into aggCast, but pgFmtApplyAggregate Nothing drops it: the value stays text
        const [field] = fieldsOf(plan(catalog, '/inference_cases?select=id::text::int4'))
        expect(field).toMatchObject({ name: 'id', pgType: 'text', nullable: false })
        expect(field.provenance).toMatchObject({ kind: 'cast', to: 'text' })
        // with an aggregate the second cast applies
        expect(
          summary(fieldsOf(plan(catalog, '/inference_cases?select=id::text.count()::text')))
        ).toEqual([['count', 'text', false, 'cast']])
        expect(
          summary(fieldsOf(plan(catalog, '/inference_cases?select=price.sum()::int4')))
        ).toEqual([['sum', 'int4', true, 'cast']])
      })

      it('types a JSON path by the to_jsonb the plan applies, not by the column', () => {
        // json and jsonb columns are read as they are; every other type (a domain over json too) goes through to_jsonb
        const p = plan(
          typed,
          '/inference_cases?select=json_col->a,jb:optional_payload->a,dom_json->a,j:json_col->>a'
        )
        expect(summary(fieldsOf(p))).toEqual([
          ['a', 'json', true, 'jsonPath'],
          ['jb', 'jsonb', true, 'jsonPath'],
          ['a', 'jsonb', true, 'jsonPath'],
          ['j', 'text', true, 'jsonPath'],
        ])
        // the attributes of a standalone composite are not in dbTables: upstream applies to_jsonb to them
        const rpc = ok(
          planner.plan(typed, {
            method: 'POST',
            url: '/rpc/echo_address?select=data->x',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: { street: 's', city: 'c' } }),
          })
        )
        expect(summary(fieldsOf(rpc))).toEqual([['x', 'jsonb', true, 'jsonPath']])
      })

      it('leaves a cast to a type that does not exist unresolved, with a note, and keeps planning', () => {
        const p = plan(
          catalog,
          '/inference_cases?select=a:id::fakecolumntype,b:id::fakecolumntype.count()'
        )
        expect(summary(fieldsOf(p))).toEqual([
          ['a', null, true, 'unresolved'],
          ['b', 'int8', false, 'aggregate'],
        ])
        expect(p.degraded).toEqual(['cast-type:fakecolumntype'])
        expect(fieldsOf(p)[0].provenance).toMatchObject({
          kind: 'unresolved',
          reason: expect.stringContaining('fakecolumntype'),
        })
        expect(fieldsOf(p)[1].provenance).toMatchObject({ of: { kind: 'unresolved' } })
      })

      it('resolves a cast name like Postgres: aliases, pg_catalog, then the search path', () => {
        const p = plan(
          catalog,
          '/inference_cases?select=a:id::int,b:id::double%20precision,c:id::character%20varying,d:id::user_status,e:id::address,f:id::_int4'
        )
        expect(p.degraded).toEqual([])
        expect(fieldsOf(p).map((f) => f.pgType)).toEqual([
          'int4',
          'float8',
          'varchar',
          'public.user_status',
          'public.address',
          'int4[]',
        ])
        // the request schema comes first, then db-extra-search-path (public,extensions): personal has its own
        // user_status, which the catalog enumerates although no column of the request schema mentions it
        const personal = plan(catalog, '/users?select=s:username::user_status', {
          headers: { 'Accept-Profile': 'personal' },
        })
        expect(fieldsOf(personal)[0].pgType).toBe('personal.user_status')
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
      // the function returns ONE composite: a row always comes back, of NULLs when nothing matches
      expect(verdict(toOne)).toEqual(['get_user_profile', 'one', false, 'single-composite', false])
      // the fields are those of the table the function returns, read as function rows
      expect(toOne.shape.relation).toEqual({ schema: 'public', name: 'user_profiles' })
      expect(names(toOne.shape.fields)).toEqual([
        ['id', 'int8', true],
        ['username', 'text', true],
      ])
      expect(toOne.shape.fields.every((f) => f.reason === 'function-rows')).toBe(true)

      const toMany = only(plan(catalog, '/channels?select=id,get_messages(id)'))
      expect(verdict(toMany)).toEqual(['get_messages', 'many', false, 'array', false])
    })

    it('makes a computed relationship to a single composite non-null, not a setof one, and every field nullable', () => {
      const single = only(plan(catalog, '/users?select=username,function_using_table_returns(*)'))
      expect(verdict(single)).toEqual([
        'function_using_table_returns',
        'one',
        false,
        'single-composite',
        false,
      ])
      expect(names(single.shape.fields)).toEqual([
        ['id', 'int8', true],
        ['username', 'text', true],
      ])
      // a filter on the embed can still drop its row (it is nullable as any computed to-one), !inner is non-null
      expect(
        verdict(
          only(
            plan(
              catalog,
              '/users?select=username,function_using_table_returns(*)&function_using_table_returns.id=eq.1'
            )
          )
        )
      ).toEqual(['function_using_table_returns', 'one', true, 'computed', false])
      expect(
        verdict(
          only(plan(catalog, '/users?select=username,function_using_table_returns!inner(*)'))
        )[3]
      ).toBe('inner-join')

      // a setof function (ROWS 1) has no row when nothing matches: still nullable, columns as declared
      const setof = only(plan(catalog, '/users?select=username,function_using_setof_rows_one(*)'))
      expect(verdict(setof)).toEqual([
        'function_using_setof_rows_one',
        'one',
        true,
        'computed',
        false,
      ])
      // its rows are the rows of a function as well: the NOT NULL of the table does not hold
      expect(names(setof.shape.fields)).toEqual([
        ['id', 'int8', true],
        ['username', 'text', true],
      ])
    })

    it('matches the argument of a computed relationship to the function, not to a function of the same name', () => {
      // computed_child(computed_parents) RETURNS SETOF ... ROWS 1 has an unnamed argument, which upstream keeps out
      // of its routines (it is no RPC) but keeps as a relationship; computed_child(n integer) is the only routine
      // of the name and returns a single composite
      const setof = only(plan(catalog, '/computed_parents?select=id,computed_child(id)'))
      expect(setof.relationship).toMatchObject({
        kind: 'computed',
        function: { schema: 'public', name: 'computed_child' },
      })
      expect(verdict(setof)).toEqual(['computed_child', 'one', true, 'computed', false])
      // no routine takes the table: the catalog says what the unnamed-argument function returns
      const single = only(plan(catalog, '/computed_parents?select=id,computed_only_child(id)'))
      expect(verdict(single)).toEqual([
        'computed_only_child',
        'one',
        false,
        'single-composite',
        false,
      ])
      // without a catalog nothing proves it
      expect(
        verdict(only(plan(handle, '/computed_parents?select=id,computed_only_child(id)')))
      ).toEqual(['computed_only_child', 'one', true, 'computed', false])
    })

    it('takes the function of a computed relationship from the overload with exactly the table as its argument', () => {
      // arity_child(arity_parents) RETURNS SETOF ... ROWS 1 has an unnamed argument, which upstream keeps out of its
      // routines but keeps as a relationship; arity_child(p arity_parents, n integer) takes two arguments, so it is
      // no relationship (pronargs = 1) and does not tell what the relationship returns
      const setof = only(plan(catalog, '/arity_parents?select=id,arity_child(id)'))
      expect(setof.relationship).toMatchObject({
        kind: 'computed',
        function: { schema: 'public', name: 'arity_child' },
      })
      expect(verdict(setof)).toEqual(['arity_child', 'one', true, 'computed', false])
    })

    it('reads the rows of a computed relationship as function rows, and so its first-level to-one embeds', () => {
      // a function can return rows its table refuses: NOT NULL columns and proven keys do not hold
      const toMany = only(
        plan(
          catalog,
          '/channels?select=id,get_messages(id,message,users(username,messages(id)),channels!inner(slug))'
        )
      )
      expect(verdict(toMany)).toEqual(['get_messages', 'many', false, 'array', false])
      expect(toMany.shape.fields.map((f) => [f.name, f.nullable, f.reason])).toEqual([
        ['id', true, 'function-rows'],
        ['message', true, 'function-rows'],
      ])
      const [users, channels] = toMany.shape.embeds
      // the join keeps what proves the row, for a printer that can trace the function
      expect(users).toMatchObject({
        key: 'users',
        nullable: true,
        reason: 'function-rows',
        fkProven: true,
      })
      // the usual rules from the second level down, and a missing !inner row drops the row
      expect(users.shape.fields.map((f) => [f.name, f.nullable, f.reason])).toEqual([
        ['username', false, undefined],
      ])
      expect(users.shape.embeds[0]).toMatchObject({ nullable: false, reason: 'array' })
      expect(channels).toMatchObject({ nullable: false, reason: 'inner-join' })

      // a to-one setof function (ROWS 1) too
      const setof = only(plan(catalog, '/users?select=username,function_using_setof_rows_one(*)'))
      expect(verdict(setof)).toEqual([
        'function_using_setof_rows_one',
        'one',
        true,
        'computed',
        false,
      ])
      expect(setof.shape.fields.map((f) => [f.name, f.nullable, f.reason])).toEqual([
        ['id', true, 'function-rows'],
        ['username', true, 'function-rows'],
      ])
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

  describe('rpc plans', () => {
    const post = (h: number, name: string, args: object = {}) =>
      planner.plan(h, {
        method: 'POST',
        url: `/rpc/${name}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
    const get = (h: number, path: string) => planner.plan(h, { method: 'GET', url: `/rpc/${path}` })
    const shapeOf = (p: PlanSuccess) => {
      if (!p.shape) throw new Error(`no shape: ${JSON.stringify(p)}`)
      return p.shape
    }
    /** [name, pgType, nullable, reason] */
    const summary = (fields: ShapeField[]) =>
      fields.map((f) => [f.name, f.pgType, f.nullable, f.reason])

    it('gives a scalar function a form and no shape', () => {
      const p = ok(post(catalog, 'get_status', { name_param: 'supabot' }))
      expect(p).toMatchObject({
        form: 'single-scalar',
        shape: null,
        filters: [],
        degraded: [],
        rpc: {
          function: { schema: 'public', name: 'get_status' },
          volatility: 'immutable',
          source: null,
        },
      })
      expect(ok(post(catalog, 'void_func')).form).toBe('single-scalar')
    })

    it('gives a set of scalars its own form', () => {
      // the test database has no function that returns a set of scalars: make get_status one
      const dump = JSON.parse(readFileSync(join(fixtures, 'dump-schema.json'), 'utf8'))
      for (const [, routines] of dump.dbRoutines) {
        for (const r of routines) {
          if (r.pdSchema === 'public' && r.pdName === 'get_status') r.pdReturnType.tag = 'SetOf'
        }
      }
      const custom = loaded(
        planner.load({
          ...baseInput(),
          schema: JSON.stringify(dump),
          supplementary: supplementaryText(),
        })
      ).handle
      try {
        expect(ok(post(custom, 'get_status', { name_param: 'supabot' }))).toMatchObject({
          form: 'setof-scalar',
          shape: null,
          rpc: { function: { name: 'get_status' }, source: null },
        })
      } finally {
        planner.freeCache(custom)
      }
    })

    it('shapes a composite type by its attributes', () => {
      const p = ok(post(catalog, 'echo_address', { address: { street: 's', city: 'c' } }))
      expect(p.form).toBe('single-composite')
      expect(p.rpc).toMatchObject({
        function: { name: 'echo_address' },
        volatility: 'immutable',
        source: { kind: 'composite', schema: 'public', name: 'address' },
      })
      const shape = shapeOf(p)
      expect(shape.relation).toEqual({ schema: 'public', name: 'address' })
      expect(summary(shape.fields)).toEqual([
        ['street', 'text', true, 'function-rows'],
        ['city', 'text', true, 'function-rows'],
      ])
      expect(shape.fields[0].provenance).toEqual({
        kind: 'compositeAttribute',
        type: { schema: 'public', name: 'address' },
        attribute: 'street',
      })
    })

    it('shapes a row of a table, and a set of rows of a table or a view', () => {
      const row = ok(post(catalog, 'function_returning_row'))
      expect(row.form).toBe('single-composite')
      expect(row.rpc?.source).toEqual({
        kind: 'relation',
        schema: 'public',
        name: 'users',
        view: false,
      })

      const set = ok(get(catalog, 'get_messages_by_username?search_username=x'))
      expect(set.form).toBe('rowset')
      expect(set.rpc).toMatchObject({
        volatility: 'stable',
        source: { kind: 'relation', schema: 'public', name: 'messages', view: false },
      })
      const direct = ok(planner.plan(catalog, { method: 'GET', url: '/messages' }))
      // the columns of the table, in attnum order, with the provenance a read gives them
      expect(shapeOf(set).fields.map((f) => [f.name, f.pgType])).toEqual(
        shapeOf(direct).fields.map((f) => [f.name, f.pgType])
      )
      // a function's rows are marked: the table's constraints do not hold for what a function returns
      expect(shapeOf(set).fields[0].provenance).toEqual({
        ...shapeOf(direct).fields[0].provenance,
        functionRows: true,
      })

      const view = ok(get(catalog, 'get_recent_messages_by_username?search_username=x&select=id'))
      expect(view.rpc?.source).toEqual({
        kind: 'relation',
        schema: 'public',
        name: 'recent_messages',
        view: true,
      })
    })

    it('makes every field of function rows nullable, whatever the column says', () => {
      const p = ok(get(catalog, 'get_messages_by_username?search_username=x'))
      const fields = shapeOf(p).fields
      expect(fields.length).toBeGreaterThan(1)
      expect(fields.every((f) => f.nullable && f.reason === 'function-rows')).toBe(true)
      // read with the same columns, the primary key is not null
      const read = ok(planner.plan(catalog, { method: 'GET', url: '/messages?select=id' }))
      expect(shapeOf(read).fields[0]).toMatchObject({ name: 'id', nullable: false })

      // a cast keeps what it casts, a JSON path and an aggregate are nullable by themselves
      const mixed = ok(
        get(catalog, 'function_returning_set_of_rows?select=username::text,data->a,status')
      )
      expect(summary(shapeOf(mixed).fields)).toEqual([
        ['username', 'text', true, 'function-rows'],
        ['a', 'jsonb', true, undefined],
        ['status', 'public.user_status', true, 'function-rows'],
      ])
    })

    it('keeps the function rows on the provenance under a JSON path, a cast and an aggregate', () => {
      const p = ok(
        get(
          catalog,
          'function_returning_set_of_rows?select=a:data->>theme,b:data->theme,c:username::text,d:username.max(),username'
        )
      )
      const column = {
        kind: 'plain',
        functionRows: true,
        source: { schema: 'public', relation: 'users' },
      }
      const prov = (name: string) => shapeOf(p).fields.find((f) => f.name === name)?.provenance
      expect(prov('a')).toMatchObject({ kind: 'jsonPath', of: column })
      expect(prov('b')).toMatchObject({ kind: 'jsonPath', of: column })
      expect(prov('c')).toMatchObject({ kind: 'cast', of: column })
      expect(prov('d')).toMatchObject({ kind: 'aggregate', of: column })
      expect(prov('username')).toMatchObject(column)
      // the rows of a table are not function rows
      const table = ok(
        planner.plan(catalog, { method: 'GET', url: '/users?select=username,data->>theme' })
      )
      expect(JSON.stringify(shapeOf(table).fields.map((f) => f.provenance))).not.toContain(
        'functionRows'
      )
    })

    it('reads an empty select of a function as *', () => {
      const rows = ok(get(catalog, 'get_messages_by_username?search_username=x&select='))
      const star = ok(get(catalog, 'get_messages_by_username?search_username=x&select=*'))
      expect(shapeOf(rows).fields.length).toBeGreaterThan(0)
      expect(summary(shapeOf(rows).fields)).toEqual(summary(shapeOf(star).fields))
      const table = ok(get(catalog, 'get_username_and_status?name_param=x&select='))
      expect(shapeOf(table).fields.map((f) => f.name)).toEqual(['username', 'status'])
    })

    it('types the columns of RETURNS TABLE from the catalog', () => {
      const p = ok(get(catalog, 'get_username_and_status?name_param=x'))
      expect(p.form).toBe('rowset')
      expect(p.degraded).toEqual([])
      expect(p.rpc?.source).toEqual({
        kind: 'returnsTable',
        columns: [
          { name: 'username', pgType: 'text' },
          { name: 'status', pgType: 'public.user_status' },
        ],
      })
      const shape = shapeOf(p)
      expect(shape.relation).toEqual({ schema: 'pg_catalog', name: 'record' })
      expect(summary(shape.fields)).toEqual([
        ['username', 'text', true, 'function-rows'],
        ['status', 'public.user_status', true, 'function-rows'],
      ])
      expect(shape.fields[1].provenance).toEqual({
        kind: 'outColumn',
        function: { schema: 'public', name: 'get_username_and_status' },
        column: 'status',
      })
      // only the selected columns, under their alias
      const picked = ok(get(catalog, 'get_username_and_status?name_param=x&select=u:username'))
      expect(shapeOf(picked).fields.map((f) => f.name)).toEqual(['u'])
    })

    it('reads the single OUT, INOUT and RETURNS TABLE column of a function from the catalog', () => {
      // upstream encodes all three as a composite of the column's type: f(INOUT n int) answers {"n": 3}
      const inout = ok(get(catalog, 'out_inout?n=2'))
      expect(inout).toMatchObject({ form: 'single-composite', degraded: [] })
      expect(inout.rpc?.source).toEqual({
        kind: 'returnsTable',
        columns: [{ name: 'n', pgType: 'int4' }],
      })
      expect(shapeOf(inout).relation).toEqual({ schema: 'pg_catalog', name: 'record' })
      expect(summary(shapeOf(inout).fields)).toEqual([['n', 'int4', true, 'function-rows']])

      const out = ok(get(catalog, 'out_single?a=2'))
      expect(out).toMatchObject({ form: 'single-composite', degraded: [] })
      expect(summary(shapeOf(out).fields)).toEqual([['doubled', 'int8', true, 'function-rows']])

      const table = ok(get(catalog, 'out_table_one_column?a=2&select=d:doubled'))
      expect(table).toMatchObject({ form: 'rowset', degraded: [] })
      expect(summary(shapeOf(table).fields)).toEqual([['d', 'int8', true, 'function-rows']])
      expect(shapeOf(table).fields[0].provenance).toEqual({
        kind: 'outColumn',
        function: { schema: 'public', name: 'out_table_one_column' },
        column: 'doubled',
      })

      // without the catalog the columns are unknown
      expect(ok(get(handle, 'out_inout?n=2')).degraded).toEqual(['rpc-columns:public.out_inout'])
    })

    it('names the unnamed OUT arguments of a function column1, column2 by position among the outputs', () => {
      // unnamed_out(a integer, OUT integer, OUT text) answers {"column1":2,"column2":"x"}; proargnames holds ''
      // for them and PostgreSQL counts outputs only (funcapi.c)
      const p = ok(get(catalog, 'unnamed_out?a=2'))
      expect(p).toMatchObject({ form: 'single-composite', degraded: [] })
      expect(summary(shapeOf(p).fields)).toEqual([
        ['column1', 'int4', true, 'function-rows'],
        ['column2', 'text', true, 'function-rows'],
      ])
      expect(p.rpc?.source).toEqual({
        kind: 'returnsTable',
        columns: [
          { name: 'column1', pgType: 'int4' },
          { name: 'column2', pgType: 'text' },
        ],
      })
      expect(
        shapeOf(ok(get(catalog, 'unnamed_out?a=2&select=column2'))).fields.map((f) => f.name)
      ).toEqual(['column2'])
    })

    it('expands the row of a function whose single OUT column has a table or composite type', () => {
      // out_composite(OUT u arity_children) answers {"id":1,"parent_id":2}: a row descriptor is only built from
      // the OUT columns for a function that returns record (or a scalar), a named row type keeps its own columns
      const p = ok(get(catalog, 'out_composite'))
      expect(p).toMatchObject({ form: 'single-composite', degraded: [] })
      expect(shapeOf(p).relation).toEqual({ schema: 'public', name: 'arity_children' })
      expect(shapeOf(p).fields.map((f) => [f.name, f.pgType, f.nullable])).toEqual([
        ['id', 'int8', true],
        ['parent_id', 'int8', true],
      ])
      expect(
        shapeOf(ok(get(catalog, 'out_composite?select=parent_id'))).fields.map((f) => f.name)
      ).toEqual(['parent_id'])
    })

    it('says so when the columns of a function are not known', () => {
      for (const name of ['get_username_and_status?name_param=x', 'echo_address?address={}']) {
        const p = ok(get(handle, name))
        expect(p.rpc?.source).toBeNull()
        expect(p.degraded).toEqual([`rpc-columns:public.${name.split('?')[0]}`])
      }
      const p = ok(get(handle, 'get_username_and_status?name_param=x&select=username'))
      expect(shapeOf(p).fields).toMatchObject([
        { name: 'username', pgType: null, nullable: true, provenance: { kind: 'unresolved' } },
      ])
      // a table or a view row is in the dump
      expect(
        ok(get(handle, 'get_messages_by_username?search_username=x&select=id')).degraded
      ).toEqual([])
    })

    it('makes a first-level to-one embed nullable but keeps what proves it', () => {
      const p = ok(
        get(
          catalog,
          'get_messages_by_username?search_username=x&select=id,users(username,messages(id)),channels!inner(slug)'
        )
      )
      const [users, channels] = shapeOf(p).embeds
      expect(users).toMatchObject({
        key: 'users',
        cardinality: 'one',
        nullable: true,
        reason: 'function-rows',
        fkProven: true,
        relationship: {
          kind: 'm2o',
          constraint: 'messages_username_fkey',
          columns: [{ from: 'username', to: 'username' }],
        },
      })
      // below the first level the usual rules apply, and a missing !inner row drops the row
      expect(users.shape.embeds[0]).toMatchObject({ nullable: false, reason: 'array' })
      expect(channels).toMatchObject({ nullable: false, reason: 'inner-join', fkProven: true })
    })

    it('reads the volatility from the dump, and plans a GET of a volatile function as upstream does', () => {
      expect(ok(get(catalog, 'get_status?name_param=x')).rpc?.volatility).toBe('immutable')
      expect(ok(get(catalog, 'get_messages_by_username?search_username=x')).rpc?.volatility).toBe(
        'stable'
      )
      const volatile = ok(get(catalog, 'offline_user?name_param=x'))
      expect(volatile.rpc?.volatility).toBe('volatile')
      // upstream plans the GET as a read: Postgres refuses it when it runs
      expect(volatile.txMode).toBe('read')
      expect(ok(post(catalog, 'offline_user', { name_param: 'x' })).txMode).toBe('write')
      expect(ok(post(catalog, 'set_users_offline', { name_param: 'x' })).rpc?.volatility).toBe(
        'volatile'
      )
    })

    it('does not treat the arguments of a call as filters', () => {
      const p = ok(get(catalog, 'get_messages_by_username?search_username=x&username=eq.a'))
      expect(p.filters).toMatchObject([
        { kind: 'column', column: 'username', reason: 'function-rows' },
      ])
    })

    it('names the relation an embed of a function is really resolved against', () => {
      // upstream looks for the relationship from public.users, the schema of the function and the name of the table
      const p = ok(get(catalog, 'get_personal_users?select=username,messages(id)'))
      expect(shapeOf(p).relation).toEqual({ schema: 'personal', name: 'users' })
      expect(p.degraded).toEqual(['rpc-embed-relation:personal.users'])
      expect(p.rpc?.source).toMatchObject({ schema: 'personal', name: 'users' })
    })

    it('returns the dispatch errors of upstream as values', () => {
      expect(get(catalog, 'postgrest_unresolvable_function?a=1')).toMatchObject({
        ok: false,
        error: { code: 'PGRST203' },
      })
      expect(post(catalog, 'postgrest_unresolvable_function', { a: 1 })).toMatchObject({
        ok: false,
        error: { code: 'PGRST203' },
      })
      expect(get(catalog, 'nope')).toMatchObject({ ok: false, error: { code: 'PGRST202' } })
      expect(
        planner.plan(catalog, { method: 'DELETE', url: '/rpc/get_status?name_param=x' })
      ).toMatchObject({ ok: false, error: { code: 'PGRST101' } })
    })
  })

  describe('filter targets', () => {
    const filtersOf = (url: string, extra: Partial<PlanRequest> = {}, h = catalog) =>
      ok(planner.plan(h, { method: 'GET', url, ...extra })).filters
    const key = (column: string) => encodeURIComponent(column)

    it('resolves a filter on the root relation like a select item', () => {
      expect(filtersOf('/messages?select=id&username=eq.supabot&message=not.is.null')).toEqual([
        {
          kind: 'column',
          embed: [],
          column: 'username',
          jsonPath: [],
          pgType: 'text',
          nullable: false,
          provenance: {
            kind: 'plain',
            source: { schema: 'public', relation: 'messages', column: 'username' },
          },
          logic: [],
        },
        expect.objectContaining({ kind: 'column', column: 'message', embed: [] }),
      ])
      expect(filtersOf('/messages?select=id')).toEqual([])
    })

    it('resolves a filter on an embed by its key', () => {
      expect(filtersOf('/messages?select=id,channels(slug)&channels.id=gt.1')).toEqual([
        {
          kind: 'column',
          embed: ['channels'],
          column: 'id',
          jsonPath: [],
          pgType: 'int8',
          nullable: false,
          provenance: {
            kind: 'plain',
            source: { schema: 'public', relation: 'channels', column: 'id' },
          },
          logic: [],
        },
      ])
      const aliased = filtersOf('/messages?select=id,c:channels(slug)&c.slug=eq.x')
      expect(aliased).toMatchObject([{ embed: ['c'], column: 'slug', nullable: true }])
      const nested = filtersOf(
        '/channels?select=id,messages(id,users(username))&messages.users.username=eq.x'
      )
      expect(nested).toMatchObject([{ embed: ['messages', 'users'], column: 'username' }])
    })

    it('says which embed a column filter tests', () => {
      expect(filtersOf('/messages?select=id,channels(slug)&channels=not.is.null')).toEqual([
        {
          kind: 'embed',
          embed: [],
          column: 'channels',
          tested: ['channels'],
          negated: true,
          logic: [],
        },
      ])
      expect(filtersOf('/messages?select=id,channels(slug)&channels=is.null')).toMatchObject([
        { kind: 'embed', negated: false },
      ])
      expect(
        filtersOf('/channels?select=id,messages(id,users(username))&messages.users=is.null')
      ).toMatchObject([
        { kind: 'embed', embed: ['messages'], column: 'users', tested: ['messages', 'users'] },
      ])
      // upstream rewrites is.null and not.is.null only
      expect(filtersOf('/messages?select=id,channels(slug)&channels=is.not_null')).toMatchObject([
        { kind: 'column', column: 'channels', pgType: null, provenance: { kind: 'unresolved' } },
      ])
    })

    it('reports the JSON path of a column filter', () => {
      const [f] = filtersOf(`/users?select=username&${key('data->a->>b')}=eq.1`)
      expect(f).toMatchObject({
        kind: 'column',
        column: 'data',
        pgType: 'jsonb',
        jsonPath: [
          { op: '->', key: 'a' },
          { op: '->>', key: 'b' },
        ],
        provenance: { kind: 'plain', source: { relation: 'users', column: 'data' } },
      })
    })

    it('reports a column that does not exist as unresolved', () => {
      expect(filtersOf('/messages?select=id&nope=eq.1')).toMatchObject([
        {
          kind: 'column',
          column: 'nope',
          pgType: null,
          nullable: true,
          provenance: { kind: 'unresolved' },
        },
      ])
    })

    it('lists the leaves of and= and or= trees with their groups, embeds included', () => {
      const filters = filtersOf(
        '/messages?select=id,channels(slug)&or=(id.eq.1,and(username.eq.x,channels.is.null))&not.and=(message.eq.y)&channels.or=(slug.eq.a)'
      )
      expect(
        filters.map((f) => [
          f.kind,
          f.embed.join('.'),
          f.column,
          f.logic.map((l) => `${l.negated ? 'not.' : ''}${l.operator}`).join('/'),
        ])
      ).toEqual([
        ['column', '', 'id', 'or'],
        ['column', '', 'username', 'or/and'],
        ['embed', '', 'channels', 'or/and'],
        ['column', '', 'message', 'not.and'],
        ['column', 'channels', 'slug', 'or'],
      ])
    })

    it('fails the plan when a filter targets an embed that is not selected', () => {
      expect(
        planner.plan(catalog, { method: 'GET', url: '/messages?select=id&channels.slug=eq.x' })
      ).toMatchObject({ ok: false, error: { code: 'PGRST108' } })
      expect(
        planner.plan(catalog, { method: 'GET', url: '/messages?select=id&channels.or=(slug.eq.x)' })
      ).toMatchObject({ ok: false, error: { code: 'PGRST108' } })
    })

    it('reports the filters of a mutation where they were written', () => {
      const patch = ok(
        planner.plan(catalog, {
          method: 'PATCH',
          url: '/messages?id=eq.1&select=id,users(username)&users.or=(username.eq.a)',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ message: 'x' }),
        })
      )
      expect(patch.filters.map((f) => [f.embed, f.column])).toEqual([
        [[], 'id'],
        [['users'], 'username'],
      ])
      const del = ok(
        planner.plan(catalog, { method: 'DELETE', url: '/messages?id=eq.1&username=eq.x' })
      )
      expect(del.filters.map((f) => f.column)).toEqual(['id', 'username'])
    })

    it('types the filters on function rows as function rows', () => {
      const p = ok(
        planner.plan(catalog, {
          method: 'GET',
          url: '/rpc/get_messages_by_username?search_username=x&id=gt.1',
        })
      )
      expect(p.filters).toMatchObject([
        { kind: 'column', column: 'id', pgType: 'int8', nullable: true, reason: 'function-rows' },
      ])
      const embedded = ok(
        planner.plan(catalog, {
          method: 'GET',
          url: '/rpc/get_messages_by_username?search_username=x&select=id,users(username)&users.username=eq.a',
        })
      )
      expect(embedded.filters).toMatchObject([
        { embed: ['users'], column: 'username', nullable: false },
      ])
      expect(embedded.filters[0]).not.toHaveProperty('reason')
    })
  })

  describe('custom media handlers', () => {
    // A table's `*/*` handler, or a custom `application/json` one, overrides the builtin JSON aggregate
    // (upstream Plan/Negotiate.hs): the body is whatever that function returns, so no shape is known.
    const rel = (name: string) => ({
      tag: 'RelId',
      contents: { qiSchema: 'public', qiName: name },
    })
    const custom = (mediaType: string, table: string, fn: string) => [
      [rel(table), { tag: mediaType }],
      [
        {
          tag: 'CustomFunc',
          contents: [{ qiSchema: 'public', qiName: fn }, rel(table)],
        },
        { tag: mediaType === 'MTAny' ? 'MTApplicationJSON' : mediaType },
      ],
    ]
    let handlers: number
    beforeAll(() => {
      const dump = JSON.parse(readFileSync(join(fixtures, 'dump-schema.json'), 'utf8'))
      dump.dbMediaHandlers.push(
        custom('MTAny', 'messages', 'messages_agg'),
        custom('MTApplicationJSON', 'users', 'users_json_agg')
      )
      handlers = loaded(
        planner.load({
          ...baseInput(),
          schema: JSON.stringify(dump),
          supplementary: supplementaryText(),
        })
      ).handle
    })
    afterAll(() => planner.freeCache(handlers))

    const json = { Accept: 'application/json' }
    const get = (url: string, extra: Partial<PlanRequest> = {}) =>
      ok(planner.plan(handlers, { method: 'GET', url, ...extra }))

    it('reports no shape for a table whose application/json handler is custom', () => {
      const p = get('/users', { headers: json })
      expect(p).toMatchObject({
        form: null,
        shape: null,
        degraded: ['media-handler:public.users_json_agg'],
      })
      expect(p.filters).toEqual([])
      // no Accept header is `*/*`: the handler of `application/json` is not the one asked for
      expect(get('/users')).toMatchObject({ form: 'rowset', degraded: [] })
      // a handler of a table serves its default select only (`when' defaultSelect`, Negotiate.hs)
      expect(get('/users?select=age_range,username', { headers: json })).toMatchObject({
        form: 'rowset',
        degraded: [],
      })
      // what the request filters on is still what it is
      const filtered = get('/users?username=eq.a', { headers: json })
      expect(filtered.filters).toMatchObject([{ kind: 'column', column: 'username' }])
      expect(filtered.shape).toBeNull()
    })

    it('applies a `*/*` handler to a default select only', () => {
      expect(get('/messages')).toMatchObject({
        form: null,
        shape: null,
        degraded: ['media-handler:public.messages_agg'],
      })
      expect(get('/messages?select=*').shape).toBeNull()
      expect(get('/messages?select=id,message')).toMatchObject({
        form: 'rowset',
        degraded: [],
      })
    })

    it('keeps the builtin shape where no handler is custom', () => {
      expect(get('/channels?select=id')).toMatchObject({ form: 'rowset', degraded: [] })
      // the vnd.pgrst types cannot be overridden
      expect(
        get('/users?select=username', { headers: { Accept: 'application/vnd.pgrst.object+json' } })
      ).toMatchObject({ form: 'rowset', degraded: [] })
    })

    it('reports no shape for a mutation that returns the representation through a custom handler', () => {
      const body = JSON.stringify({ username: 'x' })
      const full = ok(
        planner.plan(handlers, {
          method: 'POST',
          url: '/users',
          headers: { ...json, Prefer: 'return=representation', 'Content-Type': 'application/json' },
          body,
        })
      )
      expect(full).toMatchObject({ form: null, shape: null })
      expect(full.degraded).toEqual(['media-handler:public.users_json_agg'])
      const minimal = ok(
        planner.plan(handlers, {
          method: 'POST',
          url: '/users',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      )
      expect(minimal).toMatchObject({ form: 'none', degraded: [] })
    })
  })

  describe('computed field resolution', () => {
    // `"public"."users"."label"` is read by Postgres as the function `label(users)`, found through the search
    // path of the request: its schema, then db-extra-search-path (PreQuery.hs).
    let supp: ReturnType<typeof JSON.parse>
    beforeAll(() => {
      supp = JSON.parse(supplementaryText())
      for (const [schema, type] of [
        ['a', 'text'],
        ['b', 'integer'],
      ]) {
        supp.functions.push({
          schema,
          name: 'label',
          argTypes: ['public.users'],
          volatility: 's',
          returns: { kind: 'scalar', type },
        })
      }
    })
    const typeOf = (extraSearchPath: string, url = '/users?select=label') => {
      const h = loaded(
        planner.load({
          ...baseInput(),
          config: { ...baseInput().config, 'db-extra-search-path': extraSearchPath },
          supplementary: supp,
        })
      ).handle
      try {
        const p = ok(planner.plan(h, { method: 'GET', url }))
        return [p.shape?.fields[0].pgType ?? null, p.shape?.fields[0].provenance, p.filters]
      } finally {
        planner.freeCache(h)
      }
    }

    it('picks the function of the first schema of the search path', () => {
      expect(typeOf('b,a')[0]).toBe('int4')
      expect(typeOf('a,b')[0]).toBe('text')
      expect(typeOf('b,a')[1]).toMatchObject({
        kind: 'computed',
        function: { schema: 'b', name: 'label' },
      })
    })

    it('does not see a function of a schema outside the search path', () => {
      const [type, provenance] = typeOf('b')
      expect(type).toBe('int4')
      expect(provenance).toMatchObject({ function: { schema: 'b' } })
      const [none, unresolved] = typeOf('extensions')
      expect(none).toBeNull()
      expect(unresolved).toMatchObject({ kind: 'unresolved' })
    })

    it('resolves a filter on a computed field the same way', () => {
      expect(typeOf('b,a', '/users?select=username&label=eq.1')[2]).toMatchObject([
        { kind: 'column', column: 'label', pgType: 'int4' },
      ])
    })
  })

  describe('cast types and computed fields along the search path', () => {
    // The request searches its own schema (public), then db-extra-search-path. The fixture database has `cast_a.d`
    // (text, used by no column), `cast_b.d` (integer, used by cast_cases.b), `cast_c.int4` (a domain named like a
    // builtin), and `label(public.cast_cases)` in `extensions` (text) and `personal` (integer).
    // supplementary.json was generated for public,personal,graphql_public + public,extensions;
    // supplementary-search-path.json also for cast_a, cast_b and cast_c.
    const wideCatalog = () => readFileSync(join(fixtures, 'supplementary-search-path.json'), 'utf8')
    const shapeOf = (extraSearchPath: string, url: string, supplementary = wideCatalog()) => {
      const h = loaded(
        planner.load({
          ...baseInput(),
          config: { ...baseInput().config, 'db-extra-search-path': extraSearchPath },
          supplementary,
        })
      ).handle
      try {
        const p = ok(planner.plan(h, { method: 'GET', url }))
        return { fields: p.shape?.fields ?? [], degraded: p.degraded }
      } finally {
        planner.freeCache(h)
      }
    }
    const typed = (extraSearchPath: string, url: string, supplementary?: string) => {
      const { fields, degraded } = shapeOf(extraSearchPath, url, supplementary)
      return { types: fields.map((f) => [f.pgType, f.baseType ?? null, f.nullable]), degraded }
    }

    it('keeps non-null through a cast only when the cast function cannot return NULL', () => {
      // timestamptz::time, timestamp::time and timestamptz::timetz return NULL for infinity (date.c)
      const { fields } = shapeOf(
        'public,extensions',
        '/cast_cases?select=a:tstz::time,b:ts::time,c:tstz::timetz,d:n::int8,e:n::text,f:tstz::text,g:n::float8,h:n::numeric,i:ts::timestamp,j:tstz::date,k:n::bool'
      )
      expect(fields.map((f) => [f.name, f.pgType, f.nullable])).toEqual([
        ['a', 'time', true],
        ['b', 'time', true],
        ['c', 'timetz', true],
        ['d', 'int8', false],
        ['e', 'text', false],
        ['f', 'text', false],
        ['g', 'float8', false],
        ['h', 'numeric', false],
        ['i', 'timestamp', false],
        ['j', 'date', true],
        ['k', 'bool', true],
      ])
      // between the types of text, and a cast from text to a number, which can fail but is not allowlisted
      expect(
        shapeOf(
          'public,extensions',
          '/users?select=a:username::varchar,b:username::int4'
        ).fields.map((f) => [f.pgType, f.nullable])
      ).toEqual([
        ['varchar', false],
        ['int4', true],
      ])
    })

    it('keeps non-null through a user type to text only when the catalog lists no cast function for it', () => {
      // `cast_mood` has CREATE CAST (cast_mood AS text) WITH FUNCTION that returns NULL; PostgreSQL uses a cast
      // function ahead of the output function, and for a domain the cast of its base type. `user_status` has none.
      const url = '/cast_cases?select=a:mood::text,b:mood_dom::text,c:status::text,d:mood::varchar'
      expect(
        shapeOf('public,extensions', url).fields.map((f) => [f.name, f.pgType, f.nullable])
      ).toEqual([
        ['a', 'text', true],
        ['b', 'text', true],
        ['c', 'text', false],
        ['d', 'varchar', false],
      ])
      // without a catalog nothing says which user casts exist: a user type is nullable
      const h = loaded(planner.load({ ...baseInput(), supplementary: undefined })).handle
      try {
        const p = ok(
          planner.plan(h, { method: 'GET', url: '/cast_cases?select=c:status::text,a:mood::text' })
        )
        expect((p.shape?.fields ?? []).map((f) => [f.name, f.nullable])).toEqual([
          ['c', true],
          ['a', true],
        ])
      } finally {
        planner.freeCache(h)
      }
    })

    it('resolves a cast to the type of the first schema of the search path that has it', () => {
      // cast_a.d is mentioned by nothing but the catalog's list of types
      expect(typed('cast_a,cast_b', '/cast_cases?select=x:id::d')).toEqual({
        types: [['cast_a.d', 'text', true]],
        degraded: [],
      })
      expect(typed('cast_b,cast_a', '/cast_cases?select=x:id::d')).toEqual({
        types: [['cast_b.d', 'int4', true]],
        degraded: [],
      })
    })

    it('does not pick a later schema when a schema of the path is not covered by the catalog', () => {
      // supplementary.json does not cover cast_a (nor cast_b): cast_a.d may exist
      const narrow = supplementaryText()
      expect(typed('cast_a,cast_b', '/cast_cases?select=x:id::d', narrow)).toEqual({
        types: [[null, null, true]],
        degraded: ['cast-type:d'],
      })
      // a type found in a schema is there whatever the schemas after it
      expect(typed('cast_b,cast_a', '/cast_cases?select=x:id::d', narrow).types).toEqual([
        ['cast_b.d', 'int4', true],
      ])
    })

    it('searches pg_catalog first only when the path does not list it', () => {
      // cast_c.int4 is a domain named like the builtin
      expect(typed('cast_c', '/cast_cases?select=x:n::int4').types).toEqual([['int4', null, false]])
      expect(typed('cast_c,pg_catalog', '/cast_cases?select=x:n::int4').types).toEqual([
        ['cast_c.int4', 'text', true],
      ])
      expect(typed('pg_catalog,cast_c', '/cast_cases?select=x:n::int4').types).toEqual([
        ['int4', null, false],
      ])
      // the SQL spelling is the builtin, wherever pg_catalog is
      expect(typed('cast_c,pg_catalog', '/cast_cases?select=x:n::integer').types).toEqual([
        ['int4', null, false],
      ])
    })

    it('picks the computed field of the first schema of the search path, extra search path schemas included', () => {
      const field = (extraSearchPath: string, supplementary?: string) => {
        const { fields } = shapeOf(extraSearchPath, '/cast_cases?select=label', supplementary)
        return [fields[0].pgType, fields[0].provenance]
      }
      expect(field('extensions,personal')).toEqual([
        'text',
        expect.objectContaining({ function: { schema: 'extensions', name: 'label' } }),
      ])
      expect(field('personal,extensions')).toEqual([
        'int4',
        expect.objectContaining({ function: { schema: 'personal', name: 'label' } }),
      ])
      // only the schemas of the path are searched
      expect(field('personal')[0]).toBe('int4')
      expect(field('public')[0]).toBeNull()
    })

    it('degrades a computed field when a schema of the path is not covered by the catalog', () => {
      const { fields, degraded } = shapeOf(
        'cast_a,extensions',
        '/cast_cases?select=label',
        supplementaryText()
      )
      expect(fields[0]).toMatchObject({ pgType: null })
      expect(degraded).toEqual(['computed-field:public.cast_cases.label'])
    })

    it('resolves _name to the array type of the first schema of the path that has it', () => {
      // arr_a.d is a text domain, arr_b._d an integer domain named like the array type of arr_a.d: on the path
      // arr_a,arr_b PostgreSQL reads `_d` as arr_a._d, the array of arr_a.d
      expect(typed('arr_a,arr_b', '/cast_cases?select=x:id::_d')).toEqual({
        types: [['arr_a.d[]', null, true]],
        degraded: [],
      })
      expect(typed('arr_b,arr_a', '/cast_cases?select=x:id::_d')).toEqual({
        types: [['arr_b._d', 'int4', true]],
        degraded: [],
      })
      // the array of a builtin and of a user type of a schema without a competing name
      expect(
        typed('arr_a,arr_b', '/cast_cases?select=x:id::_int4,y:id::_user_status').types
      ).toEqual([
        ['int4[]', null, true],
        ['public.user_status[]', null, true],
      ])
    })

    it('does not pick a later schema for an array name when a schema of the path is not covered', () => {
      // supplementary.json does not cover arr_a: arr_a._d may exist
      expect(typed('arr_a,arr_b', '/cast_cases?select=x:id::_d', supplementaryText())).toEqual({
        types: [[null, null, true]],
        degraded: ['cast-type:_d'],
      })
    })

    it('resolves a computed field to a function that belongs to an extension', () => {
      // ext_owned.ext_label (text) is a member of the lo extension, personal.ext_label (integer) is not: the
      // catalog does not leave the first out, PostgreSQL calls the first of the path
      const field = (extraSearchPath: string) => {
        const { fields, degraded } = shapeOf(extraSearchPath, '/ext_label_cases?select=ext_label')
        return [fields[0].pgType, fields[0].provenance, degraded]
      }
      expect(field('ext_owned,personal')).toEqual([
        'text',
        expect.objectContaining({ function: { schema: 'ext_owned', name: 'ext_label' } }),
        [],
      ])
      expect(field('personal,ext_owned')).toEqual([
        'int4',
        expect.objectContaining({ function: { schema: 'personal', name: 'ext_label' } }),
        [],
      ])
    })

    it('knows the base of a domain whose name needs quotes', () => {
      // public."Amount" is a domain over integer; format_type spells it with quotes
      const p = ok(
        planner.plan(catalog, {
          method: 'GET',
          url: '/quoted_amounts?select=amt,amount,s:amount.sum(),a:amount.avg(),t:amt.sum(),u:amt.avg()',
        })
      )
      expect(p.shape?.fields.map((f) => [f.pgType, f.baseType ?? null])).toEqual([
        ['public."Amount"', 'int4'],
        ['public."Amount"', 'int4'],
        ['int8', null],
        ['numeric', null],
        ['int8', null],
        ['numeric', null],
      ])
    })

    it('knows the base of a domain that only a computed field returns', () => {
      const p = ok(
        planner.plan(catalog, {
          method: 'GET',
          url: '/domain_items?select=return_only,t:return_only.sum()',
        })
      )
      expect(p.shape?.fields.map((f) => [f.pgType, f.baseType ?? null])).toEqual([
        ['public.return_only_amount', 'int4'],
        ['int8', null],
      ])
    })
  })

  describe('summary output names', () => {
    it('names aggregates the way PostgreSQL and the shape do', () => {
      const p = ok(
        planner.plan(catalog, {
          method: 'GET',
          url: '/inference_cases?select=price.sum(),count(),a:price.avg(),id,id.count(),optional_payload->>x',
        })
      )
      expect(p.select.map((s) => s.outputName)).toEqual(['sum', 'count', 'a', 'id', 'count', 'x'])
      expect(p.select.map((s) => s.outputName)).toEqual(p.shape?.fields.map((f) => f.name))
      const embedded = ok(
        planner.plan(catalog, { method: 'GET', url: '/users?select=username,messages(id.count())' })
      )
      expect(embedded.embeds[0].select.map((s) => s.outputName)).toEqual(['count'])
    })
  })

  it('throws when the wasm file is missing', async () => {
    await expect(loadPlanner({ wasmPath: '/nonexistent.wasm' })).rejects.toThrow(
      'nx build:wasm postgrest-planner'
    )
  })
})
