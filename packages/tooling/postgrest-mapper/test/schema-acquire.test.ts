import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  SchemaAcquisitionError,
  acquireSchema,
  buildFunctionTraceInputs,
  buildJsonSchemaInput,
  buildTraceCatalog,
  checkSnapshot,
  connectPg,
  createTracer,
  exposedSchemas,
  jsonSchemaToTs,
  nodeExec,
  plannerSupplementary,
  querySupplementary,
  readSnapshot,
  serializeSnapshot,
  snapshotFromSchema,
  withReadOnlyTransaction,
  writeSnapshot,
  type AcquiredSchema,
  type DbConnection,
  type ExecFn,
  type SchemaSource,
} from '../src'

/**
 * Integration tests against the running postgrest-js test stack (`nx test:infra postgrest-js`): the Supabase CLI
 * project in packages/core/postgrest-js/test, containers `supabase_db_test` and `supabase_rest_test`. Docker must
 * be reachable (DOCKER_CONTEXT is inherited). Nothing here writes to that database.
 */
const WORKDIR = resolve(__dirname, '../../../core/postgrest-js/test')
const LOCAL: SchemaSource = {
  source: 'supabase-local',
  workdir: WORKDIR,
  supabaseCommand: ['npx', 'supabase'],
}
const PLANNER_FIXTURE = resolve(
  __dirname,
  '../../postgrest-planner/test/fixtures/supplementary.json'
)
// The same generator with an extra search path that also names the cast_* schemas of the fixture database
const PLANNER_FIXTURE_SEARCH_PATH = resolve(
  __dirname,
  '../../postgrest-planner/test/fixtures/supplementary-search-path.json'
)

describe('schema acquisition from the supabase-local stack', () => {
  let schema: AcquiredSchema
  let dbUrl: string

  beforeAll(async () => {
    schema = await acquireSchema(LOCAL)
    const status = await nodeExec('npx', ['supabase', 'status', '-o', 'json', '--workdir', WORKDIR])
    dbUrl = JSON.parse(status.stdout.slice(status.stdout.indexOf('{'))).DB_URL
  }, 120_000)

  test('the dump is the PostgREST schema cache', () => {
    const dump = JSON.parse(schema.dump)
    expect(Object.keys(dump)).toEqual(
      expect.arrayContaining(['dbTables', 'dbRelationships', 'dbRoutines'])
    )
    expect(dump.dbTables.length).toBeGreaterThan(10)
    expect(dump.dbRelationships.length).toBeGreaterThan(5)
    // canonical text: sorted keys, compact
    expect(schema.dump).toBe(JSON.stringify(JSON.parse(schema.dump)))
    expect(schema.postgrestVersion).toBe('16.4')
  })

  test('the config carries the exposed schemas and no credentials', () => {
    expect(schema.config['db-schemas']).toBe('public,personal,graphql_public')
    expect(schema.config['db-extra-search-path']).toBeDefined()
    expect(schema.config).not.toHaveProperty('db-uri')
    expect(schema.config).not.toHaveProperty('jwt-secret')
    expect(JSON.stringify(schema)).not.toMatch(/authenticator:postgres@|super-secret-jwt/)
  })

  test('the server version is the database major', () => {
    expect(schema.pgVersionNum).toBeGreaterThanOrEqual(150000)
  })

  test('the supplementary catalog has a view definition, a SQL function body and a validated foreign key', () => {
    const { supplementary } = schema
    const view = supplementary.relations.find(
      (r) => r.schema === 'public' && r.name === 'active_users'
    )
    expect(view?.kind).toBe('v')
    expect(view?.viewDefinition).toMatch(/FROM public\.users/i)
    expect(view?.updatable).toEqual({ insert: true, update: true, delete: true })
    // DISTINCT: only its triggers make it writable, which `pg_relation_is_updatable(oid, false)` does not count
    expect(
      supplementary.relations.find((r) => r.name === 'trigger_writable_view')?.updatable
    ).toEqual({ insert: false, update: false, delete: false })
    const table = supplementary.relations.find((r) => r.schema === 'public' && r.name === 'users')
    expect(table?.columns.find((c) => c.name === 'username')).toMatchObject({
      notNull: true,
      type: 'text',
    })
    const fn = supplementary.functions.find((f) => f.schema === 'public' && f.name === 'get_status')
    expect(fn).toMatchObject({ language: 'sql', argNames: ['name_param'] })
    expect(fn?.source).toMatch(/select/i)
    expect(
      supplementary.foreignKeys.find((k) => k.constraint === 'user_notes_author_fkey')
    ).toMatchObject({ schema: 'personal', table: 'user_notes', validated: true })
    expect(supplementary.enums.find((e) => e.name === 'user_status')?.labels).toEqual([
      'ONLINE',
      'OFFLINE',
    ])
    expect(supplementary.referencedRelations).toEqual(expect.any(Array))
  })

  test('the planner part equals the planner fixture', () => {
    const expected = JSON.parse(readFileSync(PLANNER_FIXTURE, 'utf8'))
    expect(plannerSupplementary(schema.supplementary)).toEqual(expected)
  })

  test('the planner part follows the extra search path: the catalog covers every path schema', async () => {
    const connection = await connectPg(dbUrl)
    try {
      const supplementary = await withReadOnlyTransaction(connection, (tx) =>
        querySupplementary(tx, exposedSchemas(schema.config), [
          'public',
          'extensions',
          'cast_a',
          'cast_b',
          'cast_c',
          'arr_a',
          'arr_b',
          'ext_owned',
        ])
      )
      const expected = JSON.parse(readFileSync(PLANNER_FIXTURE_SEARCH_PATH, 'utf8'))
      expect(plannerSupplementary(supplementary)).toEqual(expected)
      // a path schema outside `db-schemas` brings its functions and its types, not its relations
      expect(supplementary.schemas).toEqual(expect.arrayContaining(['cast_a', 'extensions']))
      expect(
        supplementary.searchPathFunctions?.some(
          (f) => f.schema === 'extensions' && f.name === 'label'
        )
      ).toBe(true)
      // a member of an extension is kept for resolution (the lookup must not skip it) but not printed as an exposed function
      expect(
        supplementary.searchPathFunctions?.some(
          (f) => f.schema === 'ext_owned' && f.name === 'ext_label'
        )
      ).toBe(true)
      expect(
        supplementary.functions.some((f) => f.name === 'ext_label' && f.schema === 'ext_owned')
      ).toBe(false)
      expect(supplementary.relations.some((r) => r.schema === 'cast_a')).toBe(false)
    } finally {
      await connection.close()
    }
  }, 60_000)

  test('the tracer takes the catalog: a view column of a NOT NULL base column is non-null', async () => {
    const catalog = buildTraceCatalog(schema.supplementary)
    const view = catalog.relations.find((r) => r.name === 'active_users')!
    const tracer = await createTracer({ pgVersion: 17 })
    const result = await tracer.trace({
      sql: view.definition!,
      columns: view.columns.map((c) => c.name),
      catalog,
    })
    expect(result.error).toBeUndefined()
    const username = view.columns.findIndex((c) => c.name === 'username')
    expect(result.columns[username].nullable).toBe(false)
    const functions = buildFunctionTraceInputs(schema.supplementary, { searchPath: ['public'] })
    expect(functions.length).toBeGreaterThan(0)
    expect(functions.every((f) => f.input.sql.length > 0)).toBe(true)
  })

  test('the acquisition is read-only: a write in the transaction is rejected and nothing persists', async () => {
    const db: DbConnection = await connectPg(dbUrl)
    try {
      await expect(
        withReadOnlyTransaction(db, (tx) => tx.query('create table public.mapper_ro_probe (x int)'))
      ).rejects.toThrow(/read-only transaction/)
      // the failed transaction was rolled back, so the connection is usable again
      const rows = await db.query("select to_regclass('public.mapper_ro_probe') as t")
      expect(rows[0].t).toBeNull()
    } finally {
      await db.close()
    }
  })

  describe('snapshot', () => {
    let dir: string
    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'mapper-snapshot-'))
    })
    afterAll(() => rmSync(dir, { recursive: true, force: true }))

    test('round-trips byte-stable and feeds acquireSchema', async () => {
      const path = join(dir, 'nested', 'postgrest-schema.json')
      expect(await writeSnapshot(path, schema)).toEqual({ changed: true })
      const first = readFileSync(path, 'utf8')
      expect(first).toBe(serializeSnapshot(snapshotFromSchema(schema)))
      expect(Object.keys(JSON.parse(first))).toEqual([
        'format',
        'postgrest',
        'pgVersionNum',
        'config',
        'supplementaryFormat',
        'supplementary',
        'dump',
      ])

      const fromFile = await acquireSchema({ source: 'snapshot', path })
      expect(fromFile).toEqual(schema)
      // writing what was read changes nothing, byte for byte
      expect(await writeSnapshot(path, fromFile)).toEqual({ changed: false })
      expect(readFileSync(path, 'utf8')).toBe(first)
      expect((await readSnapshot(path)).postgrest).toEqual({ release: schema.postgrestVersion })
    })

    test('a second acquisition of the unchanged stack is identical, and --check says so', async () => {
      const path = join(dir, 'again.json')
      await writeSnapshot(path, schema)
      const again = await acquireSchema(LOCAL)
      expect(await checkSnapshot(path, again)).toEqual({ ok: true })
    })

    test('check detects drift and never writes', async () => {
      const path = join(dir, 'drift.json')
      await writeSnapshot(path, schema)
      const drifted: AcquiredSchema = {
        ...schema,
        pgVersionNum: schema.pgVersionNum + 1,
        supplementary: {
          ...schema.supplementary,
          relations: schema.supplementary.relations.slice(1),
        },
      }
      const before = readFileSync(path, 'utf8')
      const check = await checkSnapshot(path, drifted)
      expect(check).toMatchObject({ ok: false, reason: 'drift' })
      if (!check.ok) {
        expect(check.differences).toEqual(
          expect.arrayContaining([
            { path: '/pgVersionNum', kind: 'changed' },
            expect.objectContaining({ path: '/supplementary/relations/0/name' }),
          ])
        )
      }
      expect(readFileSync(path, 'utf8')).toBe(before)
      expect(await checkSnapshot(join(dir, 'absent.json'), schema)).toMatchObject({
        ok: false,
        reason: 'missing',
      })
    })

    test('an invalid snapshot is rejected with its location', async () => {
      const path = join(dir, 'bad.json')
      const good = JSON.parse(serializeSnapshot(snapshotFromSchema(schema)))
      const write = (value: unknown) =>
        writeSnapshot(path, schema).then(() =>
          require('node:fs').writeFileSync(path, JSON.stringify(value))
        )
      await write({ ...good, format: 2 })
      await expect(readSnapshot(path)).rejects.toThrow(/unsupported snapshot format 2/)
      await write({ ...good, pgVersionNum: 'x', dump: [] })
      await expect(readSnapshot(path)).rejects.toThrow(
        /pgVersionNum: expected an integer[\s\S]*dump: expected/
      )
      await write({ ...good, supplementary: { ...good.supplementary, functions: {} } })
      await expect(readSnapshot(path)).rejects.toThrow(
        /supplementary\.functions: expected an array/
      )
      require('node:fs').writeFileSync(path, '{ nope')
      await expect(readSnapshot(path)).rejects.toThrow(/not valid JSON/)
      await expect(readSnapshot(join(dir, 'absent.json'))).rejects.toMatchObject({
        code: 'snapshot-missing',
      })
    })
  })

  describe('credentials are scrubbed', () => {
    const PASSWORD = 'wrong-pw-s3cr3t-9f2'

    test('a failed connection (bad password) never echoes the password or the URL', async () => {
      const url = new URL(dbUrl)
      url.password = PASSWORD
      const error = await acquireSchema(
        { ...LOCAL, dbUrl: url.toString() },
        { exec: nodeExec }
      ).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(SchemaAcquisitionError)
      expect((error as SchemaAcquisitionError).code).toBe('database')
      expect(String((error as Error).message)).not.toContain(PASSWORD)
      expect((error as Error).message).toMatch(/password authentication failed|authentication/i)
      expect(JSON.stringify(error)).not.toContain(PASSWORD)
      expect((error as Error).stack).not.toContain(PASSWORD)
    })

    test('an unreachable database behind a URL with a password', async () => {
      const error = await connectPg(`postgresql://postgres:${PASSWORD}@127.0.0.1:1/postgres`).catch(
        (e: unknown) => e
      )
      expect(error).toBeInstanceOf(SchemaAcquisitionError)
      expect((error as Error).message).not.toContain(PASSWORD)
    })

    test('failing commands and logs are scrubbed', async () => {
      const exec: ExecFn = async (command) => ({
        stdout: '',
        stderr: `${command} failed: PGPASSWORD=${PASSWORD} PGRST_DB_URI=postgres://u:${PASSWORD}@h/db password: "${PASSWORD}"`,
        exitCode: 3,
      })
      const logs: string[] = []
      const logger = {
        debug: (m: string) => logs.push(m),
        info: (m: string) => logs.push(m),
        warn: (m: string) => logs.push(m),
      }
      const error = await acquireSchema(
        {
          source: 'postgrest',
          dbUrl: `postgresql://postgres:${PASSWORD}@127.0.0.1:54322/postgres`,
        },
        { exec, logger }
      ).catch((e: unknown) => e)
      expect((error as SchemaAcquisitionError).code).toBe('exec')
      expect((error as Error).message).toMatch(/exit 3/)
      expect((error as Error).message).not.toContain(PASSWORD)
      expect(logs.length).toBeGreaterThan(0)
      expect(logs.join('\n')).not.toContain(PASSWORD)
    })
  })
})
