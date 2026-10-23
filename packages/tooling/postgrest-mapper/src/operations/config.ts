import { dirname, relative, resolve, sep } from 'node:path'
import type { OptionDiagnostic } from '../content-mapper'
import { stripJsonc } from '../generate'
import { locate, parseJsonc, positionOf } from './jsonc'
import {
  OperationError,
  type LocatedDiagnostic,
  type ProjectInput,
  type ResolvedDeps,
  type SchemaOverrides,
} from './types'

/** The extension the mapper's index file has. */
export const INDEX_EXTENSION = '.pgrst-index'

export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** A path for messages: relative to the working directory, `/`-separated, unless it is outside it. */
export function display(cwd: string, path: string): string {
  const rel = relative(cwd, path)
  return (rel === '' || rel.startsWith('..') ? path : rel).split(sep).join('/')
}

export interface MapperConfig {
  /** Absolute path of the tsconfig */
  configFileName: string
  /** The `options` of the `.pgrst-index` entry, overrides applied */
  options: unknown
  /** Index of the entry in `contentMappers` */
  entryIndex: number
  text: string
}

export const projectDirOf = (config: Pick<MapperConfig, 'configFileName'>): string =>
  dirname(config.configFileName)

export const configFileOf = (deps: Pick<ResolvedDeps, 'cwd'>, input: ProjectInput): string =>
  resolve(deps.cwd, input.project ?? 'tsconfig.json')

/** Reads the tsconfig's `contentMappers` entry for `.pgrst-index`; throws `OperationError` when there is none. */
export async function readMapperConfig(
  deps: ResolvedDeps,
  input: ProjectInput
): Promise<MapperConfig> {
  const configFileName = configFileOf(deps, input)
  const shown = display(deps.cwd, configFileName)
  let text: string
  try {
    text = await deps.fs.readFile(configFileName)
  } catch (error) {
    throw new OperationError('config-unreadable', `cannot read ${shown}: ${messageOf(error)}`)
  }
  let parsed: { contentMappers?: unknown }
  try {
    parsed = JSON.parse(stripJsonc(text)) as { contentMappers?: unknown }
  } catch (error) {
    throw new OperationError('config-invalid', `cannot parse ${shown}: ${messageOf(error)}`)
  }
  const mappers = Array.isArray(parsed.contentMappers) ? (parsed.contentMappers as unknown[]) : []
  const entryIndex = mappers.findIndex(isIndexEntry)
  if (entryIndex === -1) {
    throw new OperationError(
      'no-mapper-entry',
      `${shown} has no contentMappers entry for ${INDEX_EXTENSION}`
    )
  }
  const entry = mappers[entryIndex] as { options?: unknown }
  return {
    configFileName,
    options: applyOverrides(deps.cwd, input, entry.options),
    entryIndex,
    text,
  }
}

/** Is this `contentMappers` entry the one for the index file? */
export const isIndexEntry = (entry: unknown): boolean =>
  typeof entry === 'object' &&
  entry !== null &&
  Array.isArray((entry as { extensions?: unknown }).extensions) &&
  ((entry as { extensions: unknown[] }).extensions as unknown[]).includes(INDEX_EXTENSION)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The overrides replace the matching part of the `schema` option. */
export function applyOverrides(cwd: string, overrides: SchemaOverrides, options: unknown): unknown {
  const source =
    overrides.schemaSource ?? (overrides.snapshot !== undefined ? 'snapshot' : undefined)
  if (source === undefined && overrides.dbUrlEnv === undefined) return options
  if (!isRecord(options)) return options
  const current = isRecord(options.schema) ? options.schema : {}
  const target = source ?? (current.source as string | undefined)
  let schema: Record<string, unknown>
  if (target === 'supabase-local') schema = { source: 'supabase-local' }
  else if (target === 'snapshot') {
    schema = {
      source: 'snapshot',
      ...(overrides.snapshot !== undefined
        ? { path: resolve(cwd, overrides.snapshot) }
        : current.path !== undefined
          ? { path: current.path }
          : {}),
    }
  } else if (target === 'postgrest') {
    const dbUrlEnv = overrides.dbUrlEnv ?? current.dbUrlEnv
    schema = {
      source: 'postgrest',
      ...(dbUrlEnv !== undefined ? { dbUrlEnv } : {}),
      ...(current.config !== undefined ? { config: current.config } : {}),
    }
  } else return options
  return { ...options, schema }
}

/** An option diagnostic placed at the value in the tsconfig, when it can be found. */
export function locateOptionDiagnostic(
  config: MapperConfig,
  diagnostic: OptionDiagnostic
): LocatedDiagnostic {
  let line = 1
  let column = 1
  try {
    const root = parseJsonc(config.text)
    const base = ['contentMappers', config.entryIndex, 'options'] as const
    for (let keep = diagnostic.path.length; keep >= 0; keep--) {
      const node = locate(root, [...base, ...diagnostic.path.slice(0, keep)])
      if (node) {
        ;({ line, column } = positionOf(config.text, node.start))
        break
      }
    }
  } catch {
    // the file was read and parsed once already; a failure here only costs the position
  }
  return {
    file: config.configFileName,
    line,
    column,
    code: diagnostic.code,
    message: diagnostic.messageText,
  }
}
