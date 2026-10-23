import { PgParser } from '@supabase/pg-parser'
import { runTrace } from './trace'
import type { ParseSql } from './trace'
import type { Tracer, TracerOptions } from './types'

export type {
  CatalogColumn,
  CatalogRelation,
  ColumnSource,
  TraceCatalog,
  TraceInput,
  TraceResult,
  TracedColumn,
  Tracer,
  TracerOptions,
} from './types'

/**
 * Creates a tracer: view definitions and single-query SQL function bodies in, per-column nullability and
 * provenance out (design v5 §6.2, §4.3).
 *
 * libpg_query runs as wasm and parses asynchronously, so `trace` returns a promise; everything else is pure data
 * over data. The tracer reads no database, file or environment: the caller supplies the catalog facts.
 */
export async function createTracer(options: TracerOptions = {}): Promise<Tracer> {
  const parser = new PgParser<17>({ version: options.pgVersion ?? 17 })
  await parser.ready
  const parse: ParseSql = async (sql) => {
    const result = await parser.parse(sql)
    if (result.error) return { error: result.error.message }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { stmts: (result.tree.stmts ?? []).map((s: any) => s.stmt) }
  }
  return { trace: (input) => runTrace(parse, input) }
}
