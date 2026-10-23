import { resolve } from 'node:path'
import { connectPg, nodeExec, querySupplementary, type DbConnection } from '../src'

/**
 * Integration test against the running postgrest-js test stack (`nx test:infra postgrest-js`). The functions are
 * created inside a transaction that is always rolled back: nothing is committed to the shared database.
 */
const WORKDIR = resolve(__dirname, '../../../core/postgrest-js/test')

describe('supplementary catalog: INOUT parameters are result columns', () => {
  let db: DbConnection

  beforeAll(async () => {
    const status = await nodeExec('npx', ['supabase', 'status', '-o', 'json', '--workdir', WORKDIR])
    const url = JSON.parse(status.stdout.slice(status.stdout.indexOf('{'))).DB_URL
    db = await connectPg(url)
  }, 120_000)

  afterAll(() => db.close())

  test('INOUT, OUT and TABLE columns come out in declaration order, IN parameters stay out', async () => {
    await db.query('BEGIN')
    try {
      await db.query("SET LOCAL search_path = ''")
      await db.query(`
        create function public.inout_probe_both(in a int, inout b text, out c bigint)
        returns record language sql as $$ select b, a::bigint $$`)
      await db.query(`
        create function public.inout_probe_only(inout n int)
        returns int language sql as $$ select n $$`)
      await db.query(`
        create function public.inout_probe_in(in a int, in b text)
        returns record language sql as $$ select 1, 2 $$`)
      const { functions } = await querySupplementary(db, ['public'])
      const outColumns = (name: string) => functions.find((f) => f.name === name)?.outColumns
      expect(outColumns('inout_probe_both')).toEqual([
        { name: 'b', type: 'text' },
        { name: 'c', type: 'bigint' },
      ])
      expect(outColumns('inout_probe_only')).toEqual([{ name: 'n', type: 'integer' }])
      expect(outColumns('inout_probe_in')).toBeNull()
    } finally {
      await db.query('ROLLBACK')
    }
  }, 60_000)
})
