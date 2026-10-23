import type { ShapeField } from '@supabase/postgrest-planner'
import type { Supplementary } from '../schema'
import type { TracedColumn } from '../tracer'

export interface PrintDiagnostic {
  severity: 'info' | 'warning' | 'error'
  message: string
}

/** Everything `printDatabase` needs, already computed: the printer reads no database and runs no planner. */
export interface PrintDatabaseInput {
  supplementary: Supplementary
  /** `postgrest --dump-schema` text: relationships and the optionality of function arguments come from it */
  dump: string
  /** Schemas to print even when nothing in them was found (`db-schemas`) */
  schemas?: readonly string[]
  /**
   * The output columns of `GET /<relation>?select=*` per `relationKey(schema, relation)`, in plan order. A relation without an
   * entry (not in the PostgREST schema cache: a partition, a failed plan) is not printed.
   */
  plans: ReadonlyMap<string, readonly ShapeField[]>
  /** Tracer verdicts per `relationKey(schema, view)`, then per column name. A view without an entry has every column nullable */
  traces: ReadonlyMap<string, ReadonlyMap<string, TracedColumn>>
  /** `schema.table.column` to the TypeScript type of its `pg_jsonschema` CHECK constraints */
  jsonSchemas: ReadonlyMap<string, string>
}

export interface PrintDatabaseResult {
  /** The members of `interface SupabaseDatabase { ... }`, indented for `declare global { ... }` (4 spaces) */
  text: string
  diagnostics: PrintDiagnostic[]
}

export interface PrintModuleInput {
  /** `PrintDatabaseResult.text` */
  database: string
  /**
   * Extension point of the next slice: complete `interface SupabaseSelects { ... }` text, indented for
   * `declare global { ... }`, emitted verbatim after the database interface.
   */
  selects?: string
  /** Same, for `interface SupabaseOperands { ... }` */
  operands?: string
  /** Where `SupabaseColumnType` comes from. Default `@supabase/postgrest-js` */
  importFrom?: string
  /** PostgREST release line (`16.4`): decides `SupabasePgrstStatus['features']`. Absent: every feature is on */
  postgrestVersion?: string
  /** `SupabasePgrstStatus['unplanned']`. Default `loose` (design v5 §4.4) */
  unplanned?: 'loose' | 'error'
}
