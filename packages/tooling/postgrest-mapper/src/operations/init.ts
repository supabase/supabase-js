import { dirname, join, posix as posixPath, relative, resolve, sep } from 'node:path'
import { createPlannerHost } from '../host'
import { findSupabaseConfigDir, loadFileSets, stripJsonc } from '../generate'
import { INDEX_EXTENSION, display, isIndexEntry, messageOf } from './config'
import { write } from './generate'
import { addToArray, addToObject, addToStringArray, parseJsonc } from './jsonc'
import { snapshot } from './snapshot'
import { OperationError, resolveDeps, type OperationDeps, type ResolvedDeps } from './types'

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
  /** Take a snapshot of the live schema into `supabase/postgrest-schema.json` when the source is `supabase-local`. Defaults to true */
  snapshot?: boolean
  /** Write the declaration file once the project is configured. Defaults to true */
  generate?: boolean
  /** Add the `postgrest:*` scripts to the nearest package.json. Defaults to true */
  scripts?: boolean
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
  /** The snapshot step; undefined when it did not apply (no live source) or was switched off. `skipped`: the stack could not be read */
  snapshot?: {
    /** Absolute path */
    file: string
    status: 'written' | 'unchanged' | 'skipped'
    reason?: string
  }
  /** The generate step; undefined when switched off. `skipped`: no schema could be acquired, or the project reported diagnostics */
  generate?: { status: 'written' | 'unchanged' | 'skipped'; reason?: string }
  /** The scripts step; undefined when switched off. Without a package.json `packageJson` is unset and `reason` says why */
  scripts?: {
    /** Script names `init` inserted */
    added: string[]
    /** Script names that were there already, and were left as they are */
    existing: string[]
    /** Absolute path of the package.json the scripts live in */
    packageJson?: string
    /** Whether that package.json lists `@supabase/postgrest-mapper`, which the scripts' `postgrest-mapper` binary comes from */
    installed?: boolean
    reason?: string
  }
  /** Empty when the project was already set up */
  changes: InitChange[]
}

const posix = (path: string): string => path.split(sep).join('/')

// TypeScript's own wildcard semantics for `include` (`getSubPatternFromSpec`, `usage: 'files'` in its `utilities.ts`):
// `*` matches within a segment (not a leading dot, not a `.min.js` ending), `?` one character, `**` any directories
// (not dot-directories or package folders), a last segment without `.`, `*` or `?` is a directory (`/**/*`), and a
// wildcard segment never matches `node_modules`, `bower_components` or `jspm_packages`. The pattern is anchored at the
// tsconfig directory, so an entry covers a file exactly when TypeScript's file matcher would take it.
const RESERVED = /[^\w\s/]/g
const NOT_A_PACKAGE_FOLDER = '(?!(node_modules|bower_components|jspm_packages)(/|$))'
const SINGLE_ASTERISK = '([^./]|(\\.(?!min\\.js$))?)*'
const DOUBLE_ASTERISK = `(/${NOT_A_PACKAGE_FOLDER}[^/.][^/]*)*?`
const wildcard = (match: string): string =>
  match === '*' ? SINGLE_ASTERISK : match === '?' ? '[^/]' : `\\${match}`

function includePattern(entry: string): RegExp | undefined {
  // absolute under a fake root, so `..` and `.` segments collapse the way TypeScript's normalisation does
  const components = ['', ...posixPath.resolve('/root', entry).split('/').filter(Boolean)]
  const lastComponent = components[components.length - 1]!
  if (lastComponent === '**') return undefined // TypeScript matches nothing for a trailing `**`
  if (!/[.*?]/.test(lastComponent)) components.push('**', '*')
  let pattern = ''
  let written = false
  for (let component of components) {
    if (component === '**') {
      pattern += DOUBLE_ASTERISK
    } else {
      if (written) pattern += '/'
      let part = ''
      if (component.startsWith('*')) {
        part += `([^./]${SINGLE_ASTERISK})?`
        component = component.slice(1)
      } else if (component.startsWith('?')) {
        part += '[^./]'
        component = component.slice(1)
      }
      part += component.replace(RESERVED, wildcard)
      if (part !== component) pattern += NOT_A_PACKAGE_FOLDER
      pattern += part
    }
    written = true
  }
  return new RegExp(`^(${pattern})$`)
}

/** Does a tsconfig `include` / `files` entry already cover `file` (relative to the tsconfig, `/`-separated)? */
export function entryCovers(entry: string, file: string): boolean {
  return includePattern(entry)?.test(posixPath.resolve('/root', file)) ?? false
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
  const base: ResolvedDeps = { ...rest, fs, cwd }
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
  const existingEntry = Array.isArray(contentMappers)
    ? contentMappers.find(isIndexEntry)
    : undefined
  const hasEntry = existingEntry !== undefined
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

  // without `include` and `files` the tsconfig already takes every file below it, unless it inherits some: a local
  // `include` (or `files`) replaces the inherited one, so the inherited entries are carried over, rebased to this tsconfig
  const own = root.properties.some((p) => p.key === 'include')
    ? 'include'
    : root.properties.some((p) => p.key === 'files')
      ? 'files'
      : undefined
  let key: 'include' | 'files' | undefined = own
  let inherited: string[] = []
  let inheritedAll: string[] = []
  if (own === undefined) {
    const sets = await loadFileSets(fs, configFileName)
    const rebase = (set?: { value: string[]; base: string }): string[] =>
      (set?.value ?? []).map(
        (entry) => posix(relative(projectDir, resolve(set!.base, entry))) || '.'
      )
    inheritedAll = [...rebase(sets.include), ...rebase(sets.files)]
    key = sets.include ? 'include' : sets.files ? 'files' : undefined
    inherited = rebase(key === 'files' ? sets.files : sets.include)
  }
  const include = async (rel: string): Promise<void> => {
    if (key === undefined || rel.startsWith('..')) return
    if (inheritedAll.some((item) => entryCovers(item, rel))) return
    await edit(configFileName, `added ${rel} to ${key}`, (current) => {
      let next = current
      for (const value of [...inherited, rel]) {
        next =
          addToStringArray(next, [key!], value, (existing) =>
            existing.some((item) => item === value || entryCovers(item, value))
          ) ?? next
      }
      return next
    })
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

  // the declarations are generated from the schema the entry names; a live source is also saved as a snapshot, which
  // is what CI reads
  const source =
    schemaSource ??
    (existingEntry as { options?: { schema?: { source?: unknown } } } | undefined)?.options?.schema
      ?.source
  const live = source === 'supabase-local'
  const workdir = live ? ((await findSupabaseConfigDir(fs, projectDir)) ?? projectDir) : undefined
  const snapshotFile = resolve(projectDir, DEFAULT_SNAPSHOT)
  const exists = (file: string): Promise<boolean> =>
    fs.readFile(file).then(
      () => true,
      () => false
    )

  let snapshotStep: InitResult['snapshot']
  if (workdir !== undefined && input.snapshot !== false) {
    const existed = await exists(snapshotFile)
    try {
      const result = await snapshot(base, { out: snapshotFile, workdir })
      const status = result.status === 'written' ? 'written' : 'unchanged'
      if (status === 'written') {
        const action = existed ? 'edited' : 'created'
        changes.push({ file: snapshotFile, action, message: 'wrote the schema snapshot' })
      }
      snapshotStep = { file: snapshotFile, status }
    } catch (error) {
      snapshotStep = { file: snapshotFile, status: 'skipped', reason: firstLine(messageOf(error)) }
    }
  }

  let generateStep: InitResult['generate']
  if (input.generate !== false) {
    const existed = await exists(out)
    try {
      const result = await write(base, { project: configFileName, out })
      if (!result.ok) {
        generateStep = { status: 'skipped', reason: diagnosticsReason(result.diagnostics) }
      } else {
        if (result.changed) {
          const action = existed ? 'edited' : 'created'
          changes.push({ file: out, action, message: 'generated the declarations' })
        }
        generateStep = { status: result.changed ? 'written' : 'unchanged' }
      }
    } catch (error) {
      generateStep = { status: 'skipped', reason: firstLine(messageOf(error)) }
    }
  }

  const scriptsStep =
    input.scripts === false
      ? undefined
      : await addScripts(fs, changes, {
          configFileName,
          out,
          snapshotFile,
          workdir,
          shown,
        })

  return {
    configFileName,
    out,
    index,
    ...(schemaSource ? { schemaSource } : {}),
    ...(snapshotStep ? { snapshot: snapshotStep } : {}),
    ...(generateStep ? { generate: generateStep } : {}),
    ...(scriptsStep ? { scripts: scriptsStep } : {}),
    changes,
  }
}

const firstLine = (message: string): string => message.trim().split('\n')[0]!.trim()

function diagnosticsReason(diagnostics: { message: string }[]): string {
  const [first, ...more] = diagnostics
  if (!first) return 'the project reported a problem'
  return `${firstLine(first.message)}${more.length > 0 ? ` (and ${more.length} more)` : ''}`
}

/** A path as a shell word: left alone unless it holds a character the shell would read. */
const word = (path: string): string => (/^[\w@%+=:,./-]+$/.test(path) ? path : JSON.stringify(path))

/** The nearest package.json at or above `startDir`, with its text. */
async function findPackageJson(
  fs: ResolvedDeps['fs'],
  startDir: string
): Promise<{ file: string; text: string } | undefined> {
  for (let dir = startDir; ; dir = dirname(dir)) {
    const file = join(dir, 'package.json')
    try {
      return { file, text: await fs.readFile(file) }
    } catch {
      // keep climbing
    }
    if (dirname(dir) === dir) return undefined
  }
}

/**
 * Adds the `postgrest:*` scripts that are missing to the nearest package.json (existing ones stay as they are), with
 * paths relative to that package.json. The check script of a live source reads the snapshot, so CI needs no database.
 */
async function addScripts(
  fs: ResolvedDeps['fs'],
  changes: InitChange[],
  project: {
    configFileName: string
    out: string
    snapshotFile: string
    workdir: string | undefined
    shown: (path: string) => string
  }
): Promise<NonNullable<InitResult['scripts']>> {
  const found = await findPackageJson(fs, dirname(project.configFileName))
  if (!found) {
    return {
      added: [],
      existing: [],
      reason: 'no package.json found at or above the project',
    }
  }
  const packageDir = dirname(found.file)
  const rel = (path: string): string => word(posix(relative(packageDir, path)) || '.')
  const generateCommand = `postgrest-mapper generate${
    resolve(packageDir, 'tsconfig.json') === project.configFileName
      ? ''
      : ` --project ${rel(project.configFileName)}`
  } --out ${rel(project.out)}`
  const scripts: [string, string][] = [
    ['postgrest:watch', `${generateCommand} --watch`],
    [
      'postgrest:check',
      `${generateCommand} --check${
        project.workdir !== undefined ? ` --snapshot ${rel(project.snapshotFile)}` : ''
      }`,
    ],
  ]
  if (project.workdir !== undefined) {
    scripts.push([
      'postgrest:snapshot',
      `postgrest-mapper snapshot --out ${rel(project.snapshotFile)}${
        project.workdir === packageDir ? '' : ` --workdir ${rel(project.workdir)}`
      }`,
    ])
  }
  const added: string[] = []
  const existing: string[] = []
  let text = found.text
  try {
    for (const [name, command] of scripts) {
      const next = addToObject(text, 'scripts', name, command)
      if (next === undefined) existing.push(name)
      else {
        text = next
        added.push(name)
      }
    }
    const manifest = JSON.parse(stripJsonc(text)) as Record<string, unknown>
    const installed = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]
      .map((field) => manifest[field])
      .some(
        (deps) => typeof deps === 'object' && deps !== null && '@supabase/postgrest-mapper' in deps
      )
    if (text !== found.text) {
      await fs.writeFile(found.file, text)
      changes.push({
        file: found.file,
        action: 'edited',
        message: `added the ${added.join(', ')} script${added.length > 1 ? 's' : ''}`,
      })
    }
    return { added, existing, packageJson: found.file, installed }
  } catch (error) {
    return {
      added: [],
      existing: [],
      reason: `cannot edit ${project.shown(found.file)}: ${messageOf(error)}`,
    }
  }
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
