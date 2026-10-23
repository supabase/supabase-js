import type { OptionDiagnostic } from './protocol'

/** Codes of the diagnostics this package reports (option diagnostics 1xxx, index file diagnostics 2xxx). */
export const DiagnosticCode = {
  InvalidOptions: 1001,
  MissingOption: 1002,
  InvalidOption: 1003,
  UnknownOption: 1004,
  DuplicateIndexFile: 2001,
} as const

/** Where the upstream schema dump comes from (design v3 §4.2). */
export type SchemaSourceOptions =
  | { source: 'supabase-local' }
  | { source: 'postgrest'; dbUrlEnv: string; config?: Record<string, string> }
  | { source: 'snapshot'; path: string }

/** The `options` object of the tsconfig `contentMappers` entry (design v5 §4.1). */
export interface PostgrestMapperOptions {
  /** Upstream PostgREST release line, for example `14.4`. */
  postgrest: string
  defaultSchema?: string
  schema: SchemaSourceOptions
  /** Globs of the files to scan. Defaults to the tsconfig's include/exclude. */
  scan?: string[]
  /** What an unindexed literal select does. Defaults to `loose`. */
  unplanned?: 'loose' | 'error'
}

export type OptionsValidation =
  | { ok: true; options: PostgrestMapperOptions; diagnostics: [] }
  | { ok: false; diagnostics: OptionDiagnostic[] }

type Path = (string | number)[]

const SOURCES = ['supabase-local', 'postgrest', 'snapshot'] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Checks the shape of the mapper options. Every problem is reported; nothing throws. */
export function validateOptions(raw: unknown): OptionsValidation {
  const diagnostics: OptionDiagnostic[] = []
  const report = (path: Path, code: number, messageText: string) =>
    diagnostics.push({ path, messageText, code })

  const unknownKeys = (value: Record<string, unknown>, known: string[], path: Path) => {
    for (const key of Object.keys(value)) {
      if (!known.includes(key)) {
        report(
          [...path, key],
          DiagnosticCode.UnknownOption,
          `Unknown option '${key}'. Expected one of: ${known.join(', ')}.`
        )
      }
    }
  }

  const requireString = (value: Record<string, unknown>, key: string, path: Path): boolean => {
    const at = [...path, key]
    if (!(key in value)) {
      report(at, DiagnosticCode.MissingOption, `Option '${key}' is required.`)
      return false
    }
    if (typeof value[key] !== 'string' || value[key] === '') {
      report(at, DiagnosticCode.InvalidOption, `Option '${key}' must be a non-empty string.`)
      return false
    }
    return true
  }

  if (!isRecord(raw)) {
    report([], DiagnosticCode.InvalidOptions, 'The mapper options must be an object.')
    return { ok: false, diagnostics }
  }

  unknownKeys(raw, ['postgrest', 'defaultSchema', 'schema', 'scan', 'unplanned'], [])

  if (requireString(raw, 'postgrest', []) && !/^\d+\.\d+(\.\d+)?$/.test(raw.postgrest as string)) {
    report(
      ['postgrest'],
      DiagnosticCode.InvalidOption,
      "Option 'postgrest' must be an upstream release such as '14.4' or '14.4.1'."
    )
  }

  if (
    'defaultSchema' in raw &&
    (typeof raw.defaultSchema !== 'string' || raw.defaultSchema === '')
  ) {
    report(
      ['defaultSchema'],
      DiagnosticCode.InvalidOption,
      "Option 'defaultSchema' must be a non-empty string."
    )
  }

  if ('scan' in raw) {
    const scan = raw.scan
    if (!Array.isArray(scan)) {
      report(['scan'], DiagnosticCode.InvalidOption, "Option 'scan' must be an array of globs.")
    } else {
      scan.forEach((glob, index) => {
        if (typeof glob !== 'string' || glob === '') {
          report(
            ['scan', index],
            DiagnosticCode.InvalidOption,
            'A scan glob must be a non-empty string.'
          )
        }
      })
    }
  }

  if ('unplanned' in raw && raw.unplanned !== 'loose' && raw.unplanned !== 'error') {
    report(
      ['unplanned'],
      DiagnosticCode.InvalidOption,
      "Option 'unplanned' must be 'loose' or 'error'."
    )
  }

  if (!('schema' in raw)) {
    report(['schema'], DiagnosticCode.MissingOption, "Option 'schema' is required.")
  } else if (!isRecord(raw.schema)) {
    report(['schema'], DiagnosticCode.InvalidOption, "Option 'schema' must be an object.")
  } else {
    const schema = raw.schema
    const source = schema.source
    if (!('source' in schema)) {
      report(['schema', 'source'], DiagnosticCode.MissingOption, "Option 'source' is required.")
    } else if (!SOURCES.includes(source as (typeof SOURCES)[number])) {
      report(
        ['schema', 'source'],
        DiagnosticCode.InvalidOption,
        `Option 'source' must be one of: ${SOURCES.join(', ')}.`
      )
    } else if (source === 'supabase-local') {
      unknownKeys(schema, ['source'], ['schema'])
    } else if (source === 'snapshot') {
      unknownKeys(schema, ['source', 'path'], ['schema'])
      requireString(schema, 'path', ['schema'])
    } else {
      unknownKeys(schema, ['source', 'dbUrlEnv', 'config'], ['schema'])
      requireString(schema, 'dbUrlEnv', ['schema'])
      if ('config' in schema) {
        const config = schema.config
        if (!isRecord(config)) {
          report(
            ['schema', 'config'],
            DiagnosticCode.InvalidOption,
            "Option 'config' must be an object of PostgREST settings."
          )
        } else {
          for (const [key, value] of Object.entries(config)) {
            if (typeof value !== 'string') {
              report(
                ['schema', 'config', key],
                DiagnosticCode.InvalidOption,
                `PostgREST setting '${key}' must be a string.`
              )
            }
          }
        }
      }
    }
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics }
  return { ok: true, options: raw as unknown as PostgrestMapperOptions, diagnostics: [] }
}
