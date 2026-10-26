import type { ShapeField } from '@supabase/postgrest-planner'
import { printDatabase, printModule, type Supplementary } from '../../src'
import { TYPE_HELPERS, typecheckConsumer } from './consumer'

const HELPERS = `import type { Json } from './db'\n${TYPE_HELPERS}export type { Json }\n`

/** A catalog with nothing in it, but `over` */
export const supplementary = (over: Partial<Supplementary>): Supplementary => ({
  format: 1,
  composites: [],
  foreignKeys: [],
  relations: [],
  functions: [],
  schemas: [],
  searchPathFunctions: [],
  aggregates: [],
  implicitCasts: [],
  types: [],
  casts: [],
  referencedRelations: [],
  enums: [],
  jsonSchemaChecks: [],
  ...over,
})

export const column = (name: string, type: string, attnum: number, notNull = true) => ({
  name,
  attnum,
  type,
  notNull,
  hasDefault: false,
  identity: null,
  generated: null,
})

export const table = (schema: string, name: string, columns: ReturnType<typeof column>[]) => ({
  schema,
  name,
  kind: 'r' as const,
  columns,
  viewDefinition: null,
  updatable: { insert: true, update: true, delete: true },
})

/** The module printed for a hand-built catalog and plans, like a generation prints it */
export function printed(
  input: Partial<Supplementary>,
  plans: [string, ShapeField[]][],
  schemas = ['public']
): string {
  const database = printDatabase({
    supplementary: supplementary(input),
    dump: '{}',
    schemas,
    plans: new Map(plans),
    traces: new Map(),
    jsonSchemas: new Map(),
  })
  return printModule({ database })
}

/** Type-checks `consumer` against the printed module `db`: neither file has a diagnostic */
export function expectClean(db: string, consumer: string): void {
  const result = typecheckConsumer({
    files: { 'db.d.ts': db, 'helpers.ts': HELPERS, 'consumer.ts': consumer },
  })
  expect(result.byFile.get('db.d.ts') ?? []).toEqual([])
  expect(result.byFile.get('consumer.ts') ?? []).toEqual([])
}
