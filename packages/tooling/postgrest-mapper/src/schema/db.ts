import { Client } from 'pg'
import { SchemaAcquisitionError, messageOf } from './errors'
import { createScrubber, urlPassword } from './scrub'
import type { ConnectOptions, DbClient, DbConnection } from './types'

/**
 * Opens a single `pg` connection. Errors are scrubbed of the URL's credentials.
 *
 * `connectionTimeoutMillis` bounds the whole connection attempt (TCP, TLS, authentication), so a host that accepts
 * and then goes quiet cannot hold the caller; running out of it is a `'timeout'`, like any other budget.
 * `options.timeoutMs` also becomes the server's `statement_timeout` and the client's `query_timeout`, so a statement
 * that does not finish is cancelled.
 */
export async function connectPg(url: string, options?: ConnectOptions): Promise<DbConnection> {
  const scrub = createScrubber([urlPassword(url), url])
  const timeoutMs =
    options?.timeoutMs !== undefined && isFinite(options.timeoutMs)
      ? Math.max(1, Math.ceil(options.timeoutMs))
      : undefined
  const fail = (error: unknown): never => {
    const timedOut =
      (error as { code?: unknown } | null)?.code === '57014' || // query_canceled: statement_timeout
      messageOf(error) === 'Query read timeout' || // pg's query_timeout
      messageOf(error) === 'timeout expired' // pg's connectionTimeoutMillis
    throw new SchemaAcquisitionError(timedOut ? 'timeout' : 'database', scrub(messageOf(error)))
  }
  let client: Client
  try {
    client = new Client({
      connectionString: url,
      connectionTimeoutMillis: Math.min(10_000, timeoutMs ?? 10_000),
      ...(timeoutMs === undefined
        ? {}
        : { statement_timeout: timeoutMs, query_timeout: timeoutMs }),
    })
    await client.connect()
  } catch (error) {
    return fail(error)
  }
  // an idle client emits 'error' when the server goes away; without a listener that would crash the process
  client.on('error', () => undefined)
  return {
    async query(sql, params) {
      try {
        const result = await client.query(sql, params as unknown[] | undefined)
        return result.rows as Record<string, unknown>[]
      } catch (error) {
        return fail(error)
      }
    },
    async close() {
      try {
        await client.end()
      } catch {
        // already closed
      }
    },
  }
}

/**
 * Runs `work` inside `BEGIN READ ONLY` ... `ROLLBACK` with `search_path` emptied (so `format_type` and the
 * `pg_get_*` functions qualify every name outside `pg_catalog`). Any write inside is rejected by the server, and
 * nothing is ever committed.
 */
export async function withReadOnlyTransaction<T>(
  db: DbClient,
  work: (db: DbClient) => Promise<T>
): Promise<T> {
  await db.query('BEGIN READ ONLY')
  try {
    await db.query("SET LOCAL search_path = ''")
    return await work(db)
  } finally {
    try {
      await db.query('ROLLBACK')
    } catch {
      // the connection is gone; there is nothing left to roll back
    }
  }
}
