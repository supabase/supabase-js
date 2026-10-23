import { Client } from 'pg'
import { SchemaAcquisitionError, messageOf } from './errors'
import { createScrubber, urlPassword } from './scrub'
import type { DbClient, DbConnection } from './types'

/**
 * Opens a single `pg` connection. Errors are scrubbed of the URL's credentials.
 *
 * `connectionTimeoutMillis` bounds the wait for a dead host.
 */
export async function connectPg(url: string): Promise<DbConnection> {
  const scrub = createScrubber([urlPassword(url), url])
  const fail = (error: unknown): never => {
    throw new SchemaAcquisitionError('database', scrub(messageOf(error)))
  }
  let client: Client
  try {
    client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 })
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
