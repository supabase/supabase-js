import { dirname, relative, resolve, sep } from 'node:path'
import { stripJsonc } from '../generate'
import type { OptionDiagnostic } from '../content-mapper'
import { locate, parseJsonc, positionOf } from './jsonc'
import type { CliContext, Flags } from './types'

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
  configFileName: string
  /** The `options` of the `.pgrst-index` entry, overrides applied */
  options: unknown
  /** Index of the entry in `contentMappers` */
  entryIndex: number
  text: string
}

export class CliError extends Error {}

/** Reads the tsconfig's `contentMappers` entry for `.pgrst-index`; throws `CliError` when there is none. */
export async function readMapperConfig(ctx: CliContext, flags: Flags): Promise<MapperConfig> {
  const configFileName = resolve(ctx.cwd, flags.project ?? 'tsconfig.json')
  const shown = display(ctx.cwd, configFileName)
  let text: string
  try {
    text = await ctx.fs.readFile(configFileName)
  } catch (error) {
    throw new CliError(`cannot read ${shown}: ${messageOf(error)}`)
  }
  let parsed: { contentMappers?: unknown }
  try {
    parsed = JSON.parse(stripJsonc(text)) as { contentMappers?: unknown }
  } catch (error) {
    throw new CliError(`cannot parse ${shown}: ${messageOf(error)}`)
  }
  const mappers = Array.isArray(parsed.contentMappers) ? (parsed.contentMappers as unknown[]) : []
  const entryIndex = mappers.findIndex(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      Array.isArray((entry as { extensions?: unknown }).extensions) &&
      ((entry as { extensions: unknown[] }).extensions as unknown[]).includes(INDEX_EXTENSION)
  )
  if (entryIndex === -1) {
    throw new CliError(`${shown} has no contentMappers entry for ${INDEX_EXTENSION}`)
  }
  const entry = mappers[entryIndex] as { options?: unknown }
  return {
    configFileName,
    options: applyOverrides(ctx, flags, entry.options),
    entryIndex,
    text,
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `--schema-source`, `--snapshot` and `--db-url-env` replace the matching part of the `schema` option. */
export function applyOverrides(ctx: CliContext, flags: Flags, options: unknown): unknown {
  const source = flags.schemaSource ?? (flags.snapshot !== undefined ? 'snapshot' : undefined)
  if (source === undefined && flags.dbUrlEnv === undefined) return options
  if (!isRecord(options)) return options
  const current = isRecord(options.schema) ? options.schema : {}
  const target = source ?? (current.source as string | undefined)
  let schema: Record<string, unknown>
  if (target === 'supabase-local') schema = { source: 'supabase-local' }
  else if (target === 'snapshot') {
    schema = {
      source: 'snapshot',
      ...(flags.snapshot !== undefined
        ? { path: resolve(ctx.cwd, flags.snapshot) }
        : current.path !== undefined
          ? { path: current.path }
          : {}),
    }
  } else if (target === 'postgrest') {
    const dbUrlEnv = flags.dbUrlEnv ?? current.dbUrlEnv
    schema = {
      source: 'postgrest',
      ...(dbUrlEnv !== undefined ? { dbUrlEnv } : {}),
      ...(current.config !== undefined ? { config: current.config } : {}),
    }
  } else return options
  return { ...options, schema }
}

/** `file:line:col code message` of an option diagnostic, at the value in the tsconfig when it can be found. */
export function formatOptionDiagnostic(
  ctx: CliContext,
  config: MapperConfig,
  diagnostic: OptionDiagnostic
): string {
  const file = display(ctx.cwd, config.configFileName)
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
  return `${file}:${line}:${column} ${diagnostic.code} ${diagnostic.messageText}`
}

export const projectDirOf = (config: MapperConfig): string => dirname(config.configFileName)
