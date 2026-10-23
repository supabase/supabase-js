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
  /** Problems met while resolving (an unreadable tsconfig, an `extends` that is not relative) */
  warnings: string[]
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']
const JS_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs']

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
  allowJs: boolean
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')

async function loadConfig(
  fs: ProjectFs,
  configFileName: string,
  warnings: string[],
  seen = new Set<string>()
): Promise<ResolvedConfig> {
  const merged: ResolvedConfig = { allowJs: false }
  if (seen.has(configFileName)) return merged
  seen.add(configFileName)
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
    if (typeof parent !== 'string' || !(parent.startsWith('.') || isAbsolute(parent))) {
      warnings.push(
        `extends '${String(parent)}' of ${configFileName} is not a relative path: ignored`
      )
      continue
    }
    const target = resolve(base, parent.endsWith('.json') ? parent : `${parent}.json`)
    Object.assign(merged, await loadConfig(fs, target, warnings, seen))
  }
  if (isStringArray(config.files)) merged.files = { value: config.files, base }
  if (isStringArray(config.include)) merged.include = { value: config.include, base }
  if (isStringArray(config.exclude)) merged.exclude = { value: config.exclude, base }
  const options = config.compilerOptions
  if (options && typeof options.outDir === 'string') merged.outDir = resolve(base, options.outDir)
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
  const segments = pattern.replace(/\\/g, '/').split('/')
  const fixed: string[] = []
  for (const segment of segments) {
    if (/[*?]/.test(segment) || /\.[a-z]+$/i.test(segment)) break
    fixed.push(segment)
  }
  return resolve(base, ...fixed)
}

// ---------------------------------------------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------------------------------------------

async function walk(
  fs: ProjectFs,
  dir: string,
  isExcluded: (absolute: string) => boolean,
  visit: (file: string) => void,
  warnings: string[]
): Promise<void> {
  let entries: { name: string; isDirectory: boolean }[]
  try {
    entries = await fs.readdir(dir)
  } catch (error) {
    warnings.push(
      `could not list ${dir}: ${error instanceof Error ? error.message : String(error)}`
    )
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (isExcluded(path)) continue
    if (entry.isDirectory) await walk(fs, path, isExcluded, visit, warnings)
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
 * the TypeScript API (the mapper has no runtime dependency on it): `extends` follows relative paths only, a
 * `.d.ts` is never scanned, a JavaScript file only when `allowJs` is set (or a `scan` glob names it).
 */
export async function resolveProjectFiles(
  fs: ProjectFs,
  options: ResolveProjectFilesOptions
): Promise<ProjectFiles> {
  const warnings: string[] = []
  const config: ResolvedConfig = options.configFileName
    ? await loadConfig(fs, options.configFileName, warnings)
    : { allowJs: false }
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
    ...(config.allowJs || options.scan !== undefined ? JS_EXTENSIONS : []),
  ]
  const isSource = (file: string): boolean =>
    allowed.some((ext) => file.endsWith(ext)) && !/\.d\.[cm]?ts$/.test(file)

  const found = new Set<string>(explicit)
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
        warnings
      )
    }
  }
  return { files: [...found].sort(), warnings }
}

/** A path relative to the project, `/`-separated, for messages. */
export function displayPath(projectDir: string, file: string): string {
  const rel = relative(projectDir, file)
  return (rel.startsWith('..') ? file : rel).split(sep).join('/')
}
