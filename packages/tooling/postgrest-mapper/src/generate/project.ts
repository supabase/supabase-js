import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'

/** The file system the generator reads sources with. */
export interface ProjectFs {
  readFile(path: string): Promise<string>
  /** Entries of a directory; a missing directory is an error */
  readdir(path: string): Promise<{ name: string; isDirectory: boolean }[]>
}

export const nodeProjectFs: ProjectFs = {
  readFile: (path) => readFile(path, 'utf8'),
  readdir: async (path) =>
    (await readdir(path, { withFileTypes: true })).map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
    })),
}

export interface ProjectFiles {
  /** Absolute paths, sorted */
  files: string[]
  /**
   * Absolute paths, sorted: the tsconfig and every config of its `extends` chain (relative or package based, an
   * unreadable one included, so that creating it is noticed). What the files depend on besides themselves
   */
  configFiles: string[]
  /**
   * Absolute paths, sorted: every directory the scan listed, or tried to list (a root that does not exist yet
   * included). A file created in one of them, or a directory created below one, can change `files`
   */
  directories: string[]
  /**
   * Absolute paths, sorted: every directory and every script file (a file of a source or JavaScript extension, a
   * declaration included) the scan met in those directories, whether the `include` and `exclude` took it or not
   * (what is below an excluded directory was not listed). What a later listing is compared with to tell an entry
   * that appeared from one the scan already saw and left out
   */
  entries: string[]
  /** Problems met while resolving (an unreadable tsconfig, an `extends` that cannot be resolved) */
  warnings: string[]
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']
const JS_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs']
const SCRIPT_EXTENSIONS = [...SOURCE_EXTENSIONS, ...JS_EXTENSIONS]

// ---------------------------------------------------------------------------------------------------------------
// tsconfig.json (JSON with comments and trailing commas)
// ---------------------------------------------------------------------------------------------------------------

/** Removes comments and trailing commas outside strings, so `JSON.parse` takes a tsconfig. */
export function stripJsonc(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      out += text.slice(i, j + 1)
      i = j
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 1
    } else {
      out += c
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

interface TsConfig {
  files?: string[]
  include?: string[]
  exclude?: string[]
  extends?: string | string[]
  compilerOptions?: { outDir?: string; allowJs?: boolean; rootDir?: string }
}

interface ResolvedConfig {
  /** Directory the `files` / `include` / `exclude` of the final value are relative to */
  files?: { value: string[]; base: string }
  include?: { value: string[]; base: string }
  exclude?: { value: string[]; base: string }
  outDir?: string
  /** Absent until a config of the chain sets it, so a parent that says nothing never overrides an earlier one */
  allowJs?: boolean
}

/** TypeScript's template for the directory of the config being loaded; always the leaf of an `extends` chain. */
const CONFIG_DIR = '${configDir}'

/**
 * Substitutes `${configDir}` the way TypeScript 5.5+ does: a value that starts with it (any case) becomes a path
 * below `configDir`, the directory of the config being loaded (the leaf), never that of the inherited config that
 * wrote it. Any other value is returned as is.
 */
function substituteConfigDir(value: string, configDir: string): string {
  return value.slice(0, CONFIG_DIR.length).toLowerCase() === CONFIG_DIR.toLowerCase()
    ? resolve(configDir, `./${value.slice(CONFIG_DIR.length)}`)
    : value
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')

/** The files an `extends` can name, in the order TypeScript tries them: a path, or a package reached through `node_modules`. */
function extendsCandidates(base: string, specifier: string): string[] {
  const withExtension = (path: string): string => (path.endsWith('.json') ? path : `${path}.json`)
  if (specifier.startsWith('.') || isAbsolute(specifier))
    return [withExtension(resolve(base, specifier))]
  const candidates: string[] = []
  for (let dir = base; ; dir = dirname(dir)) {
    const target = join(dir, 'node_modules', specifier)
    candidates.push(withExtension(target))
    if (!specifier.endsWith('.json')) candidates.push(join(target, 'tsconfig.json'))
    if (dirname(dir) === dir) return candidates
  }
}

async function loadConfig(
  fs: ProjectFs,
  configFileName: string,
  warnings: string[],
  configs: Set<string>,
  /** The directory `${configDir}` stands for: the one of the config the chain started from */
  configDir: string,
  /** The configs being resolved right now (the recursion stack, not every config met): a repeat is a cycle */
  active = new Set<string>()
): Promise<ResolvedConfig> {
  const merged: ResolvedConfig = {}
  configs.add(configFileName)
  if (active.has(configFileName)) {
    warnings.push(`extends cycle: ${configFileName} extends itself: ignored`)
    return merged
  }
  active.add(configFileName)
  try {
    return await loadConfigBody(fs, configFileName, warnings, configs, configDir, active, merged)
  } finally {
    active.delete(configFileName)
  }
}

async function loadConfigBody(
  fs: ProjectFs,
  configFileName: string,
  warnings: string[],
  configs: Set<string>,
  configDir: string,
  active: Set<string>,
  merged: ResolvedConfig
): Promise<ResolvedConfig> {
  let config: TsConfig
  try {
    config = JSON.parse(stripJsonc(await fs.readFile(configFileName))) as TsConfig
  } catch (error) {
    warnings.push(
      `could not read ${configFileName}: ${error instanceof Error ? error.message : String(error)}`
    )
    return merged
  }
  const base = dirname(configFileName)
  const parents = typeof config.extends === 'string' ? [config.extends] : (config.extends ?? [])
  for (const parent of Array.isArray(parents) ? parents : []) {
    if (typeof parent !== 'string') {
      warnings.push(`extends '${String(parent)}' of ${configFileName} is not a path: ignored`)
      continue
    }
    const candidates = extendsCandidates(base, parent)
    let target = candidates[0]!
    if (candidates.length > 1) {
      // a package: the first candidate that exists, else the nearest one (its absence is reported by loadConfig)
      for (const candidate of candidates) {
        if (
          await fs.readFile(candidate).then(
            () => true,
            () => false
          )
        ) {
          target = candidate
          break
        }
      }
    }
    Object.assign(merged, await loadConfig(fs, target, warnings, configs, configDir, active))
  }
  const substituted = (values: string[]): string[] =>
    values.map((value) => substituteConfigDir(value, configDir))
  if (isStringArray(config.files)) merged.files = { value: substituted(config.files), base }
  if (isStringArray(config.include)) merged.include = { value: substituted(config.include), base }
  if (isStringArray(config.exclude)) merged.exclude = { value: substituted(config.exclude), base }
  const options = config.compilerOptions
  if (options && typeof options.outDir === 'string')
    merged.outDir = resolve(base, substituteConfigDir(options.outDir, configDir))
  if (options && typeof options.allowJs === 'boolean') merged.allowJs = options.allowJs
  return merged
}

// ---------------------------------------------------------------------------------------------------------------
// Globs: `**`, `*`, `?` and a directory name standing for everything below it (what tsconfig `include` means)
// ---------------------------------------------------------------------------------------------------------------

const escapeRegExp = (s: string): string => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')

/** The source of a regexp for one glob segment sequence, relative to `/`-separated paths. */
function globSource(glob: string): string {
  const segments = glob.split('/').filter((s) => s !== '' && s !== '.')
  let source = ''
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1
    if (segment === '**') {
      source += last ? '.*' : '(?:[^/]+/)*'
      return
    }
    source += segment
      .split('')
      .map((c) => (c === '*' ? '[^/]*' : c === '?' ? '[^/]' : escapeRegExp(c)))
      .join('')
    if (!last) source += '/'
  })
  return source
}

/**
 * A tsconfig-style pattern relative to `base`, as a test on absolute paths. A pattern without a wildcard and
 * extension names a directory (everything below it) or a file.
 */
function matcher(pattern: string, base: string): (absolute: string) => boolean {
  const normalised = pattern.replace(/\\/g, '/')
  const absolute = isAbsolute(normalised) ? normalised : `${base.replace(/\\/g, '/')}/${normalised}`
  const hasWildcard = /[*?]/.test(normalised)
  const lastSegment = normalised.split('/').pop() ?? ''
  const isFile = !hasWildcard && /\.[a-z]+$/i.test(lastSegment)
  const body = globSource(resolve(absolute).replace(/\\/g, '/').replace(/^\//, ''))
  const regexp = new RegExp(isFile ? `^/${body}$` : `^/${body}(?:/.*)?$`)
  return (path) => regexp.test(path.replace(/\\/g, '/'))
}

/** The directory a pattern starts in: its leading segments up to the first wildcard (or file name). */
function staticRoot(pattern: string, base: string): string {
  const normalised = pattern.replace(/\\/g, '/')
  const fixed: string[] = []
  for (const segment of normalised.split('/')) {
    if (/[*?]/.test(segment) || /\.[a-z]+$/i.test(segment)) break
    fixed.push(segment)
  }
  // an absolute pattern keeps its root: its leading empty segment must not be dropped by the join
  const joined = fixed.join('/')
  return resolve(base, joined === '' && isAbsolute(normalised) ? '/' : joined)
}

// ---------------------------------------------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------------------------------------------

async function walk(
  fs: ProjectFs,
  dir: string,
  isExcluded: (absolute: string) => boolean,
  visit: (file: string) => void,
  warnings: string[],
  directories: Set<string>,
  entries: Set<string>
): Promise<void> {
  directories.add(dir)
  let listing: { name: string; isDirectory: boolean }[]
  try {
    listing = await fs.readdir(dir)
  } catch (error) {
    warnings.push(
      `could not list ${dir}: ${error instanceof Error ? error.message : String(error)}`
    )
    return
  }
  for (const entry of listing) {
    const path = join(dir, entry.name)
    if (entry.isDirectory || SCRIPT_EXTENSIONS.some((ext) => entry.name.endsWith(ext)))
      entries.add(path)
    if (isExcluded(path)) continue
    if (entry.isDirectory) await walk(fs, path, isExcluded, visit, warnings, directories, entries)
    else visit(path)
  }
}

export interface ResolveProjectFilesOptions {
  /** Absolute path of the tsconfig, or an empty string for a project without one */
  configFileName: string
  /** Directory of a project without a tsconfig; defaults to the tsconfig's own */
  projectDir: string
  /** `options.scan`: globs relative to the project directory that replace the tsconfig's `include` / `files` */
  scan?: readonly string[]
}

/**
 * The files of a project that may hold builder chains (design v5 §4.1): the tsconfig's `files` and `include` minus
 * `exclude` (`node_modules` and `outDir` are always excluded), or `options.scan` when given. A small resolver, not
 * the TypeScript API (the mapper has no runtime dependency on it): `extends` follows relative paths and packages
 * (`node_modules`, upwards), a `.d.ts` is never scanned, a JavaScript file only when `allowJs` is set (or a `scan` glob names it).
 */
export async function resolveProjectFiles(
  fs: ProjectFs,
  options: ResolveProjectFilesOptions
): Promise<ProjectFiles> {
  const warnings: string[] = []
  const configs = new Set<string>()
  const config: ResolvedConfig = options.configFileName
    ? await loadConfig(
        fs,
        options.configFileName,
        warnings,
        configs,
        dirname(options.configFileName)
      )
    : {}
  const root = options.projectDir

  const patterns: { pattern: string; base: string }[] = []
  const explicit = new Set<string>()
  if (options.scan !== undefined) {
    for (const pattern of options.scan) patterns.push({ pattern, base: root })
  } else {
    for (const file of config.files?.value ?? []) explicit.add(resolve(config.files!.base, file))
    if (config.include)
      for (const p of config.include.value) patterns.push({ pattern: p, base: config.include.base })
    else if (!config.files) patterns.push({ pattern: '**/*', base: root })
  }
  const includes = patterns.map((p) => matcher(p.pattern, p.base))

  const excludeBase = config.exclude?.base ?? root
  const excludes = (config.exclude?.value ?? []).map((p) => matcher(p, excludeBase))
  if (options.scan === undefined && config.outDir) excludes.push(matcher('.', config.outDir))
  const isExcluded = (absolute: string): boolean =>
    absolute.split(sep).includes('node_modules') || excludes.some((m) => m(absolute))

  const allowed = [
    ...SOURCE_EXTENSIONS,
    ...(config.allowJs === true || options.scan !== undefined ? JS_EXTENSIONS : []),
  ]
  const isSource = (file: string): boolean =>
    allowed.some((ext) => file.endsWith(ext)) && !/\.d\.[cm]?ts$/.test(file)

  const found = new Set<string>(explicit)
  const directories = new Set<string>()
  const entries = new Set<string>()
  if (includes.length > 0) {
    // walk from the directories the patterns can reach: the bases, pruned by the excludes
    const bases = new Set(patterns.map((p) => staticRoot(p.pattern, p.base)))
    for (const base of bases) {
      await walk(
        fs,
        base,
        isExcluded,
        (file) => {
          if (isSource(file) && includes.some((m) => m(file))) found.add(file)
        },
        warnings,
        directories,
        entries
      )
    }
  }
  return {
    files: [...found].sort(),
    configFiles: [...configs].sort(),
    directories: [...directories].sort(),
    entries: [...entries].sort(),
    warnings,
  }
}

/** A path relative to the project, `/`-separated, for messages. */
export function displayPath(projectDir: string, file: string): string {
  const rel = relative(projectDir, file)
  return (rel.startsWith('..') ? file : rel).split(sep).join('/')
}

/** The nearest directory upwards from `startDir` that holds `supabase/config.toml`, or `undefined`. */
export async function findSupabaseConfigDir(
  fs: Pick<ProjectFs, 'readFile'>,
  startDir: string
): Promise<string | undefined> {
  for (let dir = startDir; ; dir = dirname(dir)) {
    try {
      await fs.readFile(join(dir, 'supabase', 'config.toml'))
      return dir
    } catch {
      // keep climbing
    }
    if (dirname(dir) === dir) return undefined
  }
}
