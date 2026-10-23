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
import { createSelectsContext, plannerErrorMessage, printModule, printSelects } from '../printer'
import type { PrintDiagnostic, SelectsEntry } from '../printer'
import { scanFiles } from '../index'
import { SchemaAcquisitionError, acquireSchema, exposedSchemas } from '../schema'
import { defaultFs } from '../schema/snapshot'
import type { AcquiredSchema, SchemaDeps, SchemaFs, SchemaSource } from '../schema'
import { createTracer } from '../tracer'
import type { Tracer } from '../tracer'
import { cacheDirectoryOf, createPlanCache, deserializeContext, serializeContext } from './cache'
import type { CacheFile, PlanCache, StoredPlan } from './cache'
import { planDatabase, printDatabaseMembers } from './database'
import type { DatabasePlanContext } from './database'
import { nodeProjectFs, resolveProjectFiles, displayPath } from './project'
import type { ProjectFs } from './project'
import { planKeysOf, planRequestOf } from './requests'
import type { PlanKey } from './requests'

/**
 * Bump when what the cache stores, or what the printer prints from it, changes. It is part of the identity and of
 * the cache validity, so the TypeScript server and the disk cache both see a new generator as a new input.
 */
export const GENERATOR_REVISION = 1

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
  /** Keys planned for (`SupabaseSelects` entries before the ones dropped as speculative) */
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
    keys: PlanKey[],
    cache: PlanCache | undefined
  ): Promise<Planned | { failure: string }> => {
    const cached = await cache?.read(schemaId)
    const entries = new Map<string, StoredPlan>()
    for (const k of keys) {
      const stored = cached?.entries[k.key]
      if (stored) entries.set(k.key, stored)
    }
    const missing = keys.filter((k) => !entries.has(k.key))
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
        const requests: PlanRequest[] = missing.map(planRequestOf)
        const results = await h.planMany(requests)
        missing.forEach((k, i) => {
          const result = results[i]!
          if (hostFailure(result)) {
            failures.push(`${k.key}: ${plannerErrorMessage(result as never)}`)
            return
          }
          if (!result.ok) {
            entries.set(k.key, {
              error: plannerErrorMessage(result),
              code: typeof result.error.code === 'string' ? result.error.code : null,
            })
          } else if (!result.shape) {
            entries.set(k.key, {
              error: 'the planner returned no result shape for this select',
              code: null,
            })
          } else {
            entries.set(k.key, { shape: result.shape, degraded: result.degraded ?? [] })
          }
        })
      }
      const file: CacheFile = {
        format: 1,
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
    const keys = planKeysOf(scan)
    logger.debug(
      `scanned ${resolved.files.length} files: ${keys.length} keys, ${scan.unresolved.length} unresolved uses`
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
      planned = await plan(acquired, schema.id, keys, cache)
    } catch (error) {
      logger.warn(`planning failed: ${messageOf(error)}`)
      report(DiagnosticCode.PlannerUnavailable, `the planner failed: ${messageOf(error)}`)
      return { ...empty(messageOf(error), watchedFiles), keys: keys.map((k) => k.key) }
    }
    if ('failure' in planned) {
      report(DiagnosticCode.PlannerUnavailable, planned.failure)
      return { ...empty(planned.failure, watchedFiles), keys: keys.map((k) => k.key) }
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
    for (const k of keys) {
      const stored = planned.entries.get(k.key)
      if (!stored) continue
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
    const selects = printSelects(context, entries)
    const text = printModule({
      database: members.text,
      selects: selects.text,
      postgrestVersion: acquired.postgrestVersion,
      ...(options.unplanned ? { unplanned: options.unplanned } : {}),
      ...(importFrom ? { importFrom } : {}),
    })

    const identity = hashOptions({
      schema: schema.id,
      keys: keys.map((k) => k.key),
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
      keys: keys.map((k) => k.key),
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
