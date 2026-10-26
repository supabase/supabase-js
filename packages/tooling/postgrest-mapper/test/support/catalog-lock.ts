import { connectPg } from '../../src'

/** Any fixed number: every suite that changes the catalog of the stack database (or asserts it did not move) takes it */
const CATALOG_LOCK_KEY = 7_203_411

/**
 * Serialises the suites that run DDL against the postgrest-js test stack with the ones that compare the schema
 * fingerprint, which covers the whole database. A session-level advisory lock on a connection of its own (the
 * database is the lock's scope): held while `fn` runs, released in `finally` and by the connection closing.
 */
export async function withCatalogLock<T>(dbUrl: string, fn: () => Promise<T>): Promise<T> {
  const lock = await connectPg(dbUrl)
  try {
    await lock.query('select pg_advisory_lock($1)', [CATALOG_LOCK_KEY])
    try {
      return await fn()
    } finally {
      await lock.query('select pg_advisory_unlock($1)', [CATALOG_LOCK_KEY])
    }
  } finally {
    await lock.close()
  }
}
