import { join } from 'node:path'
import type { ResultShape, ShapeField } from '@supabase/postgrest-planner'
import type { SchemaFs } from '../schema'
import type { TracedColumn } from '../tracer'
import type { CallPlan } from '../printer'
import type { DatabasePlanContext } from './database'

/** Bump when the layout of the cache file changes. */
export const CACHE_FORMAT = 1

/** Where the cache lives, relative to the project directory (design v4 §5). */
export const CACHE_DIRECTORY = ['node_modules', '.cache', 'postgrest-mapper']

/**
 * What the planner said about one key: the shape of a select, what the printer reads of an rpc call or an operand
 * request (`call`), or why it rejected the request.
 */
export type StoredPlan =
  | { shape: ResultShape; degraded: string[] }
  | { call: CallPlan }
  | { error: string; code: string | null }

/** `DatabasePlanContext` as JSON. */
export interface StoredContext {
  plans: [string, ShapeField[]][]
  traces: [string, [string, TracedColumn][]][]
  jsonSchemas: [string, string][]
  diagnostics: { severity: 'info' | 'warning' | 'error'; message: string }[]
}

/**
 * One file per schema: `postgrest-mapper-<schema id>.json`. It holds the planner's answer for every key of the last
 * run against that schema (`entries`) and the schema-wide plan context (`select=*` of every relation, view traces,
 * JSON Schema types). Printing is never cached: the text is always rebuilt from these.
 */
export interface CacheFile {
  format: typeof CACHE_FORMAT
  /** `GENERATOR_REVISION`: a printer change does not need it, a change of what is stored does */
  generator: number
  /** Stamp of the planner build: another planner may answer differently */
  planner: string
  schema: string
  context: StoredContext
  entries: Record<string, StoredPlan>
}

export function serializeContext(
  context: DatabasePlanContext,
  diagnostics: StoredContext['diagnostics']
): StoredContext {
  return {
    plans: [...context.plans].map(([k, v]) => [k, [...v]]),
    traces: [...context.traces].map(([k, v]) => [k, [...v]]),
    jsonSchemas: [...context.jsonSchemas],
    diagnostics,
  }
}

export function deserializeContext(
  stored: StoredContext
): DatabasePlanContext & { diagnostics: StoredContext['diagnostics'] } {
  return {
    plans: new Map(stored.plans),
    traces: new Map(stored.traces.map(([k, v]) => [k, new Map(v)])),
    jsonSchemas: new Map(stored.jsonSchemas),
    diagnostics: stored.diagnostics,
  }
}

export interface PlanCache {
  /** `undefined` for a missing, unreadable, or stale file: all the same to the caller */
  read(schemaId: string): Promise<CacheFile | undefined>
  /** Failures are swallowed (a read-only checkout must still generate) and reported through the logger */
  write(file: CacheFile): Promise<void>
}

export interface PlanCacheOptions {
  fs: Pick<SchemaFs, 'readFile' | 'writeFile' | 'mkdir'>
  /** Absolute directory of the cache files */
  directory: string
  generator: number
  planner: string
  logger?: { debug(message: string): void; warn(message: string): void }
}

export const cacheDirectoryOf = (projectDir: string): string => join(projectDir, ...CACHE_DIRECTORY)

const fileName = (schemaId: string): string => `postgrest-mapper-${schemaId.slice(0, 32)}.json`

export function createPlanCache(options: PlanCacheOptions): PlanCache {
  const { fs, directory, logger } = options
  const path = (schemaId: string): string => join(directory, fileName(schemaId))
  return {
    async read(schemaId) {
      let text: string
      try {
        text = await fs.readFile(path(schemaId))
      } catch {
        return undefined
      }
      try {
        const file = JSON.parse(text) as CacheFile
        if (
          file.format !== CACHE_FORMAT ||
          file.generator !== options.generator ||
          file.planner !== options.planner ||
          file.schema !== schemaId
        ) {
          logger?.debug(`cache ${fileName(schemaId)} is stale`)
          return undefined
        }
        return file
      } catch {
        logger?.debug(`cache ${fileName(schemaId)} is unreadable`)
        return undefined
      }
    },
    async write(file) {
      try {
        await fs.mkdir(directory)
        await fs.writeFile(path(file.schema), JSON.stringify(file))
      } catch (error) {
        logger?.warn(
          `could not write the cache in ${directory}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
  }
}
