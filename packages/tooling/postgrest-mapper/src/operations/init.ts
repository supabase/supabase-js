import { dirname, relative, resolve, sep } from 'node:path'
import { createPlannerHost } from '../host'
import { findSupabaseConfigDir, stripJsonc } from '../generate'
import { INDEX_EXTENSION, display, isIndexEntry, messageOf } from './config'
import { addToArray, addToStringArray, parseJsonc } from './jsonc'
import { OperationError, resolveDeps, type OperationDeps } from './types'

/** Where `init` points the project when `out` is not given, as in the design's examples. */
export const DEFAULT_OUT = 'src/supabase.types.d.ts'
/** The index file `init` creates, relative to the tsconfig. */
export const DEFAULT_INDEX = 'src/supabase.pgrst-index'
/** The snapshot a project without a local Supabase stack reads, relative to the tsconfig. */
export const DEFAULT_SNAPSHOT = 'supabase/postgrest-schema.json'

const INDEX_STUB = `// postgrest-mapper index file: its content is ignored. Its extension (${INDEX_EXTENSION}) makes TypeScript run the
// content mapper configured in tsconfig.json, which scans this project and types its PostgREST calls.
`

export interface InitInput {
  /** The tsconfig, absolute or relative to `cwd`. Defaults to `tsconfig.json` */
  project?: string
  /** The declaration file `generate` writes. Defaults to `src/supabase.types.d.ts` next to the tsconfig */
  out?: string
}

export interface InitChange {
  /** Absolute path */
  file: string
  action: 'created' | 'edited'
  /** What changed, for example `added src/supabase.types.d.ts to include` */
  message: string
}

export interface InitResult {
  /** Absolute path of the tsconfig */
  configFileName: string
  /** Absolute path of the declaration file the project now includes */
  out: string
  /** Absolute path of the index file (created only when the `contentMappers` entry was added) */
  index: string
  /** The schema source of the entry `init` added; undefined when the tsconfig already had one */
  schemaSource?: 'supabase-local' | 'snapshot'
  /** Empty when the project was already set up */
  changes: InitChange[]
}

const posix = (path: string): string => path.split(sep).join('/')

/** Does a tsconfig `include` / `files` entry already cover `file` (relative to the tsconfig, `/`-separated)? */
export function entryCovers(entry: string, file: string): boolean {
  const normal = entry.replace(/^\.\//, '').replace(/\/$/, '')
  if (normal === file) return true
  if (!/[*?]/.test(normal)) return file.startsWith(`${normal}/`) // a directory
  const segments = normal.split('/')
  let recursive = false
  while (segments.length > 0 && /[*?]/.test(segments[segments.length - 1]!)) {
    if (segments.pop() === '**') recursive = true
  }
  const base = segments.join('/')
  if (recursive) return base === '' || file.startsWith(`${base}/`)
  return base === '' ? !file.includes('/') : dirname(file) === base
}

/**
 * Sets a project up for the mapper (design v5 §3): the `contentMappers` entry for `.pgrst-index` (schema source
 * `supabase-local` when a `supabase/config.toml` is found at or above the project, a snapshot at
 * `supabase/postgrest-schema.json` otherwise), the stub index file, and the generated declaration file in the
 * tsconfig's `include` (or `files`); next to a `deno.json` it also goes to `compilerOptions.types`, because Deno
 * does not discover ambient files. Comments and formatting are kept: only inserted text changes. Idempotent: a
 * project that is set up gets no change. Throws `OperationError` when a file cannot be read or edited, or when the
 * planner cannot say which PostgREST line the entry should name.
 */
export async function init(deps: OperationDeps, input: InitInput = {}): Promise<InitResult> {
  const { fs, cwd, ...rest } = resolveDeps(deps)
  const configFileName = resolve(cwd, input.project ?? 'tsconfig.json')
  const projectDir = dirname(configFileName)
  const shown = (path: string): string => display(cwd, path)
  const out = resolve(cwd, input.out ?? resolve(projectDir, DEFAULT_OUT))
  const index = resolve(projectDir, DEFAULT_INDEX)
  const outRel = posix(relative(projectDir, out))
  const indexRel = posix(relative(projectDir, index))

  let text: string
  try {
    text = await fs.readFile(configFileName)
  } catch (error) {
    throw new OperationError(
      'config-unreadable',
      `cannot read ${shown(configFileName)}: ${messageOf(error)}`
    )
  }
  let root
  try {
    root = parseJsonc(text)
  } catch (error) {
    throw new OperationError(
      'config-invalid',
      `cannot parse ${shown(configFileName)}: ${messageOf(error)}`
    )
  }
  if (root.kind !== 'object') {
    throw new OperationError('config-invalid', `${shown(configFileName)} is not an object`)
  }

  const changes: InitChange[] = []
  const edit = async (
    path: string,
    message: string,
    change: (current: string) => string | undefined
  ): Promise<void> => {
    const current = await fs.readFile(path)
    let next: string | undefined
    try {
      next = change(current)
    } catch (error) {
      throw new OperationError('edit-failed', `cannot edit ${shown(path)}: ${messageOf(error)}`)
    }
    if (next === undefined || next === current) return
    await fs.writeFile(path, next)
    changes.push({ file: path, action: 'edited', message })
  }

  // the planner is asked before anything is written, and only when an entry has to be added
  const { contentMappers } = JSON.parse(stripJsonc(text)) as { contentMappers?: unknown }
  const hasEntry = Array.isArray(contentMappers) && contentMappers.some(isIndexEntry)
  let schemaSource: InitResult['schemaSource']
  let entry: unknown
  if (!hasEntry) {
    const line = await plannerLine({ ...rest, fs, cwd })
    schemaSource = (await findSupabaseConfigDir(fs, projectDir)) ? 'supabase-local' : 'snapshot'
    entry = {
      package: '@supabase/postgrest-mapper',
      extensions: [INDEX_EXTENSION],
      options: {
        postgrest: line,
        schema:
          schemaSource === 'supabase-local'
            ? { source: 'supabase-local' }
            : { source: 'snapshot', path: DEFAULT_SNAPSHOT },
      },
    }
  }

  // without `include` and `files` the tsconfig already takes every file below it
  const key = root.properties.some((p) => p.key === 'include')
    ? 'include'
    : root.properties.some((p) => p.key === 'files')
      ? 'files'
      : undefined
  const include = async (rel: string): Promise<void> => {
    if (key === undefined || rel.startsWith('..')) return
    await edit(configFileName, `added ${rel} to ${key}`, (current) =>
      addToStringArray(current, [key], rel, (existing) =>
        existing.some((item) => entryCovers(item, rel))
      )
    )
  }

  if (entry !== undefined) {
    await edit(configFileName, `added the ${INDEX_EXTENSION} entry to contentMappers`, (current) =>
      addToArray(current, ['contentMappers'], entry, () => false)
    )
    const exists = await fs.readFile(index).then(
      () => true,
      () => false
    )
    if (!exists) {
      await fs.mkdir(dirname(index))
      await fs.writeFile(index, INDEX_STUB)
      changes.push({ file: index, action: 'created', message: 'created the index file' })
    }
    await include(indexRel)
  }
  await include(outRel)

  for (const name of ['deno.json', 'deno.jsonc']) {
    const denoFile = resolve(projectDir, name)
    const exists = await fs.readFile(denoFile).then(
      () => true,
      () => false
    )
    if (!exists) continue
    const typesEntry = outRel.startsWith('..') ? outRel : `./${outRel}`
    await edit(denoFile, `added ${typesEntry} to compilerOptions.types`, (current) =>
      addToStringArray(current, ['compilerOptions', 'types'], typesEntry)
    )
    break
  }

  return { configFileName, out, index, ...(schemaSource ? { schemaSource } : {}), changes }
}

/** `16.4` for a planner that models PostgREST 16.4.x: the `postgrest` option names a line. */
async function plannerLine(deps: OperationDeps): Promise<string> {
  const host =
    deps.createHost?.() ?? createPlannerHost(deps.wasmPath ? { wasmPath: deps.wasmPath } : {})
  try {
    const info = await host.info()
    if (!info.ok) {
      throw new OperationError(
        'planner-unavailable',
        `the planner could not start: ${`${info.error.code ?? ''} ${info.error.message ?? ''}`.trim()}`
      )
    }
    return info.postgrest.version.split('.').slice(0, 2).join('.')
  } finally {
    await host.close()
  }
}
