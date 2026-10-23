import { dirname, relative, resolve, sep } from 'node:path'
import { CliError, display, messageOf } from './config'
import { addToStringArray, parseJsonc } from './jsonc'
import type { CliContext, Flags } from './types'

/** Where `init` points the project when `--out` is not given, as in the design's examples. */
const DEFAULT_OUT = 'src/supabase.types.d.ts'

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

async function edit(
  ctx: CliContext,
  path: string,
  change: (text: string) => string | undefined
): Promise<boolean> {
  const text = await ctx.fs.readFile(path)
  let next: string | undefined
  try {
    next = change(text)
  } catch (error) {
    throw new CliError(`cannot edit ${display(ctx.cwd, path)}: ${messageOf(error)}`)
  }
  if (next === undefined || next === text) return false
  await ctx.fs.writeFile(path, next)
  return true
}

/**
 * `init`: makes a project see the generated file. A tsconfig picks it up through `include` (or `files`); Deno does
 * not discover ambient files, so a `deno.json` next to the tsconfig gets it in `compilerOptions.types`. Comments and
 * formatting are kept because only the inserted text changes; a project that already sees the file is left alone.
 */
export async function runInit(ctx: CliContext, flags: Flags): Promise<number> {
  const configFileName = resolve(ctx.cwd, flags.project ?? 'tsconfig.json')
  const projectDir = dirname(configFileName)
  const out = resolve(ctx.cwd, flags.out ?? resolve(projectDir, DEFAULT_OUT))
  const rel = posix(relative(projectDir, out))
  let text: string
  try {
    text = await ctx.fs.readFile(configFileName)
  } catch (error) {
    throw new CliError(`cannot read ${display(ctx.cwd, configFileName)}: ${messageOf(error)}`)
  }
  const changed: string[] = []
  let root
  try {
    root = parseJsonc(text)
  } catch (error) {
    throw new CliError(`cannot parse ${display(ctx.cwd, configFileName)}: ${messageOf(error)}`)
  }
  if (root.kind !== 'object')
    throw new CliError(`${display(ctx.cwd, configFileName)} is not an object`)

  // without `include` and `files` the tsconfig already takes every file below it
  const key = root.properties.some((p) => p.key === 'include')
    ? 'include'
    : root.properties.some((p) => p.key === 'files')
      ? 'files'
      : undefined
  if (key !== undefined && !rel.startsWith('..')) {
    const did = await edit(ctx, configFileName, (current) =>
      addToStringArray(current, [key], rel, (existing) =>
        existing.some((entry) => entryCovers(entry, rel))
      )
    )
    if (did) changed.push(`${display(ctx.cwd, configFileName)}: added ${rel} to ${key}`)
  }

  for (const name of ['deno.json', 'deno.jsonc']) {
    const denoFile = resolve(projectDir, name)
    const exists = await ctx.fs.readFile(denoFile).then(
      () => true,
      () => false
    )
    if (!exists) continue
    const entry = rel.startsWith('..') ? rel : `./${rel}`
    const did = await edit(ctx, denoFile, (current) =>
      addToStringArray(current, ['compilerOptions', 'types'], entry)
    )
    if (did) changed.push(`${display(ctx.cwd, denoFile)}: added ${entry} to compilerOptions.types`)
    break
  }

  for (const line of changed) ctx.stdout.write(`${line}\n`)
  if (changed.length === 0) ctx.stdout.write(`${rel} is already set up\n`)
  return 0
}
