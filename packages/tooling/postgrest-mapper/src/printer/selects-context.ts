import type { ShapeField } from '@supabase/postgrest-planner'
import type { Supplementary } from '../schema'
import type { TracedColumn } from '../tracer'
import { rememberDomain, rowTypeOf, type TypeContext } from './pg-types'

/** What the selects printer reads about the database: the same inputs `printDatabase` is fed. */
export interface SelectsContextInput {
  supplementary: Supplementary
  /** The output columns of `select=*` per `schema.relation` (a relation without one is not in the schema cache) */
  plans: ReadonlyMap<string, readonly ShapeField[]>
  /** Tracer verdicts per `schema.view`, then per column name */
  traces: ReadonlyMap<string, ReadonlyMap<string, TracedColumn>>
  /** `schema.table.column` to the TypeScript type of its `pg_jsonschema` CHECK constraints */
  jsonSchemas: ReadonlyMap<string, string>
  /** Where the generated module imports `SupabaseColumnType` from. Default `@supabase/postgrest-js` */
  importFrom?: string
}

/** The database as the selects printer sees it. Built once per generation. */
export interface SelectsContext {
  /** Type mapping context identical to the one `printDatabase` uses, so a column prints the same type everywhere */
  types: TypeContext
  /** The map behind `types.domains`, which entries extend while they print */
  domains: Map<string, string>
  plans: ReadonlyMap<string, readonly ShapeField[]>
  traces: ReadonlyMap<string, ReadonlyMap<string, TracedColumn>>
  jsonSchemas: ReadonlyMap<string, string>
  /** The module the helper types (`PgrstJson`, `PgrstJsonText`) are imported from */
  importFrom: string
}

/**
 * Mirrors the context `printDatabase` builds (`enums`, `composites`, `relations`, `domains`): a column's type must be
 * spelled the same in `SupabaseDatabase` and in a select entry. `domains` also grows while entries print, for a
 * domain that only a select item (a cast) mentions.
 */
export function createSelectsContext(input: SelectsContextInput): SelectsContext {
  const { supplementary } = input
  const relations = new Map<string, ReturnType<typeof rowTypeOf>>()
  for (const r of supplementary.relations) {
    const name = `${r.schema}.${r.name}`
    if (!input.plans.has(name)) continue
    relations.set(name, rowTypeOf(r.columns))
  }
  const domains = new Map<string, string>()
  for (const fields of input.plans.values()) {
    for (const f of fields) {
      if (f.pgType && f.baseType && f.baseType !== f.pgType)
        rememberDomain(domains, f.pgType, f.baseType)
    }
  }
  return {
    types: {
      enums: new Set(supplementary.enums.map((e) => `${e.schema}.${e.name}`)),
      composites: new Set(supplementary.composites.map((c) => `${c.schema}.${c.name}`)),
      relations,
      domains,
    },
    domains,
    plans: input.plans,
    traces: input.traces,
    jsonSchemas: input.jsonSchemas,
    importFrom: input.importFrom ?? '@supabase/postgrest-js',
  }
}
