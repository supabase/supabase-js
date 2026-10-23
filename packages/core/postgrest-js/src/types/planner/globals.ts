import type { GenericSchema } from '../common/common'

// Global interfaces filled by the generator (`@supabase/postgrest-mapper`). Without it they stay empty and every
// builder chain falls back to loose, unplanned behaviour.
declare global {
  /** Planned selects: `${kind}|${schema}|${relation}|${select}` -> entry */
  interface SupabaseSelects {}
  /** Planned filter operands: `${kind}|${schema}|${relation}|${select}|${column}` -> entry */
  interface SupabaseOperands {}
  /** The database types (`supabase gen types typescript` shape) the client reads. */
  interface SupabaseDatabase {}
  /** User-owned column type overrides: `'schema.relation.column'` -> type. */
  interface SupabaseColumnTypes {}
  /** Emitted by the generator: planner state, strictness and the features of the release line. */
  interface SupabasePgrstStatus {}
}

/**
 * The type of a source column value: the user's override from `SupabaseColumnTypes` when there is one, the
 * derived type otherwise. The generator wraps every source column value in it.
 */
export type SupabaseColumnType<K extends string, Derived> = K extends keyof SupabaseColumnTypes
  ? SupabaseColumnTypes[K]
  : Derived

// ---------------------------------------------------------------- database
/** What the client reads when the generator isn't set up: any schema, any relation, `Record<string, unknown>` rows. */
export type GenericDatabase = { [schema: string]: GenericSchema }

/** The client's default database: the generator's `SupabaseDatabase`, or `GenericDatabase` without it. */
export type DefaultDatabase = keyof SupabaseDatabase extends never
  ? GenericDatabase
  : SupabaseDatabase

// ---------------------------------------------------------------- policy
/** `SupabasePgrstStatus['unplanned']` is `'error'`: a select the planner didn't index is a type error. */
export type Strict = SupabasePgrstStatus extends { unplanned: 'error' } ? true : false

/**
 * Whether a release-line feature is available. Without the generator (`features` absent), or for a feature it
 * doesn't list, everything is enabled.
 */
export type PgrstFeature<K extends string> = SupabasePgrstStatus extends { features: infer Fs }
  ? K extends keyof Fs
    ? Fs[K] extends false
      ? false
      : true
    : true
  : true

export type UnplannedSelectMessage =
  "not indexed by @supabase/postgrest-mapper: the scanner couldn't connect this select to a relation in the same file. Call .select() on a builder from .from() in this file, or pass it as a string (select(cols as string)) and type the rows with .cast<T>()"
export type UnplannedOperandMessage =
  'not indexed by @supabase/postgrest-mapper: no operand entry for this column in this select. Check the scanner resolved the select, or pass the column as a string'
export type UnplannedRpcMessage =
  'not indexed by @supabase/postgrest-mapper: no planned call matches this rpc name, argument key set and method'
