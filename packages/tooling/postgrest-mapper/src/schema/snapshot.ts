import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { canonicalJson, sortKeys } from './canonical'
import { SchemaAcquisitionError, messageOf } from './errors'
import { redactConfig } from './postgrest'
import { SUPPLEMENTARY_FORMAT } from './types'
import type { AcquiredSchema, SchemaDeps, SchemaFs, Supplementary } from './types'

/** The snapshot file format (design v3 §4.2). */
export const SNAPSHOT_FORMAT = 1

/**
 * A frozen acquisition, committed next to the code so that CI needs neither Docker nor a database. It contains no
 * credentials: the config is redacted (`redactConfig`) and nothing else carries a connection string.
 */
export interface Snapshot {
  format: typeof SNAPSHOT_FORMAT
  postgrest: { release: string; commit?: string }
  pgVersionNum: number
  /** `postgrest --dump-config`, redacted */
  config: Record<string, unknown>
  supplementaryFormat: typeof SUPPLEMENTARY_FORMAT
  supplementary: Supplementary
  /** `postgrest --dump-schema`, verbatim apart from key order */
  dump: unknown
}

export const defaultFs: SchemaFs = {
  readFile: (path) => readFile(path, 'utf8'),
  writeFile: (path, data) => writeFile(path, data, 'utf8'),
  mkdir: async (path) => {
    await mkdir(path, { recursive: true })
  },
}

export function snapshotFromSchema(schema: AcquiredSchema): Snapshot {
  const snapshot: Snapshot = {
    format: SNAPSHOT_FORMAT,
    postgrest: { release: schema.postgrestVersion },
    pgVersionNum: schema.pgVersionNum,
    config: redactConfig(schema.config),
    supplementaryFormat: SUPPLEMENTARY_FORMAT,
    supplementary: schema.supplementary,
    dump: JSON.parse(schema.dump),
  }
  if (schema.postgrestCommit) snapshot.postgrest.commit = schema.postgrestCommit
  return snapshot
}

export function schemaFromSnapshot(snapshot: Snapshot): AcquiredSchema {
  const schema: AcquiredSchema = {
    dump: canonicalJson(snapshot.dump),
    config: snapshot.config,
    pgVersionNum: snapshot.pgVersionNum,
    postgrestVersion: snapshot.postgrest.release,
    supplementary: snapshot.supplementary,
  }
  if (snapshot.postgrest.commit) schema.postgrestCommit = snapshot.postgrest.commit
  return schema
}

/**
 * The exact file text: top-level keys in format order, every nested object key-sorted, two-space indent, a final
 * newline. The same data always gives the same bytes.
 */
export function serializeSnapshot(snapshot: Snapshot): string {
  const ordered = {
    format: snapshot.format,
    postgrest: sortKeys(snapshot.postgrest),
    pgVersionNum: snapshot.pgVersionNum,
    config: sortKeys(snapshot.config),
    supplementaryFormat: snapshot.supplementaryFormat,
    supplementary: sortKeys(snapshot.supplementary),
    dump: sortKeys(snapshot.dump),
  }
  return `${JSON.stringify(ordered, null, 2)}\n`
}

// ---------------------------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const SUPPLEMENTARY_ARRAYS = [
  'relations',
  'referencedRelations',
  'composites',
  'foreignKeys',
  'functions',
  'searchPathFunctions',
  'types',
  'casts',
  'aggregates',
  'implicitCasts',
  'enums',
  'jsonSchemaChecks',
] as const

/** Parses and validates snapshot text. Every problem names its location. */
export function parseSnapshot(text: string, label = 'snapshot'): Snapshot {
  const problems: string[] = []
  const bad = (path: string, expected: string) => problems.push(`${path}: expected ${expected}`)

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new SchemaAcquisitionError(
      'snapshot-invalid',
      `${label} is not valid JSON: ${messageOf(error)}`
    )
  }
  if (!isRecord(value)) {
    throw new SchemaAcquisitionError('snapshot-invalid', `${label}: expected a JSON object`)
  }
  if (value.format !== SNAPSHOT_FORMAT) {
    throw new SchemaAcquisitionError(
      'snapshot-invalid',
      `${label}: unsupported snapshot format ${JSON.stringify(value.format)} (this version reads format ${SNAPSHOT_FORMAT}); regenerate it`
    )
  }
  const postgrest = value.postgrest
  if (!isRecord(postgrest) || typeof postgrest.release !== 'string' || !postgrest.release) {
    bad('postgrest.release', 'a non-empty string')
  } else if (postgrest.commit !== undefined && typeof postgrest.commit !== 'string') {
    bad('postgrest.commit', 'a string when present')
  }
  if (!Number.isInteger(value.pgVersionNum)) bad('pgVersionNum', 'an integer such as 170004')
  if (!isRecord(value.config)) bad('config', 'an object of PostgREST config keys')
  else if (value.config['db-schemas'] === undefined) bad('config.db-schemas', 'the exposed schemas')
  if (value.supplementaryFormat !== SUPPLEMENTARY_FORMAT) {
    bad('supplementaryFormat', `${SUPPLEMENTARY_FORMAT}`)
  }
  const supplementary = value.supplementary
  if (!isRecord(supplementary)) {
    bad('supplementary', 'an object')
  } else {
    if (supplementary.format !== SUPPLEMENTARY_FORMAT)
      bad('supplementary.format', `${SUPPLEMENTARY_FORMAT}`)
    const schemas = supplementary.schemas
    if (!Array.isArray(schemas) || schemas.some((s) => typeof s !== 'string'))
      bad('supplementary.schemas', 'an array of schema names')
    for (const key of SUPPLEMENTARY_ARRAYS) {
      const list = supplementary[key]
      if (!Array.isArray(list)) bad(`supplementary.${key}`, 'an array')
      else {
        const index = list.findIndex((item) => !isRecord(item))
        if (index >= 0) bad(`supplementary.${key}[${index}]`, 'an object')
      }
    }
  }
  if (!isRecord(value.dump)) bad('dump', 'the object printed by `postgrest --dump-schema`')

  if (problems.length > 0) {
    throw new SchemaAcquisitionError(
      'snapshot-invalid',
      `${label} is invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}`
    )
  }
  return value as unknown as Snapshot
}

// ---------------------------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------------------------

async function readText(path: string, fs: SchemaFs): Promise<string> {
  try {
    return await fs.readFile(path)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    throw new SchemaAcquisitionError(
      code === 'ENOENT' ? 'snapshot-missing' : 'snapshot-io',
      code === 'ENOENT'
        ? `snapshot ${path} does not exist; create it with writeSnapshot`
        : `cannot read snapshot ${path}: ${messageOf(error)}`
    )
  }
}

/** Reads and validates a snapshot file. */
export async function readSnapshot(path: string, deps: SchemaDeps = {}): Promise<Snapshot> {
  return parseSnapshot(await readText(path, deps.fs ?? defaultFs), `snapshot ${path}`)
}

export interface WriteSnapshotResult {
  /** `false` when the file already held exactly these bytes (it is then left untouched) */
  changed: boolean
}

/** Writes the snapshot of `schema` to `path`, creating parent directories. */
export async function writeSnapshot(
  path: string,
  schema: AcquiredSchema,
  deps: SchemaDeps = {}
): Promise<WriteSnapshotResult> {
  const fs = deps.fs ?? defaultFs
  const text = serializeSnapshot(snapshotFromSchema(schema))
  const existing = await fs.readFile(path).catch(() => undefined)
  if (existing === text) return { changed: false }
  try {
    await fs.mkdir(dirname(path))
    await fs.writeFile(path, text)
  } catch (error) {
    throw new SchemaAcquisitionError(
      'snapshot-io',
      `cannot write snapshot ${path}: ${messageOf(error)}`
    )
  }
  return { changed: true }
}

/** One place where the committed snapshot and a fresh acquisition disagree. */
export interface SnapshotDifference {
  /** JSON pointer-like location, for example `/supplementary/functions/3/source` */
  path: string
  kind: 'added' | 'removed' | 'changed'
}

export type SnapshotCheck =
  | { ok: true }
  | {
      ok: false
      reason: 'missing' | 'invalid' | 'drift'
      message: string
      /** At most `MAX_DIFFERENCES`, in document order; empty unless `reason` is `drift` */
      differences: SnapshotDifference[]
    }

export const MAX_DIFFERENCES = 50

function diff(a: unknown, b: unknown, path: string, out: SnapshotDifference[]): void {
  if (out.length >= MAX_DIFFERENCES) return
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= a.length) out.push({ path: `${path}/${i}`, kind: 'added' })
      else if (i >= b.length) out.push({ path: `${path}/${i}`, kind: 'removed' })
      else diff(a[i], b[i], `${path}/${i}`, out)
    }
  } else if (isRecord(a) && isRecord(b)) {
    for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (!Object.hasOwn(a, key)) out.push({ path: `${path}/${key}`, kind: 'added' })
      else if (!Object.hasOwn(b, key)) out.push({ path: `${path}/${key}`, kind: 'removed' })
      else diff(a[key], b[key], `${path}/${key}`, out)
    }
  } else if (JSON.stringify(a) !== JSON.stringify(b)) {
    out.push({ path: path || '/', kind: 'changed' })
  }
}

/**
 * `snapshot --check`: compares the file at `path` with a fresh acquisition and reports; it never writes. `ok` means
 * the file is byte-identical to what `writeSnapshot` would write.
 */
export async function checkSnapshot(
  path: string,
  schema: AcquiredSchema,
  deps: SchemaDeps = {}
): Promise<SnapshotCheck> {
  const fs = deps.fs ?? defaultFs
  const fresh = snapshotFromSchema(schema)
  const freshText = serializeSnapshot(fresh)
  let text: string
  try {
    text = await readText(path, fs)
  } catch (error) {
    const message = messageOf(error)
    const missing = error instanceof SchemaAcquisitionError && error.code === 'snapshot-missing'
    return { ok: false, reason: missing ? 'missing' : 'invalid', message, differences: [] }
  }
  if (text === freshText) return { ok: true }
  let committed: Snapshot
  try {
    committed = parseSnapshot(text, `snapshot ${path}`)
  } catch (error) {
    return { ok: false, reason: 'invalid', message: messageOf(error), differences: [] }
  }
  const differences: SnapshotDifference[] = []
  diff(committed, fresh, '', differences)
  return {
    ok: false,
    reason: 'drift',
    message:
      differences.length > 0
        ? `snapshot ${path} is out of date: ${differences.length >= MAX_DIFFERENCES ? `${MAX_DIFFERENCES}+` : differences.length} difference(s), first at ${differences[0].path}`
        : `snapshot ${path} differs from the canonical form only in formatting`,
    differences,
  }
}
