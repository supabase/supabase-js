import { ExecTimeoutError, SchemaAcquisitionError, messageOf, timeoutError } from './errors'
import type { Deadline } from './deadline'
import type { ExecFn, ExecOptions, SchemaFs, SchemaLogger } from './types'

/** What a source gives before the database is asked anything. */
export interface PostgrestDumps {
  schemaText: string
  configText: string
  versionText: string
  /** URL for the supplementary catalog, when the source knows one */
  dbUrl?: string
}

/** Runs one command, turning every failure into a scrubbed `SchemaAcquisitionError`. */
export interface Runner {
  (what: string, command: string, args: string[], options?: ExecOptions): Promise<string>
}

export function createRunner(
  exec: ExecFn,
  scrub: (text: string) => string,
  logger: SchemaLogger,
  deadline?: Deadline
): Runner {
  return async (what, command, args, options) => {
    const remaining = deadline?.remaining()
    if (deadline && remaining !== undefined && remaining <= 0) throw timeoutError(what, deadline.ms)
    logger.debug(scrub(`${what}: ${[command, ...args].join(' ')}`))
    let result
    try {
      result = await exec(
        command,
        args,
        remaining !== undefined && isFinite(remaining)
          ? { ...options, timeoutMs: remaining }
          : options
      )
    } catch (error) {
      if (error instanceof ExecTimeoutError && deadline) throw timeoutError(what, deadline.ms)
      throw new SchemaAcquisitionError(
        'exec',
        scrub(`${what}: could not run \`${command}\`: ${messageOf(error)}`)
      )
    }
    if (result.stderr.trim()) logger.debug(scrub(`${what}: ${result.stderr.trim()}`))
    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim()
      throw new SchemaAcquisitionError(
        'exec',
        scrub(`${what} failed (exit ${result.exitCode})${detail ? `: ${tail(detail)}` : ''}`)
      )
    }
    return result.stdout
  }
}

function tail(text: string, max = 600): string {
  return text.length > max ? `...${text.slice(-max)}` : text
}

/** Parses `postgrest --dump-config` output: `key = <JSON value>` lines. */
export function parseConfigDump(text: string): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  for (const line of text.split('\n')) {
    const match = /^([A-Za-z0-9._-]+)\s*=\s*(.*)$/.exec(line.trim())
    if (!match) continue
    try {
      config[match[1]] = JSON.parse(match[2])
    } catch {
      throw new SchemaAcquisitionError(
        'config',
        `--dump-config: the value of \`${match[1]}\` is not JSON`
      )
    }
  }
  if (Object.keys(config).length === 0) {
    throw new SchemaAcquisitionError('config', '--dump-config printed no configuration')
  }
  return config
}

const SECRET_KEY = /(^|[-._])(uri|secret|password|passwd|token)([-._]|$)|^app\.settings\./i

/**
 * Removes what must not reach a snapshot or a log: the database URI (it carries the password), the JWT secret and
 * every other key that names a secret. The planner reads only planning keys, so nothing it needs is lost.
 */
export function redactConfig(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (!SECRET_KEY.test(key)) out[key] = value
  }
  return out
}

/** The exposed schemas, in `db-schemas` order (the first is the default). */
export function exposedSchemas(config: Record<string, unknown>): string[] {
  const raw = config['db-schemas']
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  const schemas = list.map((s) => String(s).trim()).filter(Boolean)
  if (schemas.length === 0) {
    throw new SchemaAcquisitionError('config', 'the PostgREST config has no `db-schemas`')
  }
  return schemas
}

/** Parses `postgrest --version`, for example `PostgREST 16.4` or `PostgREST 14.4.1 (a1b2c3d)`. */
export function parseVersion(text: string): { release: string; commit?: string } {
  const match = /PostgREST\s+(\S+)(?:\s+\(([0-9a-f]+)\))?/i.exec(text)
  if (!match) {
    throw new SchemaAcquisitionError(
      'exec',
      `unrecognised \`postgrest --version\` output: ${tail(text.trim(), 120)}`
    )
  }
  return match[2] ? { release: match[1], commit: match[2] } : { release: match[1] }
}

// ---------------------------------------------------------------------------------------------------------------
// supabase-local
// ---------------------------------------------------------------------------------------------------------------

export interface SupabaseLocalOptions {
  workdir?: string
  projectId?: string
  supabaseCommand?: string[]
  dbUrl?: string
}

/** `supabase status -o json` prints warnings around the object on some versions; take the outermost braces. */
function parseStatus(text: string): Record<string, unknown> {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) {
    throw new SchemaAcquisitionError(
      'supabase',
      '`supabase status -o json` printed no JSON (is the stack running?)'
    )
  }
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    throw new SchemaAcquisitionError('supabase', '`supabase status -o json` printed invalid JSON')
  }
}

async function findProjectId(
  options: SupabaseLocalOptions,
  fs: SchemaFs,
  run: Runner
): Promise<string> {
  if (options.projectId) return options.projectId
  const configPath = `${options.workdir ?? '.'}/supabase/config.toml`
  try {
    const toml = await fs.readFile(configPath)
    const match = /^\s*project_id\s*=\s*"([^"]+)"/m.exec(toml)
    if (match) return match[1]
  } catch {
    // no config.toml here: fall back to the running containers
  }
  const names = (
    await run('docker ps', 'docker', [
      'ps',
      '--filter',
      'name=^supabase_rest_',
      '--format',
      '{{.Names}}',
    ])
  )
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean)
  if (names.length === 1) return names[0].slice('supabase_rest_'.length)
  throw new SchemaAcquisitionError(
    'supabase',
    names.length === 0
      ? 'no running `supabase_rest_*` container: start the stack with `supabase start`'
      : `several Supabase stacks are running (${names.join(', ')}): set \`projectId\``
  )
}

export async function dumpSupabaseLocal(
  options: SupabaseLocalOptions,
  fs: SchemaFs,
  run: Runner
): Promise<PostgrestDumps> {
  const [cli, ...cliArgs] = options.supabaseCommand ?? ['supabase']
  let dbUrl = options.dbUrl
  if (!dbUrl) {
    const status = parseStatus(
      await run('supabase status', cli, [
        ...cliArgs,
        'status',
        '-o',
        'json',
        ...(options.workdir ? ['--workdir', options.workdir] : []),
      ])
    )
    if (typeof status.DB_URL !== 'string') {
      throw new SchemaAcquisitionError(
        'supabase',
        '`supabase status -o json` has no DB_URL (is the database running?)'
      )
    }
    dbUrl = status.DB_URL
  }
  const container = `supabase_rest_${await findProjectId(options, fs, run)}`
  const inContainer = (what: string, flag: string) =>
    run(what, 'docker', ['exec', container, 'postgrest', flag])
  return {
    configText: await inContainer('postgrest --dump-config', '--dump-config'),
    schemaText: await inContainer('postgrest --dump-schema', '--dump-schema'),
    versionText: await inContainer('postgrest --version', '--version'),
    dbUrl,
  }
}

// ---------------------------------------------------------------------------------------------------------------
// postgrest (pinned image)
// ---------------------------------------------------------------------------------------------------------------

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])

/** The URL as the container must dial it: a loopback host means the Docker host, not the container itself. */
export function containerDbUrl(dbUrl: string, network?: string): string {
  if (network) return dbUrl
  try {
    const url = new URL(dbUrl)
    if (LOOPBACK.has(url.hostname)) url.hostname = 'host.docker.internal'
    return url.toString()
  } catch {
    return dbUrl
  }
}

/** `db-schemas` becomes `PGRST_DB_SCHEMAS`. */
export function configEnvName(key: string): string {
  return `PGRST_${key.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
}

export interface PostgrestImageOptions {
  dbUrl: string
  image: string
  config?: Record<string, string>
  network?: string
}

export async function dumpPostgrestImage(
  options: PostgrestImageOptions,
  run: Runner
): Promise<PostgrestDumps> {
  const env: Record<string, string> = {
    PGRST_DB_URI: containerDbUrl(options.dbUrl, options.network),
  }
  for (const [key, value] of Object.entries(options.config ?? {})) env[configEnvName(key)] = value
  // values travel in the child's environment: `-e NAME` forwards it, so no secret appears in an argument list
  const base = [
    'run',
    '--rm',
    ...(options.network
      ? ['--network', options.network]
      : ['--add-host', 'host.docker.internal:host-gateway']),
    ...Object.keys(env).flatMap((name) => ['-e', name]),
    '--entrypoint',
    '/bin/postgrest',
    options.image,
  ]
  const inImage = (what: string, flag: string) => run(what, 'docker', [...base, flag], { env })
  return {
    configText: await inImage('postgrest --dump-config', '--dump-config'),
    schemaText: await inImage('postgrest --dump-schema', '--dump-schema'),
    versionText: await inImage('postgrest --version', '--version'),
    dbUrl: options.dbUrl,
  }
}
