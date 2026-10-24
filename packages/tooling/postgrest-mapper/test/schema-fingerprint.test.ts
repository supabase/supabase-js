import { randomBytes } from 'node:crypto'
import { connectPg, nodeExec, schemaFingerprint, type DbConnection } from '../src'
import { STACK_WORKDIR } from './support/acquired'
import { withCatalogLock } from './support/catalog-lock'

/**
 * Integration tests against the running postgrest-js test stack (`nx test:infra postgrest-js`). All DDL happens
 * in a scratch schema that is dropped afterwards. The fingerprint covers the whole database, so every statement
 * (these and the ones of the other suites) runs under the catalog lock: no DDL moves it between a baseline and its
 * comparison.
 */
describe('schema fingerprint', () => {
  const scratch = `fingerprint_scratch_${randomBytes(4).toString('hex')}`
  let reader: DbConnection
  let admin: DbConnection
  let dbUrl: string

  const fingerprint = () => schemaFingerprint(reader)

  async function expectChange(statement: string): Promise<void> {
    await withCatalogLock(dbUrl, async () => {
      const before = await fingerprint()
      await admin.query(statement)
      expect(await fingerprint()).not.toBe(before)
    })
  }

  /** The lock keeps every other suite's DDL out between the baseline and the comparison */
  async function expectUnchanged(statement: string): Promise<void> {
    await withCatalogLock(dbUrl, async () => {
      const before = await fingerprint()
      await admin.query(statement)
      expect(await fingerprint()).toBe(before)
    })
  }

  beforeAll(async () => {
    const status = await nodeExec('npx', [
      'supabase',
      'status',
      '-o',
      'json',
      '--workdir',
      STACK_WORKDIR,
    ])
    dbUrl = JSON.parse(status.stdout.slice(status.stdout.indexOf('{'))).DB_URL
    reader = await connectPg(dbUrl)
    admin = await connectPg(dbUrl)
    await withCatalogLock(dbUrl, async () => {
      try {
        await admin.query(`CREATE SCHEMA ${scratch}`)
        await admin.query(`CREATE TYPE ${scratch}.mood AS ENUM ('sad', 'ok')`)
        await admin.query(`CREATE TABLE ${scratch}.items (id int PRIMARY KEY, label text)`)
        await admin.query(
          `INSERT INTO ${scratch}.items SELECT g, 'row ' || g FROM generate_series(1, 200) g`
        )
        await admin.query(
          `CREATE MATERIALIZED VIEW ${scratch}.items_mv AS SELECT id, label FROM ${scratch}.items`
        )
        await admin.query(
          `CREATE FUNCTION ${scratch}.answer() RETURNS int LANGUAGE sql AS 'SELECT 1'`
        )
        await admin.query(`CREATE TABLE ${scratch}.doomed (id int)`)
      } catch (error) {
        await admin.query(`DROP SCHEMA IF EXISTS ${scratch} CASCADE`)
        throw error
      }
    })
  }, 120_000)

  afterAll(async () => {
    if (admin) {
      await withCatalogLock(dbUrl, () => admin.query(`DROP SCHEMA IF EXISTS ${scratch} CASCADE`))
    }
    await reader?.close()
    await admin?.close()
  })

  test('two consecutive calls on an idle database return the same hex hash', async () => {
    await withCatalogLock(dbUrl, async () => {
      const first = await fingerprint()
      expect(first).toMatch(/^[0-9a-f]+$/)
      expect(await fingerprint()).toBe(first)
    })
  })

  test('adding a column changes it', () =>
    expectChange(`ALTER TABLE ${scratch}.items ADD COLUMN extra int`))

  test('creating a view changes it', () =>
    expectChange(`CREATE VIEW ${scratch}.items_view AS SELECT id FROM ${scratch}.items`))

  test('replacing a function body changes it', () =>
    expectChange(
      `CREATE OR REPLACE FUNCTION ${scratch}.answer() RETURNS int LANGUAGE sql AS 'SELECT 2'`
    ))

  test('changing a function return type changes it', async () => {
    await withCatalogLock(dbUrl, async () => {
      await admin.query(`DROP FUNCTION ${scratch}.answer()`)
    })
    await expectChange(
      `CREATE FUNCTION ${scratch}.answer() RETURNS text LANGUAGE sql AS $$SELECT '2'$$`
    )
  })

  test('adding an enum value changes it', () =>
    expectChange(`ALTER TYPE ${scratch}.mood ADD VALUE 'happy'`))

  test('granting a privilege changes it', () =>
    expectChange(`GRANT SELECT ON ${scratch}.items TO anon`))

  test('dropping a table changes it', () => expectChange(`DROP TABLE ${scratch}.doomed`))

  test('ANALYZE leaves it unchanged', () => expectUnchanged(`ANALYZE ${scratch}.items`))

  test('VACUUM leaves it unchanged', () => expectUnchanged(`VACUUM ${scratch}.items`))

  test('TRUNCATE leaves it unchanged', () => expectUnchanged(`TRUNCATE ${scratch}.items`))

  test('refreshing a materialized view leaves it unchanged', () =>
    expectUnchanged(`REFRESH MATERIALIZED VIEW ${scratch}.items_mv`))
})
