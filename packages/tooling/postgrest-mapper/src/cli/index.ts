/**
 * The `postgrest-mapper` command line (design v5 §7.2). It parses arguments, builds the injected dependencies and
 * calls the library; every decision about what is generated lives in `../generate` and `../schema`.
 */
import { parseArgs } from 'node:util'
import { DEBUG_ENV } from '../content-mapper'
import {
  OperationError,
  check,
  display,
  generate,
  init,
  messageOf,
  nodeClock,
  nodeMtime,
  nodeOperationFs,
  nodeWatch,
  refresh,
  snapshot,
  watch,
  write,
  type GenerateResult,
  type OperationDeps,
  type ProjectInput,
} from '../operations'
import { SchemaAcquisitionError } from '../schema'
import type { CliFs, CliOptions, CliOutput, Flags } from './types'
import { USAGE } from './usage'

export type {
  CliFs,
  CliOptions,
  CliOutput,
  Flags as CliFlags,
  MtimeFn,
  WatchFn,
  WatchHandle,
} from './types'
export { USAGE } from './usage'

export const nodeCliFs: CliFs = nodeOperationFs

const COMMANDS = {
  generate: ['project', 'out', 'check', 'watch', 'schema-source', 'snapshot', 'db-url-env'],
  print: ['project', 'schema-source', 'snapshot', 'db-url-env'],
  refresh: ['project', 'out', 'schema-source', 'snapshot', 'db-url-env'],
  init: ['project', 'out', 'skip-snapshot', 'skip-generate', 'skip-scripts'],
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
        'skip-snapshot': { type: 'boolean' },
        'skip-generate': { type: 'boolean' },
        'skip-scripts': { type: 'boolean' },
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
  set('skipSnapshot', values['skip-snapshot'])
  set('skipGenerate', values['skip-generate'])
  set('skipScripts', values['skip-scripts'])
  if ((command === 'generate' || command === 'snapshot') && flags.out === undefined) {
    throw new UsageError(`'${command}' needs --out`)
  }
  if (flags.check && flags.watch) throw new UsageError('--check and --watch cannot be combined')
  return { command, flags, help, version }
}

/** What a command runs with: the options with their defaults, and the operations' dependencies built from them. */
interface Context {
  stdout: CliOutput
  stderr: CliOutput
  cwd: string
  env: Record<string, string | undefined>
  deps: OperationDeps
  options: CliOptions
}

const projectInput = (flags: Flags): ProjectInput => ({
  ...(flags.project !== undefined ? { project: flags.project } : {}),
  ...(flags.schemaSource !== undefined ? { schemaSource: flags.schemaSource } : {}),
  ...(flags.snapshot !== undefined ? { snapshot: flags.snapshot } : {}),
  ...(flags.dbUrlEnv !== undefined ? { dbUrlEnv: flags.dbUrlEnv } : {}),
})

/** Prints the warnings and `file:line:col code message` of every diagnostic; true when there was none. */
function present(ctx: Context, result: GenerateResult): boolean {
  for (const warning of result.warnings) ctx.stderr.write(`warning: ${warning}\n`)
  for (const d of result.diagnostics) {
    ctx.stderr.write(`${display(ctx.cwd, d.file)}:${d.line}:${d.column} ${d.code} ${d.message}\n`)
  }
  return result.ok
}

const wroteOrCurrent = (ctx: Context, out: string, changed: boolean): void => {
  const shown = display(ctx.cwd, out)
  ctx.stdout.write(changed ? `wrote ${shown}\n` : `${shown} is up to date\n`)
}

async function runGenerate(ctx: Context, flags: Flags): Promise<number> {
  const input = { ...projectInput(flags), out: flags.out! }
  if (flags.check) {
    const result = await check(ctx.deps, input)
    if (!present(ctx, result)) return 1
    const shown = display(ctx.cwd, result.out)
    switch (result.status) {
      case 'up-to-date':
        ctx.stdout.write(`${shown} is up to date\n`)
        return 0
      case 'missing':
        ctx.stderr.write(`${shown} does not exist; run 'postgrest-mapper generate' to create it\n`)
        return 1
      default:
        ctx.stderr.write(
          `${shown} is out of date; run 'postgrest-mapper generate' to update it\n${result.drift.join('\n')}\n`
        )
        return 1
    }
  }
  if (flags.watch) {
    await watch(
      {
        ...ctx.deps,
        watch: ctx.options.watch ?? nodeWatch,
        mtime: ctx.options.mtime ?? nodeMtime,
        clock: nodeClock,
      },
      input,
      {
        ...(ctx.options.debounceMs !== undefined ? { debounceMs: ctx.options.debounceMs } : {}),
        ...(ctx.options.signal ? { signal: ctx.options.signal } : {}),
        onEvent: (event) => {
          if (event.kind === 'error') ctx.stderr.write(`error: ${event.message}\n`)
          else if (present(ctx, event.result))
            wroteOrCurrent(ctx, event.result.out, event.result.changed)
        },
      }
    )
    return 0
  }
  const result = await write(ctx.deps, input)
  if (!present(ctx, result)) return 1
  wroteOrCurrent(ctx, result.out, result.changed)
  return 0
}

async function runPrint(ctx: Context, flags: Flags): Promise<number> {
  const result = await generate(ctx.deps, projectInput(flags))
  if (!present(ctx, result)) return 1
  ctx.stdout.write(result.text)
  return 0
}

async function runRefresh(ctx: Context, flags: Flags): Promise<number> {
  const result = await refresh(ctx.deps, {
    ...projectInput(flags),
    ...(flags.out !== undefined ? { out: flags.out } : {}),
  })
  if (result.cleared !== undefined)
    ctx.stdout.write(`cleared ${display(ctx.cwd, result.cleared)}\n`)
  if (!present(ctx, result)) return 1
  if (result.out !== undefined) wroteOrCurrent(ctx, result.out, result.changed === true)
  return 0
}

async function runInit(ctx: Context, flags: Flags): Promise<number> {
  const result = await init(ctx.deps, {
    ...(flags.project !== undefined ? { project: flags.project } : {}),
    ...(flags.out !== undefined ? { out: flags.out } : {}),
    ...(flags.skipSnapshot ? { snapshot: false } : {}),
    ...(flags.skipGenerate ? { generate: false } : {}),
    ...(flags.skipScripts ? { scripts: false } : {}),
  })
  for (const change of result.changes) {
    ctx.stdout.write(`${display(ctx.cwd, change.file)}: ${change.message}\n`)
  }
  if (result.changes.length === 0) {
    ctx.stdout.write(`${display(ctx.cwd, result.out)} is already set up\n`)
    return 0
  }
  const { snapshot: snap, generate: gen, scripts } = result
  if (snap?.status === 'skipped') {
    ctx.stdout.write(`${display(ctx.cwd, snap.file)}: snapshot skipped: ${snap.reason}\n`)
  }
  if (gen?.status === 'skipped') {
    ctx.stdout.write(`${display(ctx.cwd, result.out)}: generate skipped: ${gen.reason}\n`)
  }
  if (scripts?.reason !== undefined) ctx.stdout.write(`scripts skipped: ${scripts.reason}\n`)
  const named = [...(scripts?.added ?? []), ...(scripts?.existing ?? [])]
  const live = named.includes('postgrest:snapshot')
  ctx.stdout.write('next steps:\n')
  if (scripts?.installed === false) {
    ctx.stdout.write(
      '  add @supabase/postgrest-mapper to devDependencies: the scripts run its binary\n'
    )
  }
  if (result.schemaSource === 'snapshot' && gen?.status !== 'written') {
    ctx.stdout.write(
      "  no supabase/config.toml found: write the schema with 'postgrest-mapper snapshot --out supabase/postgrest-schema.json'\n"
    )
  } else if (snap?.status === 'skipped') {
    ctx.stdout.write(
      "  start the local stack, then write the snapshot with 'postgrest-mapper snapshot --out supabase/postgrest-schema.json'\n"
    )
  }
  if (named.includes('postgrest:watch'))
    ctx.stdout.write('  postgrest:watch regenerates the declarations while you develop\n')
  if (named.includes('postgrest:check')) {
    ctx.stdout.write(
      `  postgrest:check fails CI when they are stale${live ? ', from the committed snapshot: no database needed' : ''}\n`
    )
  }
  if (live) {
    ctx.stdout.write(
      '  postgrest:snapshot after each migration, then commit supabase/postgrest-schema.json\n'
    )
  }
  ctx.stdout.write('  on TypeScript 7.1 the content mapper in the tsconfig replaces the watcher\n')
  return 0
}

async function runSnapshot(ctx: Context, flags: Flags): Promise<number> {
  const result = await snapshot(
    {
      ...ctx.deps,
      schema: {
        ...ctx.deps.schema,
        logger: {
          debug: (message) => {
            if (ctx.env[DEBUG_ENV]) {
              ctx.stderr.write(`debug: ${message}\n`)
            }
          },
          info: (message) => ctx.stderr.write(`${message}\n`),
          warn: (message) => ctx.stderr.write(`warning: ${message}\n`),
        },
      },
    },
    {
      out: flags.out!,
      check: flags.check,
      ...(flags.schemaSource === 'postgrest' || flags.schemaSource === 'supabase-local'
        ? { schemaSource: flags.schemaSource }
        : {}),
      ...(flags.dbUrlEnv !== undefined ? { dbUrlEnv: flags.dbUrlEnv } : {}),
      ...(flags.workdir !== undefined ? { workdir: flags.workdir } : {}),
      ...(flags.projectId !== undefined ? { projectId: flags.projectId } : {}),
      ...(flags.supabaseCommand !== undefined
        ? { supabaseCommand: flags.supabaseCommand.split(/\s+/).filter(Boolean) }
        : {}),
      ...(flags.image !== undefined ? { image: flags.image } : {}),
      ...(flags.network !== undefined ? { network: flags.network } : {}),
    }
  )
  const shown = display(ctx.cwd, result.out)
  if (result.status === 'drifted') {
    ctx.stderr.write(`${result.message}\n`)
    for (const difference of result.differences.slice(0, 10)) {
      ctx.stderr.write(`  ${difference.kind} ${difference.path}\n`)
    }
    if (result.differences.length > 10) {
      ctx.stderr.write(`  ... and ${result.differences.length - 10} more\n`)
    }
    return 1
  }
  ctx.stdout.write(result.status === 'written' ? `wrote ${shown}\n` : `${shown} is up to date\n`)
  return 0
}

/**
 * Runs the command line and resolves to the exit code: 0 success, 1 failure, 2 usage error. Nothing is read from
 * `process`: arguments, streams, file system, environment and working directory are parameters.
 */
export async function runCli(argv: string[], options: CliOptions): Promise<number> {
  const { stdout, stderr } = options
  const env = options.env ?? process.env
  const cwd = options.cwd ?? process.cwd()
  const ctx: Context = {
    stdout,
    stderr,
    cwd,
    env,
    options,
    deps: {
      ...options.deps,
      fs: options.fs ?? nodeCliFs,
      env,
      cwd,
      logger: {
        debug: (message) => {
          if (env[DEBUG_ENV]) stderr.write(`debug: ${message}\n`)
        },
        warn: (message) => stderr.write(`warning: ${message}\n`),
      },
    },
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
    if (error instanceof OperationError || error instanceof SchemaAcquisitionError) {
      ctx.stderr.write(`error: ${error.message}\n`)
    } else {
      ctx.stderr.write(
        `error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
      )
    }
    return 1
  }
}
