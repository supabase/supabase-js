import { SchemaAcquisitionError, messageOf } from './errors'
import { connectPg, withReadOnlyTransaction } from './db'
import { nodeExec } from './exec'
import { canonicalJson } from './canonical'
import {
  createRunner,
  dumpPostgrestImage,
  dumpSupabaseLocal,
  exposedSchemas,
  extraSearchPath,
  parseConfigDump,
  parseVersion,
  redactConfig,
} from './postgrest'
import type { PostgrestDumps } from './postgrest'
import { createScrubber, urlPassword } from './scrub'
import { defaultFs, readSnapshot, schemaFromSnapshot } from './snapshot'
import { querySupplementary, readPgVersionNum } from './supplementary'
import { createDeadline } from './deadline'
import type { Deadline } from './deadline'
import { DEFAULT_ACQUIRE_TIMEOUT_MS, DEFAULT_POSTGREST_IMAGE } from './types'
import type { AcquiredSchema, DbConnection, SchemaDeps, SchemaLogger, SchemaSource } from './types'

const silent: SchemaLogger = { debug() {}, info() {}, warn() {} }

/**
 * Acquires everything the planner and the mapper need about a database from one source (design v3 §4.2):
 *
 * - `supabase-local`: `supabase status -o json` for the database URL, `docker exec` into the stack's PostgREST
 *   container for `--dump-config`, `--dump-schema` and `--version`.
 * - `postgrest`: the same three commands in a pinned PostgREST image run against `dbUrl`.
 * - `snapshot`: a committed file; nothing is executed or connected.
 *
 * For the first two, the supplementary catalog and `server_version_num` are read over `pg` in a `BEGIN READ ONLY`
 * transaction that is rolled back. The result's `dump` and `config` are what `loadPlanner(...).load(...)` takes.
 *
 * The whole acquisition shares one deadline (`SchemaDeps.timeoutMs`, `DEFAULT_ACQUIRE_TIMEOUT_MS`): each child process
 * gets what is left of it and is killed when it runs out, statements run under `statement_timeout`, and the call
 * rejects with code `'timeout'`.
 *
 * Every error and log message is scrubbed of the database password, connection strings and `PG*`/`PGRST_*`
 * secrets. Throws `SchemaAcquisitionError`.
 */
export async function acquireSchema(
  source: SchemaSource,
  deps: SchemaDeps = {}
): Promise<AcquiredSchema> {
  if (source.source === 'snapshot') {
    return schemaFromSnapshot(await readSnapshot(source.path, deps))
  }
  const deadline = createDeadline(
    deps.timeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS,
    'schema acquisition'
  )
  try {
    const live = acquireLive(source, deps, deadline)
    // when the deadline wins the race, `live` is abandoned: its late rejection must not go unhandled
    live.catch(() => undefined)
    return await Promise.race([live, deadline.expired])
  } finally {
    deadline.stop()
  }
}

async function acquireLive(
  source: Exclude<SchemaSource, { source: 'snapshot' }>,
  deps: SchemaDeps,
  deadline: Deadline
): Promise<AcquiredSchema> {
  const dbUrl = source.dbUrl
  const scrub = createScrubber([dbUrl, dbUrl ? urlPassword(dbUrl) : undefined])
  const base = deps.logger ?? silent
  const logger: SchemaLogger = {
    debug: (m) => base.debug(scrub(m)),
    info: (m) => base.info(scrub(m)),
    warn: (m) => base.warn(scrub(m)),
  }
  const run = createRunner(deps.exec ?? nodeExec, scrub, logger, deadline)
  const fs = deps.fs ?? defaultFs

  let dumps: PostgrestDumps
  if (source.source === 'supabase-local') {
    dumps = await dumpSupabaseLocal(source, fs, run)
  } else {
    dumps = await dumpPostgrestImage(
      {
        dbUrl: source.dbUrl,
        image: source.image ?? DEFAULT_POSTGREST_IMAGE,
        config: source.config,
        network: source.network,
      },
      run
    )
  }

  const config = redactConfig(parseConfigDump(dumps.configText))
  const schemas = exposedSchemas(config)
  let dump: string
  try {
    dump = canonicalJson(JSON.parse(dumps.schemaText))
  } catch {
    throw new SchemaAcquisitionError('dump', 'postgrest --dump-schema did not print JSON')
  }
  const version = parseVersion(dumps.versionText)

  if (!dumps.dbUrl)
    throw new SchemaAcquisitionError(
      'database',
      'no database URL to read the supplementary catalog from'
    )
  const urlScrub = createScrubber([
    dumps.dbUrl,
    urlPassword(dumps.dbUrl),
    dbUrl,
    dbUrl ? urlPassword(dbUrl) : undefined,
  ])
  const connect = deps.connect ?? connectPg
  let connection: DbConnection | undefined
  deadline.onExpire(() => void connection?.close().catch(() => undefined))
  try {
    connection = await connect(dumps.dbUrl, { timeoutMs: deadline.remaining() })
  } catch (error) {
    throw new SchemaAcquisitionError(
      error instanceof SchemaAcquisitionError ? error.code : 'database',
      urlScrub(messageOf(error))
    )
  }
  try {
    logger.debug(`reading the supplementary catalog of ${schemas.join(', ')}`)
    const { pgVersionNum, supplementary } = await withReadOnlyTransaction(
      connection,
      async (tx) => ({
        pgVersionNum: await readPgVersionNum(tx),
        supplementary: await querySupplementary(tx, schemas, extraSearchPath(config)),
      })
    )
    const schema: AcquiredSchema = {
      dump,
      config,
      pgVersionNum,
      postgrestVersion: version.release,
      supplementary,
    }
    if (version.commit) schema.postgrestCommit = version.commit
    return schema
  } catch (error) {
    if (error instanceof SchemaAcquisitionError) {
      throw new SchemaAcquisitionError(error.code, urlScrub(error.message))
    }
    throw new SchemaAcquisitionError('database', urlScrub(messageOf(error)))
  } finally {
    await connection.close()
  }
}
