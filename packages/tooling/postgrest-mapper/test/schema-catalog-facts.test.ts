import {
  buildDatabaseDeclarations,
  buildJsonSchemaInput,
  PLANNER_ABI,
  createTracer,
  type AcquiredSchema,
  type PlannerHost,
  type SupplementaryRelation,
} from '../src'
import type { PlanRequest, PlanResult, ShapeField } from '@supabase/postgrest-planner'
import { column, supplementary, table } from './support/printer'

const relation = (
  name: string,
  kind: SupplementaryRelation['kind'],
  columns: ReturnType<typeof column>[],
  viewDefinition: string | null = null
): SupplementaryRelation => ({
  ...table('public', name, columns),
  kind,
  viewDefinition,
  updatable: { insert: false, update: false, delete: false },
})
const check = (constraint: string, definition: string, columns = ['data']) => ({
  schema: 'public',
  table: 'docs',
  constraint,
  definition,
  columns,
  validated: true,
})

describe('json(b)_matches_schema guards (F4)', () => {
  const docs = relation('docs', 'r', [
    column('n', 'integer', 1, false),
    column('m', 'integer', 2, false),
    column('data', 'jsonb', 3, false),
  ])
  const input = (definition: string) =>
    buildJsonSchemaInput(
      supplementary({ relations: [docs], jsonSchemaChecks: [check('docs_data', definition)] })
    )

  it('accepts the OR form only when the guard is the validated column itself', async () => {
    const same = await input(
      `CHECK ((data IS NULL) OR extensions.jsonb_matches_schema('{"type":"string"}'::json, data))`
    )
    expect(same.columns.map((c) => [c.column, c.jsonSchema])).toEqual([
      ['data', { type: 'string' }],
    ])

    const swapped = await input(
      `CHECK (extensions.jsonb_matches_schema('{"type":"string"}'::json, data) OR (data IS NULL))`
    )
    expect(swapped.columns).toHaveLength(1)
  })

  it.each([
    ['an expression', `((n + 1) IS NULL)`],
    ['another column', `(m IS NULL)`],
    ['a row constructor', `(ROW(n) IS NULL)`],
  ])(
    'ignores a guard that is %s: the value is unconstrained when the guard holds',
    async (_, g) => {
      const result = await input(
        `CHECK (${g} OR extensions.jsonb_matches_schema('{"type":"string"}'::json, data))`
      )
      expect(result.columns).toEqual([])
      expect(result.ignored).toHaveLength(1)
      expect(result.ignored[0].reason).toMatch(/guard/)
    }
  )
})

describe('materialized views (F5)', () => {
  // The stored rows of a materialized view can predate a NOT NULL or a CHECK added to its base table
  const docs = relation('docs', 'r', [
    column('id', 'integer', 1, true),
    column('data', 'jsonb', 2, true),
  ])
  const mv = relation(
    'docs_mv',
    'm',
    [column('id', 'integer', 1, false), column('data', 'jsonb', 2, false)],
    ' SELECT docs.id,\n    docs.data\n   FROM public.docs;'
  )
  const view = relation(
    'docs_over_mv',
    'v',
    [column('id', 'integer', 1, false)],
    ' SELECT m.id\n   FROM public.docs_mv m;'
  )
  const acquired: AcquiredSchema = {
    dump: '{}',
    config: { 'db-schemas': 'public' },
    pgVersionNum: 170000,
    postgrestVersion: '16.4',
    supplementary: supplementary({
      relations: [docs, mv, view],
      jsonSchemaChecks: [
        check(
          'docs_data',
          `CHECK (extensions.jsonb_matches_schema('{"type":"string"}'::json, data))`
        ),
      ],
    }),
  }
  /** What the planner says about `select=*`: plain columns with their attnotnull */
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
        const name = decodeURIComponent(r.url.slice(1).split('?')[0])
        const rel = acquired.supplementary.relations.find((x) => x.name === name)!
        const fields: ShapeField[] = rel.columns.map((c) => ({
          name: c.name,
          pgType: c.type === 'integer' ? 'int4' : 'jsonb',
          nullable: !c.notNull,
          provenance: {
            kind: 'plain',
            source: { schema: 'public', relation: rel.name, column: c.name },
          },
        }))
        return {
          ok: true,
          shape: { relation: { schema: 'public', name }, fields, embeds: [] },
        } as never
      }),
    close: async () => undefined,
  }

  it('keeps every column nullable and takes no JSON Schema from the base table', async () => {
    const { text } = await buildDatabaseDeclarations({
      acquired,
      host,
      tracer: await createTracer(),
    })
    const row = (name: string) => {
      const start = text.indexOf(`${name}: {`)
      return text.slice(start, text.indexOf('Insert:', start))
    }
    // the base table keeps its facts
    expect(row('docs')).toContain(`id: SupabaseColumnType<'public.docs.id', number>`)
    expect(row('docs')).not.toMatch(/id: .*\| null/)
    expect(row('docs')).toContain(`data: SupabaseColumnType<'public.docs.data', string>`)
    // the materialized view and a view over it prove nothing
    expect(row('docs_mv')).toContain(`id: SupabaseColumnType<'public.docs_mv.id', number> | null`)
    expect(row('docs_mv')).toContain(`data: SupabaseColumnType<'public.docs_mv.data', Json> | null`)
    expect(row('docs_over_mv')).toContain(
      `id: SupabaseColumnType<'public.docs_over_mv.id', number> | null`
    )
  })
})
