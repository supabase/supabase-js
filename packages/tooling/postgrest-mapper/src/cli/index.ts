/**
 * The `postgrest-mapper` command line (design v5 §7.2). It parses arguments, builds the injected dependencies and
 * calls the library; every decision about what is generated lives in `../generate` and `../schema`.
 */
import { rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { DEBUG_ENV } from '../content-mapper'
import {
  cacheDirectoryOf,
  generateDeclarations,
  nodeGeneratorFs,
  type GeneratorLogger,
} from '../generate'
import {
  SchemaAcquisitionError,
  acquireSchema,
  checkSnapshot,
  writeSnapshot,
  type SchemaSource,
} from '../schema'
import {
  CliError,
  display,
  formatOptionDiagnostic,
  messageOf,
  projectDirOf,
  readMapperConfig,
} from './config'
import { runInit } from './init'
import type { CliContext, CliFs, CliOptions, Flags } from './types'
import { USAGE } from './usage'
import { nodeMtime, nodeWatch, watchLoop } from './watch'

export type {
  CliContext,
  CliFs,
  CliOptions,
  CliOutput,
  Flags as CliFlags,
  MtimeFn,
  WatchFn,
  WatchHandle,
} from './types'
export { USAGE } from './usage'
export { addToStringArray, parseJsonc } from './jsonc'

export const nodeCliFs: CliFs = {
  ...nodeGeneratorFs,
  rm: (path) => rm(path, { recursive: true, force: true }),
}

const COMMANDS = {
  generate: ['project', 'out', 'check', 'watch', 'schema-source', 'snapshot', 'db-url-env'],
  print: ['project', 'schema-source', 'snapshot', 'db-url-env'],
  refresh: ['project', 'out', 'schema-source', 'snapshot', 'db-url-env'],
  init: ['project', 'out'],
  snapshot: [
    'out',
    'check',
    'schema-source',
    'db-url-env',
    'workdir',
    'project-id',
    'supabase-command',
    'image',
    'network',
  ],
} as const
type Command = keyof typeof COMMANDS

class UsageError extends Error {}

const SOURCES = ['supabase-local', 'postgrest', 'snapshot']

function parseFlags(argv: string[]): {
  command?: Command
  flags: Flags
  help: boolean
  version: boolean
} {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        project: { type: 'string' },
        out: { type: 'string' },
        check: { type: 'boolean' },
        watch: { type: 'boolean' },
        'schema-source': { type: 'string' },
        snapshot: { type: 'string' },
        'db-url-env': { type: 'string' },
        workdir: { type: 'string' },
        'project-id': { type: 'string' },
        'supabase-command': { type: 'string' },
        image: { type: 'string' },
        network: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    })
  } catch (error) {
    throw new UsageError(messageOf(error))
  }
  const { values, positionals } = parsed
  const help = values.help === true
  const version = values.version === true
  if (help || version) return { flags: { check: false, watch: false }, help, version }
  const [name, ...extra] = positionals
  if (name === undefined) throw new UsageError('missing command')
  if (!Object.hasOwn(COMMANDS, name)) throw new UsageError(`unknown command '${name}'`)
  if (extra.length > 0) throw new UsageError(`unexpected argument '${extra[0]}'`)
  const command = name as Command
  const allowed: readonly string[] = COMMANDS[command]
  for (const key of Object.keys(values)) {
    if (!allowed.includes(key)) throw new UsageError(`unknown option '--${key}' for '${command}'`)
  }
  const source = values['schema-source']
  if (source !== undefined && !SOURCES.includes(source)) {
    throw new UsageError(`--schema-source must be one of: ${SOURCES.join(', ')}`)
  }
  if (command === 'snapshot' && source === 'snapshot') {
    throw new UsageError("'snapshot' reads from supabase-local or postgrest")
  }
  const flags: Flags = { check: values.check === true, watch: values.watch === true }
  const set = <K extends keyof Flags>(key: K, value: Flags[K] | undefined): void => {
    if (value !== undefined) flags[key] = value
  }
  set('project', values.project)
  set('out', values.out)
  set('schemaSource', source as Flags['schemaSource'])
  set('snapshot', values.snapshot)
  set('dbUrlEnv', values['db-url-env'])
  set('workdir', values.workdir)
  set('projectId', values['project-id'])
  set('supabaseCommand', values['supabase-command'])
  set('image', values.image)
  set('network', values.network)
  if ((command === 'generate' || command === 'snapshot') && flags.out === undefined) {
    throw new UsageError(`'${command}' needs --out`)
  }
  if (flags.check && flags.watch) throw new UsageError('--check and --watch cannot be combined')
  return { command, flags, help, version }
}

interface Generated {
  ok: boolean
  text: string
  /** Files the result depends on, absolute */
  watchedFiles: readonly string[]
  configFileName: string
}

/** One run of the library's generate pipeline; prints every diagnostic as `file:line:col code message`. */
async function generate(ctx: CliContext, flags: Flags): Promise<Generated> {
  const config = await readMapperConfig(ctx, flags)
  const logger: GeneratorLogger = {
    debug: (message) => {
      if (ctx.env[DEBUG_ENV]) ctx.stderr.write(`debug: ${message}\n`)
    },
    warn: (message) => ctx.stderr.write(`warning: ${message}\n`),
  }
  const result = await generateDeclarations({
    configFileName: config.configFileName,
    options: config.options,
    deps: { ...ctx.deps, fs: ctx.fs, env: ctx.env, cwd: ctx.cwd, logger },
  })
  const file = display(ctx.cwd, config.configFileName)
  for (const diagnostic of result.optionDiagnostics) {
    ctx.stderr.write(`${formatOptionDiagnostic(ctx, config, diagnostic)}\n`)
  }
  for (const diagnostic of result.diagnostics) {
    ctx.stderr.write(`${file}:1:1 ${diagnostic.code} ${diagnostic.messageText}\n`)
  }
  return {
    ok: result.optionDiagnostics.length === 0 && result.diagnostics.length === 0,
    text: result.text,
    watchedFiles: [...result.watchedFiles, config.configFileName],
    configFileName: config.configFileName,
  }
}

const MAX_SHOWN = 5

/** A short summary of how `current` differs from `next`: the first differing lines. */
function summarizeDrift(current: string, next: string): string[] {
  const a = current.split('\n')
  const b = next.split('\n')
  const lines: string[] = []
  let differing = 0
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue
    differing++
    if (differing > MAX_SHOWN) continue
    if (a[i] !== undefined) lines.push(`  ${i + 1}: - ${a[i]}`)
    if (b[i] !== undefined) lines.push(`  ${i + 1}: + ${b[i]}`)
  }
  if (differing > MAX_SHOWN) lines.push(`  ... and ${differing - MAX_SHOWN} more differing line(s)`)
  return lines
}

async function writeIfChanged(ctx: CliContext, path: string, text: string): Promise<boolean> {
  const existing = await ctx.fs.readFile(path).catch(() => undefined)
  if (existing === text) return false
  await ctx.fs.mkdir(dirname(path))
  await ctx.fs.writeFile(path, text)
  return true
}

async function runGenerate(ctx: CliContext, flags: Flags): Promise<number> {
  const out = resolve(ctx.cwd, flags.out!)
  const shown = display(ctx.cwd, out)
  const once = async (): Promise<{ code: number; watched: readonly string[] }> => {
    const generated = await generate(ctx, flags)
    if (!generated.ok) return { code: 1, watched: generated.watchedFiles }
    if (flags.check) {
      const existing = await ctx.fs.readFile(out).catch(() => undefined)
      if (existing === generated.text) {
        ctx.stdout.write(`${shown} is up to date\n`)
        return { code: 0, watched: generated.watchedFiles }
      }
      ctx.stderr.write(
        existing === undefined
          ? `${shown} does not exist; run 'postgrest-mapper generate' to create it\n`
          : `${shown} is out of date; run 'postgrest-mapper generate' to update it\n${summarizeDrift(existing, generated.text).join('\n')}\n`
      )
      return { code: 1, watched: generated.watchedFiles }
    }
    const changed = await writeIfChanged(ctx, out, generated.text)
    ctx.stdout.write(changed ? `wrote ${shown}\n` : `${shown} is up to date\n`)
    return { code: 0, watched: generated.watchedFiles }
  }
  if (!flags.watch) return (await once()).code

  await watchLoop({
    watch: ctx.watch,
    mtime: ctx.mtime,
    debounceMs: ctx.debounceMs,
    ...(ctx.signal ? { signal: ctx.signal } : {}),
    ignore: out,
    run: async () => {
      try {
        return (await once()).watched
      } catch (error) {
        // a broken tsconfig must not end the watch: report it and wait for the fix
        ctx.stderr.write(`error: ${messageOf(error)}\n`)
        return [resolve(ctx.cwd, flags.project ?? 'tsconfig.json')]
      }
    },
  })
  return 0
}

async function runPrint(ctx: CliContext, flags: Flags): Promise<number> {
  const generated = await generate(ctx, flags)
  if (!generated.ok) return 1
  ctx.stdout.write(generated.text)
  return 0
}

async function runRefresh(ctx: CliContext, flags: Flags): Promise<number> {
  const config = await readMapperConfig(ctx, flags)
  const directory = cacheDirectoryOf(projectDirOf(config))
  await ctx.fs.rm(directory)
  ctx.stdout.write(`cleared ${display(ctx.cwd, directory)}\n`)
  const generated = await generate(ctx, flags)
  if (!generated.ok) return 1
  if (flags.out !== undefined) {
    const out = resolve(ctx.cwd, flags.out)
    const changed = await writeIfChanged(ctx, out, generated.text)
    ctx.stdout.write(
      changed ? `wrote ${display(ctx.cwd, out)}\n` : `${display(ctx.cwd, out)} is up to date\n`
    )
  }
  return 0
}

function snapshotSource(ctx: CliContext, flags: Flags): SchemaSource {
  const dbUrl = flags.dbUrlEnv !== undefined ? ctx.env[flags.dbUrlEnv] : undefined
  if (flags.dbUrlEnv !== undefined && !dbUrl) {
    throw new CliError(`the environment variable '${flags.dbUrlEnv}' is not set`)
  }
  if (flags.schemaSource === 'postgrest') {
    if (!dbUrl) throw new CliError('the postgrest source needs --db-url-env <NAME>')
    return {
      source: 'postgrest',
      dbUrl,
      ...(flags.image ? { image: flags.image } : {}),
      ...(flags.network ? { network: flags.network } : {}),
    }
  }
  return {
    source: 'supabase-local',
    workdir: resolve(ctx.cwd, flags.workdir ?? '.'),
    ...(flags.projectId ? { projectId: flags.projectId } : {}),
    ...(flags.supabaseCommand
      ? { supabaseCommand: flags.supabaseCommand.split(/\s+/).filter(Boolean) }
      : {}),
    ...(dbUrl ? { dbUrl } : {}),
  }
}

async function runSnapshot(ctx: CliContext, flags: Flags): Promise<number> {
  const out = resolve(ctx.cwd, flags.out!)
  const shown = display(ctx.cwd, out)
  const schemaDeps = {
    ...ctx.deps.schema,
    fs: ctx.fs,
    logger: {
      debug: (message: string) => {
        if (ctx.env[DEBUG_ENV]) ctx.stderr.write(`debug: ${message}\n`)
      },
      info: (message: string) => ctx.stderr.write(`${message}\n`),
      warn: (message: string) => ctx.stderr.write(`warning: ${message}\n`),
    },
  }
  const acquired = await acquireSchema(snapshotSource(ctx, flags), schemaDeps)
  if (flags.check) {
    const check = await checkSnapshot(out, acquired, schemaDeps)
    if (check.ok) {
      ctx.stdout.write(`${shown} is up to date\n`)
      return 0
    }
    ctx.stderr.write(`${check.message}\n`)
    for (const difference of check.differences.slice(0, 10)) {
      ctx.stderr.write(`  ${difference.kind} ${difference.path}\n`)
    }
    if (check.differences.length > 10) {
      ctx.stderr.write(`  ... and ${check.differences.length - 10} more\n`)
    }
    return 1
  }
  const { changed } = await writeSnapshot(out, acquired, schemaDeps)
  ctx.stdout.write(changed ? `wrote ${shown}\n` : `${shown} is up to date\n`)
  return 0
}

/**
 * Runs the command line and resolves to the exit code: 0 success, 1 failure, 2 usage error. Nothing is read from
 * `process`: arguments, streams, file system, environment and working directory are parameters.
 */
export async function runCli(argv: string[], options: CliOptions): Promise<number> {
  const ctx: CliContext = {
    stdout: options.stdout,
    stderr: options.stderr,
    fs: options.fs ?? nodeCliFs,
    env: options.env ?? process.env,
    cwd: options.cwd ?? process.cwd(),
    deps: options.deps ?? {},
    ...(options.signal ? { signal: options.signal } : {}),
    watch: options.watch ?? nodeWatch,
    mtime: options.mtime ?? nodeMtime,
    debounceMs: options.debounceMs ?? 100,
  }
  let parsed: ReturnType<typeof parseFlags>
  try {
    parsed = parseFlags(argv)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    ctx.stderr.write(`error: ${error.message}\n\n${USAGE}`)
    return 2
  }
  if (parsed.help) {
    ctx.stdout.write(USAGE)
    return 0
  }
  if (parsed.version) {
    ctx.stdout.write(`${options.version ?? 'unknown'}\n`)
    return 0
  }
  const { command, flags } = parsed
  try {
    switch (command!) {
      case 'generate':
        return await runGenerate(ctx, flags)
      case 'print':
        return await runPrint(ctx, flags)
      case 'refresh':
        return await runRefresh(ctx, flags)
      case 'init':
        return await runInit(ctx, flags)
      case 'snapshot':
        return await runSnapshot(ctx, flags)
    }
  } catch (error) {
    if (error instanceof CliError || error instanceof SchemaAcquisitionError) {
      ctx.stderr.write(`error: ${error.message}\n`)
    } else {
      ctx.stderr.write(
        `error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
      )
    }
    return 1
  }
}
