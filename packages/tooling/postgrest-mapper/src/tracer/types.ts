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

/** Plain, JSON-serialisable facts about the database. */
export interface TraceCatalog {
  relations: CatalogRelation[]
  /** Schemas searched, in order, for an unqualified relation name. Defaults to `['public']`. */
  searchPath?: string[]
}

export interface TraceInput {
  /** `pg_get_viewdef` text, or the `prosrc` of a single-query `LANGUAGE sql` function. */
  sql: string
  /** Output column names in order. Only their count matters; results are positional. */
  columns: string[]
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
