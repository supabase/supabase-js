import type { PlanResult, ShapeField } from '@supabase/postgrest-planner'
import { isHostFailure } from '../host'
import type { PlannerHost } from '../host'
import { jsonSchemaToTs } from '../jsonschema'
import { printDatabase, printModule } from '../printer'
import type { PrintDiagnostic, PrintModuleInput } from '../printer'
import { buildJsonSchemaInput, buildTraceCatalog, exposedSchemas } from '../schema'
import type { AcquiredSchema, SchemaLogger } from '../schema'
import type { TracedColumn, Tracer } from '../tracer'

export interface BuildDatabaseOptions {
  acquired: AcquiredSchema
  /** Loads the schema cache itself: pass a host that has not loaded anything yet (or whose load may be replaced) */
  host: PlannerHost
  tracer: Tracer
  /** Defaults to silence */
  logger?: Pick<SchemaLogger, 'debug' | 'warn'>
  /** Options of the emitted module (`importFrom`, `unplanned`); the release line comes from `acquired` */
  module?: Pick<PrintModuleInput, 'importFrom' | 'unplanned' | 'selects' | 'operands'>
}

/**
 * What `printDatabase` is fed and the selects printer reads: everything the planner and the tracer contribute. Plain
 * data, so it can be cached on disk (see `cache.ts`) while the printed text is always recomputed.
 */
export interface DatabasePlanContext {
  /** The output columns of `select=*` per `schema.relation` */
  plans: Map<string, readonly ShapeField[]>
  /** Tracer verdicts per `schema.view`, then per column */
  traces: Map<string, Map<string, TracedColumn>>
  /** `schema.table.column` to the TypeScript type of its `pg_jsonschema` CHECK constraints */
  jsonSchemas: Map<string, string>
}

/** `DatabasePlanContext` plus what was noticed while computing it. */
export interface DatabaseInputs extends DatabasePlanContext {
  diagnostics: PrintDiagnostic[]
  /**
   * The relations whose `select=*` the host could not plan (a timeout, a crashed worker). They are missing from
   * `plans` for that reason only, so the context is incomplete and a caller must not keep it
   */
  failures: string[]
}

/** The `SupabaseDatabase` members, without the module around them. */
export interface DatabaseMembers extends DatabasePlanContext {
  /** Only the members of `interface SupabaseDatabase`. Empty when the planner could not load the schema */
  database: string
  diagnostics: PrintDiagnostic[]
  /** `false` when the planner could not load the schema */
  loaded: boolean
}

export interface DatabaseDeclarations extends DatabasePlanContext {
  /** The complete declaration file. Empty when the planner could not load the schema */
  text: string
  /** Only the members of `interface SupabaseDatabase`, for callers that assemble their own module */
  database: string
  diagnostics: PrintDiagnostic[]
}

/** Upstream's code for a relation outside the schema cache (a partition, or one the role cannot see). */
const NOT_IN_SCHEMA_CACHE = 'PGRST205'

function grammarOf(pgVersionNum: number): 15 | 16 | 17 {
  const major = Math.floor(pgVersionNum / 10000)
  return major === 15 || major === 16 ? major : 17
}

/**
 * The acquire, plan, print pipeline for the `SupabaseDatabase` global (design v5 §5.1): loads the schema into the
 * planner host, plans `select=*` of every exposed relation (Row is its output shape), traces the views, converts the
 * JSON Schema CHECKs and prints. Planner and tracer failures degrade to diagnostics, never exceptions.
 */
export async function buildDatabaseDeclarations(
  options: BuildDatabaseOptions
): Promise<DatabaseDeclarations> {
  const built = await buildDatabaseMembers(options)
  if (!built.loaded) return { ...built, text: '' }
  const text = printModule({
    ...options.module,
    database: built.database,
    postgrestVersion: options.acquired.postgrestVersion,
  })
  return { ...built, text }
}

/** The plan and print part of `buildDatabaseDeclarations`, for callers that splice the members into their own module. */
export async function buildDatabaseMembers(
  options: Pick<BuildDatabaseOptions, 'acquired' | 'host' | 'tracer' | 'logger'>
): Promise<DatabaseMembers> {
  const planned = await planDatabase(options)
  if (!planned.ok) {
    return {
      database: '',
      diagnostics: planned.diagnostics,
      loaded: false,
      plans: new Map(),
      traces: new Map(),
      jsonSchemas: new Map(),
    }
  }
  const printed = printDatabaseMembers(options.acquired, planned.inputs)
  return {
    ...planned.inputs,
    database: printed.text,
    diagnostics: printed.diagnostics,
    loaded: true,
  }
}

/** The members of `interface SupabaseDatabase` for inputs `planDatabase` computed (or the cache kept). Pure. */
export function printDatabaseMembers(
  acquired: AcquiredSchema,
  inputs: DatabasePlanContext & { diagnostics?: PrintDiagnostic[] }
): { text: string; diagnostics: PrintDiagnostic[] } {
  const printed = printDatabase({
    supplementary: acquired.supplementary,
    dump: acquired.dump,
    schemas: exposedSchemas(acquired.config),
    plans: inputs.plans,
    traces: inputs.traces,
    jsonSchemas: inputs.jsonSchemas,
  })
  return {
    text: printed.text,
    diagnostics: [...(inputs.diagnostics ?? []), ...printed.diagnostics],
  }
}

/**
 * Loads the schema into the host, plans `select=*` of every exposed relation, traces the views and converts the JSON
 * Schema CHECKs: the part of the pipeline that needs the planner. `ok: false` when the planner could not load.
 */
export async function planDatabase(
  options: Pick<BuildDatabaseOptions, 'acquired' | 'host' | 'tracer' | 'logger'> & {
    /** The host already holds `acquired` (the caller loaded it): do not load it again */
    loaded?: boolean
  }
): Promise<{ ok: true; inputs: DatabaseInputs } | { ok: false; diagnostics: PrintDiagnostic[] }> {
  const { acquired, host, tracer, logger } = options
  const { supplementary } = acquired
  const diagnostics: PrintDiagnostic[] = []
  const note = (severity: PrintDiagnostic['severity'], message: string): void => {
    diagnostics.push({ severity, message })
    if (severity !== 'info') logger?.warn(message)
    else logger?.debug(message)
  }

  if (!options.loaded) {
    const loaded = await host.load(acquired)
    if (!loaded.ok) {
      note(
        'error',
        `the planner could not load the schema: ${loaded.error.code ?? ''} ${loaded.error.message ?? ''}`.trim()
      )
      return { ok: false, diagnostics }
    }
    if (loaded.degraded.length > 0) {
      note('info', `planner load is degraded: ${loaded.degraded.join(', ')}`)
    }
  }

  // ---- Row: the output of `select=*`
  const relations = [...supplementary.relations].sort((a, b) =>
    a.schema + '.' + a.name < b.schema + '.' + b.name ? -1 : 1
  )
  const results: PlanResult[] = await host.planMany(
    relations.map((r) => ({
      method: 'GET',
      url: `/${encodeURIComponent(r.name)}?select=*`,
      headers: { 'Accept-Profile': r.schema },
    }))
  )
  const plans = new Map<string, readonly ShapeField[]>()
  const failures: string[] = []
  relations.forEach((r, i) => {
    const name = `${r.schema}.${r.name}`
    const result = results[i]!
    if (!result.ok) {
      if (result.error.code === NOT_IN_SCHEMA_CACHE) {
        note('info', `${name} is not in the PostgREST schema cache: left out`)
      } else {
        if (isHostFailure(result)) failures.push(name)
        note(
          'warning',
          `could not plan select=* of ${name}: ${result.error.code ?? ''} ${result.error.message ?? ''}`.trim()
        )
      }
      return
    }
    if (!result.shape) {
      note('warning', `the plan of select=* of ${name} has no result shape: left out`)
      return
    }
    plans.set(name, result.shape.fields)
  })

  // ---- view nullability (design v5 §6.2)
  const catalog = buildTraceCatalog(supplementary)
  const traces = new Map<string, Map<string, TracedColumn>>()
  for (const r of relations) {
    // a materialized view is not traced: its stored rows can predate constraints of its base tables (its columns stay
    // nullable and keep their own key, so no base-table JSON Schema applies)
    if (r.kind !== 'v' || !r.viewDefinition || !plans.has(`${r.schema}.${r.name}`)) continue
    const columns = [...r.columns].sort((a, b) => a.attnum - b.attnum)
    const traced = await tracer.trace({
      sql: r.viewDefinition,
      columns: columns.map((c) => c.name),
      catalog,
    })
    if (traced.error)
      note(
        'info',
        `${r.schema}.${r.name}: view not fully traced, columns stay nullable: ${traced.error}`
      )
    traces.set(
      `${r.schema}.${r.name}`,
      new Map(columns.map((c, i) => [c.name, traced.columns[i] ?? { nullable: true }]))
    )
  }

  // ---- JSON columns (design v5 §6.1)
  const jsonSchemas = new Map<string, string>()
  const json = await buildJsonSchemaInput(supplementary, {
    pgVersion: grammarOf(acquired.pgVersionNum),
  })
  for (const c of json.columns) {
    jsonSchemas.set(
      `${c.schema}.${c.table}.${c.column}`,
      jsonSchemaToTs(c.jsonSchema, { jsonType: 'Json' })
    )
  }
  for (const i of json.ignored) {
    note('info', `${i.schema}.${i.table}: constraint ${i.constraint} ignored: ${i.reason}`)
  }

  return { ok: true, inputs: { plans, traces, jsonSchemas, diagnostics, failures } }
}
