import { resolve } from 'node:path'
import {
  acquireSchema,
  checkSnapshot,
  writeSnapshot,
  type SchemaDeps,
  type SchemaSource,
  type SnapshotDifference,
} from '../schema'
import { OperationError, resolveDeps, type OperationDeps } from './types'

export interface SnapshotInput {
  /** The snapshot file, absolute or relative to `cwd` */
  out: string
  /** Compare instead of writing */
  check?: boolean
  /** Defaults to `supabase-local` */
  schemaSource?: 'supabase-local' | 'postgrest'
  /** Environment variable holding the database URL (required by the postgrest source) */
  dbUrlEnv?: string
  /** supabase-local: the directory holding `supabase/config.toml`, relative to `cwd`. Defaults to `cwd` */
  workdir?: string
  /** supabase-local: the Supabase CLI `project_id` */
  projectId?: string
  /** supabase-local: the Supabase CLI invocation, for example `['npx', 'supabase']` */
  supabaseCommand?: string[]
  /** postgrest: the PostgREST image */
  image?: string
  /** postgrest: the docker network */
  network?: string
}

export interface SnapshotResult {
  /** Absolute path of the snapshot */
  out: string
  /** `written`/`unchanged` after a write; `up-to-date`/`drifted` after a check */
  status: 'written' | 'unchanged' | 'up-to-date' | 'drifted'
  /** For `drifted`: the message to show */
  message?: string
  /** For `drifted`: what differs, in full */
  differences: SnapshotDifference[]
}

function sourceOf(
  cwd: string,
  env: Record<string, string | undefined>,
  input: SnapshotInput
): SchemaSource {
  const dbUrl = input.dbUrlEnv !== undefined ? env[input.dbUrlEnv] : undefined
  if (input.dbUrlEnv !== undefined && !dbUrl) {
    throw new OperationError(
      'invalid-input',
      `the environment variable '${input.dbUrlEnv}' is not set`
    )
  }
  if (input.schemaSource === 'postgrest') {
    if (!dbUrl)
      throw new OperationError('invalid-input', 'the postgrest source needs --db-url-env <NAME>')
    return {
      source: 'postgrest',
      dbUrl,
      ...(input.image ? { image: input.image } : {}),
      ...(input.network ? { network: input.network } : {}),
    }
  }
  return {
    source: 'supabase-local',
    workdir: resolve(cwd, input.workdir ?? '.'),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.supabaseCommand ? { supabaseCommand: input.supabaseCommand } : {}),
    ...(dbUrl ? { dbUrl } : {}),
  }
}

/**
 * Acquires the schema of a running stack and writes it to `input.out`, or with `check` compares it with the file
 * that is there. Throws `SchemaAcquisitionError` when the schema cannot be acquired and `OperationError` for an
 * input the source cannot work with.
 */
export async function snapshot(deps: OperationDeps, input: SnapshotInput): Promise<SnapshotResult> {
  const { fs, env, cwd, schema } = resolveDeps(deps)
  const out = resolve(cwd, input.out)
  const schemaDeps: SchemaDeps = { ...schema, fs }
  const acquired = await acquireSchema(sourceOf(cwd, env, input), schemaDeps)
  if (input.check) {
    const result = await checkSnapshot(out, acquired, schemaDeps)
    if (result.ok) return { out, status: 'up-to-date', differences: [] }
    return { out, status: 'drifted', message: result.message, differences: result.differences }
  }
  const { changed } = await writeSnapshot(out, acquired, schemaDeps)
  return { out, status: changed ? 'written' : 'unchanged', differences: [] }
}
