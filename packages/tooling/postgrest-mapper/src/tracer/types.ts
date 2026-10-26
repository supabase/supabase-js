/** Where an output column's value comes from: a column of a base table, unchanged. */
export interface ColumnSource {
  schema: string
  relation: string
  column: string
}

/** The verdict for one output column. */
export interface TracedColumn {
  /** `false` only when the tracing rules prove the column can never be NULL. */
  nullable: boolean
  /**
   * Set when the column is a plain pass-through of a base-table column (through views, subqueries, CTEs, joins and
   * set operations that agree on it), whatever its nullability. A cast, COALESCE, aggregate or any other
   * expression has no source.
   */
  source?: ColumnSource
  /** Why the column is nullable. Absent for non-null columns. For debugging and tests. */
  reason?: string
}

/**
 * What the tracer proved about the rows of one single-query `LANGUAGE sql` function (design v5 §4.3), kept per
 * overload next to the traces of the views. Only a function whose body was traced is kept.
 */
export interface TracedFunction {
  /** The input argument names, `''` for an unnamed one: with `argTypes`, what tells the overloads of a name apart */
  argNames: string[]
  argTypes: string[]
  /** `SETOF` / `RETURNS TABLE`. A function that returns one row can return a null composite, expanded to a row of nulls */
  setof: boolean
  /** `STABLE` or `IMMUTABLE`: the function runs on the snapshot of the calling statement */
  snapshot: boolean
  /** The verdict per output column, by the column's name */
  columns: [name: string, column: TracedColumn][]
}

export interface TraceResult {
  /** One entry per requested output column, in order. */
  columns: TracedColumn[]
  /**
   * Set when the query as a whole could not be traced (parse error, not a single SELECT, column count mismatch,
   * `*` over an unknown relation, ...). Every column is then nullable with this reason.
   */
  error?: string
}

export interface CatalogColumn {
  name: string
  /** `pg_attribute.attnotnull`. Ignored for views, whose columns are traced. */
  notNull: boolean
  /**
   * `format_type` with every type outside `pg_catalog` schema qualified (`public.money`, `public.money[]`). A cast of
   * a non-null value stays non-null only between `pg_catalog` types (a cast function of another type may return
   * NULL), so a column without a type never proves a cast.
   */
  type?: string
}

export interface CatalogRelation {
  schema: string
  name: string
  /**
   * `table`: columns and NOT NULL are taken from `columns` (partitioned tables included).
   * `view`: traced from `traced` or `definition`; views over views compose.
   * `other`: anything whose NOT NULL proves nothing (foreign tables, composite types, ...): all nullable.
   */
  kind: 'table' | 'view' | 'other'
  /** Columns in attribute order. */
  columns: CatalogColumn[]
  /** `pg_get_viewdef` text of a view. Traced on demand (once per `trace` call). */
  definition?: string
  /** A view's already traced result, one entry per column. Takes precedence over `definition`. */
  traced?: TracedColumn[] | TraceResult
}

/**
 * What an unqualified `count(x)` may call instead of the builtin aggregate along the search path the body runs with:
 * `aggregateOverloaded` (`Planner/Supplementary.hs`) applied to these facts.
 */
export interface AggregateOverloads {
  /**
   * A schema of that path is not one the catalog lists the functions of (or the path cannot be named): it may hold
   * a function or aggregate named `count` that takes the operand, so nothing is known about the call.
   */
  unknownSchema: boolean
  /** The first argument type of each function or aggregate named `count` of the path's schemas that a call with one argument may reach */
  candidates: string[]
  /** The implicit casts into the types of those candidates (and their element and base types) */
  implicitCasts: { source: string; target: string }[]
  /** The domains of the covered schemas with their base type, to read a domain as its base */
  domains: { schema: string; name: string; base: string }[]
}

/** Plain, JSON-serialisable facts about the database. */
export interface TraceCatalog {
  relations: CatalogRelation[]
  /** Schemas searched, in order, for an unqualified relation name. Defaults to `['public']`. */
  searchPath?: string[]
  /**
   * What `count(x)` may resolve to besides the builtin aggregate. Absent: nothing else is known to exist, so the
   * builtin is assumed (a catalog written by hand). A call of `count` is proven non-null only without an applicable
   * overload.
   */
  aggregateOverloads?: AggregateOverloads
}

export interface TraceInput {
  /** `pg_get_viewdef` text, or the `prosrc` of a single-query `LANGUAGE sql` function. */
  sql: string
  /** Output column names in order. Only their count matters; results are positional. */
  columns: string[]
  /**
   * The declared type of each output column, as `format_type` prints it (types outside `pg_catalog` schema qualified),
   * for a function body: PostgreSQL coerces each selected value to it, and a coercion can yield NULL for a non-NULL
   * value or change what the value is. A column whose value is not provably of that very type is nullable and has no
   * `source`, except where the coercion is one the planner proves never yields NULL, which stays as traced without a
   * `source`. Absent for a view, whose column types are the types of its expressions.
   */
  outputTypes?: string[]
  catalog: TraceCatalog
  /**
   * Parameter names of a function body (`''` for an unnamed one). A name that is not a column of the query
   * resolves to a parameter, an expression of unknown nullability. `$1`-style references always do.
   */
  parameters?: string[]
  /** The function's name, for `function_name.param` references. */
  functionName?: string
}

export interface TracerOptions {
  /** PostgreSQL grammar of the parser. Defaults to 17. */
  pgVersion?: 15 | 16 | 17
}

export interface Tracer {
  /** Never rejects for bad SQL: that yields all-nullable columns with `error` set. */
  trace(input: TraceInput): Promise<TraceResult>
}
