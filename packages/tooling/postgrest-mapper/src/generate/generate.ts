import { stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { PlanRequest, PlanResult } from '@supabase/postgrest-planner'
import { DiagnosticCode, validateOptions } from '../content-mapper/options'
import type { PostgrestMapperOptions } from '../content-mapper/options'
import { hashOptions } from '../content-mapper/hash'
import type {
  GenerateProjectParams,
  GenerateProjectResult,
  ProjectGenerator,
} from '../content-mapper/generator'
import type { MapperDiagnostic, OptionDiagnostic } from '../content-mapper/protocol'
import { HOST_ERROR, createPlannerHost } from '../host'
import type { PlannerHost } from '../host'
import {
  callReturnsOf,
  createSelectsContext,
  plannerErrorMessage,
  printModule,
  printOperands,
  printRpcEntry,
  printSelects,
  routineSignatures,
} from '../printer'
import type { CallOutcome, OperandInput, PrintDiagnostic, RpcCall, SelectsEntry } from '../printer'
import { scanFiles } from '../scanner'
import { SchemaAcquisitionError, acquireSchema, exposedSchemas } from '../schema'
import { defaultFs } from '../schema/snapshot'
import type { AcquiredSchema, SchemaDeps, SchemaFs, SchemaSource } from '../schema'
import { createTracer } from '../tracer'
import type { Tracer } from '../tracer'
import {
  CACHE_FORMAT,
  cacheDirectoryOf,
  createPlanCache,
  deserializeContext,
  serializeContext,
} from './cache'
import type { CacheFile, PlanCache, StoredPlan } from './cache'
import { planDatabase, printDatabaseMembers } from './database'
import type { DatabasePlanContext } from './database'
import { nodeProjectFs, resolveProjectFiles, displayPath } from './project'
import type { ProjectFs } from './project'
import {
  callIdOf,
  operandRequestOf,
  planKeysOf,
  planOperandsOf,
  planRequestOf,
  planRpcOf,
  rpcRequestOf,
} from './requests'

/**
 * Bump when what the cache stores, or what the printer prints from it, changes. It is part of the identity and of
 * the cache validity, so the TypeScript server and the disk cache both see a new generator as a new input.
 */
export const GENERATOR_REVISION = 2

export interface GeneratorLogger {
  debug(message: string): void
  warn(message: string): void
}

const silent: GeneratorLogger = { debug() {}, warn() {} }

/** The file system the generator reads sources and writes its cache with. */
export type GeneratorFs = ProjectFs & SchemaFs

export const nodeGeneratorFs: GeneratorFs = { ...nodeProjectFs, ...defaultFs }

/** Everything the generator touches outside itself; every field has a production default. */
export interface GeneratorDeps {
  /** Sources, snapshots and the cache. Defaults to `node:fs` */
  fs?: GeneratorFs
  /** Process execution and database access of the schema sources. `fs` is taken from the field above */
  schema?: Omit<SchemaDeps, 'fs'>
  /** Where `postgrest.dbUrlEnv` is read. Defaults to `process.env` */
  env?: Record<string, string | undefined>
  /** Directory of a project without a tsconfig. Defaults to `process.cwd()` */
  cwd?: string
  /** `postgrest-planner.wasm`. Defaults to the planner package's own build */
  wasmPath?: string
  /** Starts the planner host, once, on the first cache miss. Defaults to `createPlannerHost({ wasmPath })` */
  createHost?: () => PlannerHost
  /** Starts the SQL tracer, once, when a schema is planned for the first time. Defaults to `createTracer` */
  createTracer?: () => Promise<Tracer>
  /** Identifies the planner build for the cache. Defaults to the size and mtime of the wasm */
  plannerStamp?: () => Promise<string>
  /** Where the cache lives. Defaults to `<project>/node_modules/.cache/postgrest-mapper`; `false` turns it off */
  cacheDirectory?: ((projectDir: string) => string) | false
  /** Where `SupabaseColumnType` is imported from in the generated module. Default `@supabase/postgrest-js` */
  importFrom?: string
  logger?: GeneratorLogger
}

/** How the planner's work was obtained: `hit` all from the cache, `partial` some keys were planned, `miss` everything. */
export type CacheOutcome = 'hit' | 'partial' | 'miss' | 'disabled'

export interface GenerateOutput extends GenerateProjectResult {
  /**
   * What was planned: the `SupabaseSelects` keys of relation chains before the ones dropped as speculative, and an id
   * per rpc call and per operand request
   */
  keys: string[]
  cache: CacheOutcome
}

export interface Generator {
  generate(
    params: Pick<GenerateProjectParams, 'configFileName' | 'options'>
  ): Promise<GenerateOutput>
  /** Stops the planner host. The generator can be used again: the next miss starts a new host */
  close(): Promise<void>
}

const EMPTY_MODULE = 'export {}\n'

const byKey = (a: { key: string }, b: { key: string }): number =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : 0

/**
 * One request to plan. `select`: a relation's `SupabaseSelects` entry, stored with its shape; `call`: an rpc call, stored
 * with everything the printer reads of it; `operand`: an operand request, stored with its filters only.
 */
interface PlanItem {
  id: string
  request: PlanRequest
  kind: 'select' | 'call' | 'operand'
}

interface SchemaOk {
  ok: true
  acquired: AcquiredSchema
  /** Hash of everything of the schema that can change the output */
  id: string
  watched: string[]
}
interface SchemaFailure {
  ok: false
  watched: string[]
  diagnostic?: string
  optionDiagnostic?: OptionDiagnostic
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export function createGenerator(deps: GeneratorDeps = {}): Generator {
  const fs = deps.fs ?? nodeGeneratorFs
  const logger = deps.logger ?? silent
  const env = deps.env ?? process.env
  const cwd = deps.cwd ?? process.cwd()

  // ---- state shared by every project of the process
  const schemas = new Map<string, Promise<SchemaOk | SchemaFailure>>()
  let host: PlannerHost | undefined
  let tracer: Promise<Tracer> | undefined
  let stamp: Promise<string> | undefined
  let loadedSchema: string | undefined
  let queue: Promise<unknown> = Promise.resolve()

  // the planner package is only loaded when a plan is needed: a cache hit never touches it
  const wasmPath = (): string =>
    deps.wasmPath ??
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (
      require('@supabase/postgrest-planner') as typeof import('@supabase/postgrest-planner')
    ).defaultWasmPath()
  const plannerStamp = (): Promise<string> =>
    (stamp ??= (deps.plannerStamp ?? defaultStamp(wasmPath))())
  const getHost = (): PlannerHost =>
    (host ??= (
      deps.createHost ??
      (() => createPlannerHost({ ...(deps.wasmPath ? { wasmPath: deps.wasmPath } : {}), logger }))
    )())
  const getTracer = (): Promise<Tracer> => (tracer ??= (deps.createTracer ?? createTracer)())

  /** One planner at a time: a host holds one schema, and loading replaces it */
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const run = queue.then(work, work)
    queue = run.catch(() => undefined)
    return run
  }

  // ---- schema
  const sourceOf = async (
    options: PostgrestMapperOptions,
    projectDir: string
  ): Promise<{ source: SchemaSource; watched: string[] } | SchemaFailure> => {
    const schema = options.schema
    if (schema.source === 'snapshot') {
      const path = resolve(projectDir, schema.path)
      return { source: { source: 'snapshot', path }, watched: [path] }
    }
    if (schema.source === 'postgrest') {
      const dbUrl = env[schema.dbUrlEnv]
      if (!dbUrl) {
        return {
          ok: false,
          watched: [],
          optionDiagnostic: {
            path: ['schema', 'dbUrlEnv'],
            code: DiagnosticCode.InvalidOption,
            messageText: `The environment variable '${schema.dbUrlEnv}' is not set.`,
          },
        }
      }
      return {
        source: { source: 'postgrest', dbUrl, ...(schema.config ? { config: schema.config } : {}) },
        watched: [],
      }
    }
    return {
      source: { source: 'supabase-local', workdir: await findSupabaseWorkdir(projectDir) },
      watched: [],
    }
  }

  /** The nearest directory upwards that holds `supabase/config.toml`, else the project's own */
  const findSupabaseWorkdir = async (projectDir: string): Promise<string> => {
    for (let dir = projectDir; ; dir = dirname(dir)) {
      try {
        await fs.readFile(resolve(dir, 'supabase', 'config.toml'))
        return dir
      } catch {
        // keep climbing
      }
      if (dirname(dir) === dir) return projectDir
    }
  }

  const acquire = async (
    options: PostgrestMapperOptions,
    projectDir: string
  ): Promise<SchemaOk | SchemaFailure> => {
    const resolved = await sourceOf(options, projectDir)
    if ('ok' in resolved) return resolved
    const { source, watched } = resolved
    try {
      logger.debug(`acquiring the schema from ${source.source}`)
      const acquired = await acquireSchema(source, { ...deps.schema, fs })
      return { ok: true, acquired, id: hashOptions(acquired), watched }
    } catch (error) {
      const message = messageOf(error)
      if (error instanceof SchemaAcquisitionError && error.code.startsWith('snapshot-')) {
        return {
          ok: false,
          watched,
          optionDiagnostic: {
            path: ['schema', 'path'],
            code: DiagnosticCode.InvalidOption,
            messageText: message,
          },
        }
      }
      return { ok: false, watched, diagnostic: `the schema could not be acquired: ${message}` }
    }
  }

  /**
   * A snapshot is read at every open (it is a file the project watches and it is cheap); a live source is acquired
   * once per process and source, because it costs a container round trip and a database connection.
   */
  const schemaFor = async (
    options: PostgrestMapperOptions,
    projectDir: string
  ): Promise<SchemaOk | SchemaFailure> => {
    if (options.schema.source === 'snapshot') return acquire(options, projectDir)
    const key = hashOptions({ schema: options.schema, projectDir, db: dbKey(options) })
    let pending = schemas.get(key)
    if (!pending) {
      pending = acquire(options, projectDir)
      schemas.set(key, pending)
    }
    const result = await pending
    if (!result.ok) schemas.delete(key) // a failure is retried at the next open
    return result
  }
  const dbKey = (options: PostgrestMapperOptions): string | undefined =>
    options.schema.source === 'postgrest'
      ? hashOptions(env[options.schema.dbUrlEnv] ?? '')
      : undefined

  // ---- planning
  const hostFailure = (result: PlanResult): boolean =>
    !result.ok && Object.values(HOST_ERROR).includes(String(result.error.code) as never)

  interface Planned {
    entries: Map<string, StoredPlan>
    context: DatabasePlanContext
    contextDiagnostics: PrintDiagnostic[]
    cache: CacheOutcome
    failures: string[]
  }

  const plan = async (
    acquired: AcquiredSchema,
    schemaId: string,
    keys: PlanItem[],
    cache: PlanCache | undefined
  ): Promise<Planned | { failure: string }> => {
    const cached = await cache?.read(schemaId)
    const entries = new Map<string, StoredPlan>()
    for (const k of keys) {
      const stored = cached?.entries[k.id]
      if (stored) entries.set(k.id, stored)
    }
    const missing = keys.filter((k) => !entries.has(k.id))
    let context = cached ? deserializeContext(cached.context) : undefined
    if (context && missing.length === 0) {
      logger.debug(`cache hit: ${keys.length} keys of schema ${schemaId.slice(0, 12)}`)
      return {
        entries,
        context,
        contextDiagnostics: context.diagnostics,
        cache: 'hit',
        failures: [],
      }
    }

    return exclusive(async () => {
      const h = getHost()
      if (loadedSchema !== schemaId) {
        loadedSchema = undefined
        const loaded = await h.load(acquired)
        if (!loaded.ok) {
          return {
            failure:
              `the planner could not load the schema: ${loaded.error.code ?? ''} ${loaded.error.message ?? ''}`.trim(),
          }
        }
        loadedSchema = schemaId
      }
      const failures: string[] = []
      let diagnostics: PrintDiagnostic[] = context?.diagnostics ?? []
      if (!context) {
        const planned = await planDatabase({
          acquired,
          host: h,
          tracer: await getTracer(),
          logger,
          loaded: true,
        })
        if (!planned.ok) return { failure: planned.diagnostics.map((d) => d.message).join('; ') }
        context = { ...planned.inputs, diagnostics: planned.inputs.diagnostics }
        diagnostics = planned.inputs.diagnostics
      }
      if (missing.length > 0) {
        logger.debug(`planning ${missing.length} of ${keys.length} keys`)
        const results = await h.planMany(missing.map((k) => k.request))
        missing.forEach((k, i) => {
          const result = results[i]!
          if (hostFailure(result)) {
            failures.push(`${k.id}: ${plannerErrorMessage(result as never)}`)
            return
          }
          if (!result.ok) {
            entries.set(k.id, {
              error: plannerErrorMessage(result),
              code: typeof result.error.code === 'string' ? result.error.code : null,
            })
          } else if (k.kind === 'select') {
            entries.set(
              k.id,
              result.shape
                ? { shape: result.shape, degraded: result.degraded ?? [] }
                : { error: 'the planner returned no result shape for this select', code: null }
            )
          } else {
            entries.set(k.id, {
              call: {
                form: result.form ?? null,
                shape: k.kind === 'call' ? (result.shape ?? null) : null,
                rpc: k.kind === 'call' ? (result.rpc ?? null) : null,
                returns: k.kind === 'call' ? callReturnsOf(result.routine) : null,
                filters: k.kind === 'operand' ? (result.filters ?? []) : [],
                degraded: result.degraded ?? [],
              },
            })
          }
        })
      }
      const file: CacheFile = {
        format: CACHE_FORMAT,
        generator: GENERATOR_REVISION,
        planner: await plannerStamp(),
        schema: schemaId,
        context: serializeContext(context, diagnostics),
        entries: Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : 1))),
      }
      if (failures.length === 0) await cache?.write(file)
      return {
        entries,
        context,
        contextDiagnostics: diagnostics,
        cache:
          cache === undefined
            ? ('disabled' as const)
            : cached
              ? ('partial' as const)
              : ('miss' as const),
        failures,
      }
    })
  }

  // ---- one project
  const generate: Generator['generate'] = async ({ configFileName, options }) => {
    const projectDir = configFileName ? dirname(configFileName) : cwd
    const diagnostics: MapperDiagnostic[] = []
    const report = (code: number, messageText: string): void => {
      diagnostics.push({ code, messageText, start: 0, length: 0 })
    }
    const empty = (
      identity: unknown,
      watchedFiles: readonly string[],
      optionDiagnostics: OptionDiagnostic[] = []
    ): GenerateOutput => ({
      identity: hashOptions({ generator: GENERATOR_REVISION, failure: identity, options }),
      watchedFiles,
      text: EMPTY_MODULE,
      diagnostics,
      optionDiagnostics,
      keys: [],
      cache: 'disabled',
    })

    const schema = await schemaFor(options, projectDir)
    if (!schema.ok) {
      if (schema.diagnostic) report(DiagnosticCode.SchemaUnavailable, schema.diagnostic)
      return empty(
        schema.diagnostic ?? schema.optionDiagnostic?.messageText ?? 'schema',
        schema.watched,
        schema.optionDiagnostic ? [schema.optionDiagnostic] : []
      )
    }
    const { acquired } = schema

    // ---- scan
    const resolved = await resolveProjectFiles(fs, {
      configFileName,
      projectDir,
      ...(options.scan ? { scan: options.scan } : {}),
    })
    for (const warning of resolved.warnings) logger.warn(warning)
    const sources = await Promise.all(
      resolved.files.map(async (fileName) => {
        try {
          return { fileName, sourceText: await fs.readFile(fileName) }
        } catch (error) {
          logger.warn(`could not read ${displayPath(projectDir, fileName)}: ${messageOf(error)}`)
          return undefined
        }
      })
    )
    const scan = scanFiles(
      sources.filter((s) => s !== undefined),
      {
        exposedSchemas: options.defaultSchema
          ? [options.defaultSchema]
          : exposedSchemas(acquired.config),
      }
    )
    const signatures = routineSignatures(acquired.supplementary, acquired.dump)
    const selectKeys = planKeysOf(scan)
    const rpcKeys = planRpcOf(scan, signatures)
    const operandKeys = planOperandsOf(scan, signatures)
    const items: PlanItem[] = [
      ...selectKeys.map((k) => ({ id: k.key, request: planRequestOf(k), kind: 'select' as const })),
      ...rpcKeys.map((k) => ({ id: k.id, request: rpcRequestOf(k), kind: 'call' as const })),
      ...operandKeys.map((k) => ({
        id: k.id,
        request: operandRequestOf(k),
        kind: 'operand' as const,
      })),
    ]
    const ids = items.map((k) => k.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    logger.debug(
      `scanned ${resolved.files.length} files: ${selectKeys.length} selects, ${rpcKeys.length} rpc calls, ${operandKeys.length} operands, ${scan.unresolved.length} unresolved uses`
    )
    const watchedFiles = [...new Set([...resolved.files, ...schema.watched])].sort()

    // ---- plan
    const cacheDirectory =
      deps.cacheDirectory === false
        ? undefined
        : (deps.cacheDirectory ?? cacheDirectoryOf)(projectDir)
    let cache: PlanCache | undefined
    let stampValue: string
    try {
      stampValue = await plannerStamp()
    } catch (error) {
      report(
        DiagnosticCode.PlannerUnavailable,
        `the planner build could not be read: ${messageOf(error)}`
      )
      return { ...empty('planner', watchedFiles), keys: [] }
    }
    if (cacheDirectory !== undefined) {
      cache = createPlanCache({
        fs,
        directory: cacheDirectory,
        generator: GENERATOR_REVISION,
        planner: stampValue,
        logger,
      })
    }

    let planned: Awaited<ReturnType<typeof plan>>
    try {
      planned = await plan(acquired, schema.id, items, cache)
    } catch (error) {
      logger.warn(`planning failed: ${messageOf(error)}`)
      report(DiagnosticCode.PlannerUnavailable, `the planner failed: ${messageOf(error)}`)
      return { ...empty(messageOf(error), watchedFiles), keys: ids }
    }
    if ('failure' in planned) {
      report(DiagnosticCode.PlannerUnavailable, planned.failure)
      return { ...empty(planned.failure, watchedFiles), keys: ids }
    }
    for (const failure of planned.failures) {
      report(DiagnosticCode.PlannerUnavailable, `the planner could not plan ${failure}`)
    }

    // ---- print
    const importFrom = deps.importFrom
    const members = printDatabaseMembers(acquired, {
      ...planned.context,
      diagnostics: planned.contextDiagnostics,
    })
    const context = createSelectsContext({
      supplementary: acquired.supplementary,
      plans: planned.context.plans,
      traces: planned.context.traces,
      jsonSchemas: planned.context.jsonSchemas,
      ...(importFrom ? { importFrom } : {}),
    })
    const entries: SelectsEntry[] = []
    for (const k of selectKeys) {
      const stored = planned.entries.get(k.key)
      if (!stored || 'call' in stored) continue
      if ('shape' in stored) {
        entries.push({ key: k.key, shape: stored.shape, degraded: stored.degraded })
      } else if (k.speculative) {
        continue // a pairing the scanner guessed: no chain looks it up unless it is real, and then it is scanned
      } else if (stored.code === 'PGRST205' && k.schemaCount > 1) {
        continue // the relation lives in another schema of the candidates
      } else {
        entries.push({ key: k.key, error: stored.error })
      }
    }
    entries.sort(byKey)

    // ---- rpc entries and operands
    const outcomeOf = (id: string): CallOutcome | undefined => {
      const stored = planned.entries.get(id)
      if (!stored) return undefined
      if ('call' in stored) return { plan: stored.call }
      if ('error' in stored) return { error: stored.error }
      return undefined
    }
    const codeOf = (id: string): string | null => {
      const stored = planned.entries.get(id)
      return stored && 'error' in stored ? stored.code : null
    }
    /** A failure the call has no entry for: a guessed key set, or a function of another schema of the candidates */
    const dropped = (id: string, exact: boolean, schemaCount: number): boolean =>
      !exact || (codeOf(id) === 'PGRST202' && schemaCount > 1)
    const rootFieldsOf = (id: string): ReadonlySet<string> | undefined => {
      const outcome = outcomeOf(id)
      return outcome && 'plan' in outcome && outcome.plan.shape
        ? new Set(outcome.plan.shape.fields.map((f) => f.name))
        : undefined
    }

    const rpcEntries = new Map<string, { select: string; calls: RpcCall[] }>()
    for (const k of rpcKeys) {
      const outcome = outcomeOf(k.id)
      if (!outcome || ('error' in outcome && dropped(k.id, k.exact, k.schemaCount))) continue
      const group = rpcEntries.get(k.entry) ?? { select: k.select, calls: [] }
      rpcEntries.set(k.entry, group)
      group.calls.push({
        keys: k.keys,
        method: k.method,
        outcome,
        ...(k.select === '*' ? {} : { star: outcomeOf(callIdOf(k, '*')) }),
      })
    }
    for (const [key, { select, calls }] of rpcEntries) {
      const printed = printRpcEntry(context, key, select, calls)
      if (printed) entries.push(printed)
    }

    const operands: OperandInput[] = []
    const rpcOperands = new Map<string, { operand: string; calls: RpcCall[]; plain: boolean }>()
    for (const k of operandKeys) {
      const outcome = outcomeOf(k.id)
      if (!outcome) continue
      if (k.kind !== 'f') {
        const columns = planned.context.plans.get(`${k.schema}.${k.relation}`)
        if (columns?.some((f) => f.name === k.operand)) continue // a column of the row: the consumer reads the row
        if ('error' in outcome) {
          if (k.select !== '*' && 'error' in (outcomeOf(k.selectEntry) ?? {})) continue // the select reports it
          if (codeOf(k.id) === 'PGRST205' && k.schemaCount > 1) continue
        }
        operands.push({ key: k.entry, operand: k.operand, outcome })
        continue
      }
      if ('error' in outcome) {
        if (dropped(k.id, k.exact, k.schemaCount)) continue
        if (k.select !== '*' && 'error' in (outcomeOf(callIdOf(k, k.select)) ?? {})) continue
      }
      const group = rpcOperands.get(k.entry) ?? { operand: k.operand, calls: [], plain: true }
      rpcOperands.set(k.entry, group)
      group.calls.push({ keys: k.keys, method: k.method, outcome })
      if (!rootFieldsOf(callIdOf(k, '*'))?.has(k.operand)) group.plain = false
    }
    for (const [key, group] of rpcOperands) {
      if (group.plain) continue // a column of every call's row: the consumer reads the row
      operands.push({ key, operand: group.operand, calls: group.calls })
    }

    const selects = printSelects(context, entries)
    const text = printModule({
      database: members.text,
      selects: selects.text,
      operands: printOperands(context, operands),
      postgrestVersion: acquired.postgrestVersion,
      ...(options.unplanned ? { unplanned: options.unplanned } : {}),
      ...(importFrom ? { importFrom } : {}),
    })

    const identity = hashOptions({
      schema: schema.id,
      keys: ids,
      generator: GENERATOR_REVISION,
      planner: stampValue,
      options,
      importFrom,
    })
    return {
      identity,
      watchedFiles,
      text,
      diagnostics,
      optionDiagnostics: [],
      keys: ids,
      cache: planned.cache,
    }
  }

  return {
    generate,
    async close() {
      const closing = host
      host = undefined
      loadedSchema = undefined
      await closing?.close()
    },
  }
}

/** Size and mtime of the wasm: the planner package rebuilds it in place */
function defaultStamp(wasmPath: () => string): () => Promise<string> {
  return async () => {
    try {
      const s = await stat(wasmPath())
      return `${s.size}:${Math.round(s.mtimeMs)}`
    } catch {
      return 'unknown'
    }
  }
}

/** A content-mapper generator over `createGenerator`; `close` stops the planner host. */
export function createProjectGenerator(
  deps: GeneratorDeps = {}
): ProjectGenerator & { close(): Promise<void> } {
  const generator = createGenerator(deps)
  const run: ProjectGenerator = async ({ configFileName, options }) => {
    const { identity, watchedFiles, text, diagnostics, optionDiagnostics } =
      await generator.generate({ configFileName, options })
    return { identity, watchedFiles, text, diagnostics, optionDiagnostics }
  }
  return Object.assign(run, { close: () => generator.close() })
}

export type GenerateDeclarationsInput = (
  | { projectDir: string; configFileName?: undefined }
  | { configFileName: string; projectDir?: undefined }
) & {
  /** The `contentMappers[].options` object */
  options: unknown
  deps?: GeneratorDeps
}

export interface GenerateDeclarationsResult extends GenerateOutput {}

/**
 * The pipeline the content mapper runs, as a function (and the one a CLI `generate` command calls): scan the project,
 * acquire the schema, plan, print. `projectDir` uses its `tsconfig.json`. Invalid options come back as
 * `optionDiagnostics` with an empty module. The planner host is stopped before it returns.
 */
export async function generateDeclarations(
  input: GenerateDeclarationsInput
): Promise<GenerateDeclarationsResult> {
  const validation = validateOptions(input.options)
  if (!validation.ok) {
    return {
      identity: hashOptions(input.options),
      watchedFiles: [],
      text: EMPTY_MODULE,
      diagnostics: [],
      optionDiagnostics: validation.diagnostics,
      keys: [],
      cache: 'disabled',
    }
  }
  const configFileName = input.configFileName ?? resolve(input.projectDir, 'tsconfig.json')
  const generator = createGenerator(input.deps)
  try {
    return await generator.generate({ configFileName, options: validation.options })
  } finally {
    await generator.close()
  }
}
