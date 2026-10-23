import {
  buildDatabaseDeclarations,
  createSelectsContext,
  printSelects,
  relationKey,
  createTracer,
  PLANNER_ABI,
  type AcquiredSchema,
  type PlannerHost,
  type Supplementary,
} from '../src'
import type { PlanRequest, PlanResult, ShapeField } from '@supabase/postgrest-planner'

/**
 * Two relations whose schema and name join to the same dotted string (`public."a.b"` and `"public.a".b`) are two
 * relations: both are planned, printed, and typed from their own columns.
 */
const column = (name: string, type: string, attnum: number) => ({
  name,
  attnum,
  type,
  notNull: true,
  hasDefault: false,
  identity: null,
  generated: null,
})
const table = (schema: string, name: string, columns: ReturnType<typeof column>[]) => ({
  schema,
  name,
  kind: 'r' as const,
  columns,
  viewDefinition: null,
  updatable: { insert: true, update: true, delete: true },
})

const supplementary: Supplementary = {
  format: 1,
  composites: [],
  foreignKeys: [],
  functions: [],
  schemas: [],
  searchPathFunctions: [],
  types: [],
  casts: [],
  referencedRelations: [],
  enums: [],
  jsonSchemaChecks: [],
  relations: [
    table('public', 'a.b', [column('left_id', 'integer', 1)]),
    table('public.a', 'b', [column('right_name', 'text', 1)]),
  ],
}
const acquired: AcquiredSchema = {
  dump: '{}',
  config: { 'db-schemas': 'public,public.a' },
  pgVersionNum: 170000,
  postgrestVersion: '16.4',
  supplementary,
}

const host: PlannerHost = {
  info: async () => ({
    ok: true,
    abi: PLANNER_ABI,
    ghc: 'ghc',
    postgrest: { version: '16.4', tag: 'v16.4', commit: '' },
  }),
  load: async () => ({ ok: true, degraded: [] }) as never,
  plan: async () => ({ ok: false }) as never,
  planMany: async (requests: PlanRequest[]): Promise<PlanResult[]> =>
    requests.map((r) => {
      const name = decodeURIComponent(r.url.slice(1).split('?')[0]!)
      const schema = r.headers?.['Accept-Profile'] ?? 'public'
      const rel = supplementary.relations.find((x) => x.schema === schema && x.name === name)!
      const fields: ShapeField[] = rel.columns.map((c) => ({
        name: c.name,
        pgType: c.type === 'integer' ? 'int4' : 'text',
        nullable: !c.notNull,
        provenance: { kind: 'plain', source: { schema, relation: name, column: c.name } },
      }))
      return { ok: true, shape: { relation: { schema, name }, fields, embeds: [] } } as never
    }),
  close: async () => undefined,
}

describe('relations whose qualified names look alike', () => {
  it('prints both, each with its own columns', async () => {
    const { text } = await buildDatabaseDeclarations({
      acquired,
      host,
      tracer: await createTracer(),
    })
    expect(text).toMatch(
      /'a\.b': \{\s+Row: \{\s+left_id: SupabaseColumnType<'public\.a\.b\.left_id', number>/
    )
    expect(text).toMatch(
      /'public\.a': \{\s+Tables: \{\s+b: \{\s+Row: \{\s+right_name: SupabaseColumnType<'public\.a\.b\.right_name', string>/
    )
  })
})

describe('select entries over a relation whose name has a dot', () => {
  const base = { schema: 'public', relation: 't', column: 'id' }
  const view = { schema: 'public', relation: 'v.w', column: 'id' }
  const viewSupplementary: Supplementary = {
    ...supplementary,
    relations: [table('public', 'v.w', [column('id', 'integer', 1)])],
  }
  const fields: ShapeField[] = [
    { name: 'id', pgType: 'int4', nullable: true, provenance: { kind: 'plain', source: view } },
    {
      name: 'doc',
      pgType: 'int4',
      nullable: true,
      provenance: {
        kind: 'jsonPath',
        path: [{ op: '->', key: 'a' }],
        of: { kind: 'plain', source: view },
      },
    } as ShapeField,
  ]
  const context = createSelectsContext({
    supplementary: viewSupplementary,
    plans: new Map([[relationKey('public', 'v.w'), [{ ...fields[0]!, pgType: 'text' }]]]),
    traces: new Map([
      [relationKey('public', 'v.w'), new Map([['id', { nullable: false, source: base }]])],
    ]),
    jsonSchemas: new Map(),
  })

  it("reads the view's trace and its select=* plan", () => {
    const { text } = printSelects(context, [
      {
        key: 'r|public|v.w|id,doc:id->a',
        shape: { relation: { schema: 'public', name: 'v.w' }, fields, embeds: [] } as never,
      },
    ])
    // traced to its base column and proven non-null, not the view's own nullable column
    expect(text).toMatch(/id: SupabaseColumnType<'public\.t\.id', number>;/)
    // the JSON path is typed against the column's planned type (`text` here), not the `jsonb` fallback
    expect(text).toContain("PgrstJson<SupabaseColumnType<'public.t.id', string>, ['a']>")
  })
})
