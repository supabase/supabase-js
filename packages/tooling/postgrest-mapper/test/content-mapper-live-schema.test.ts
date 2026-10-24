import { randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import {
  connectPg,
  createContentMapperServer,
  createProjectGenerator,
  nodeExec,
  type DbConnection,
} from '../src'
import { STACK_WORKDIR, plannerWasmPath } from './support/acquired'
import { withCatalogLock } from './support/catalog-lock'
import { INITIALIZE, RpcClient } from './support/rpc-client'

/**
 * The TS content mapper server keeps a live schema for as long as a project is open: it polls the database and
 * writes the refresh stamp when a migration changed it, so the project, reopened because the stamp is one of its
 * watched files, transforms to the new schema. `closeProject` ends the polling. Scratch schema of the postgrest-js
 * test stack, exposed alone by the `postgrest` source; the DDL runs under the catalog lock.
 */
const scratch = `cm_live_${randomBytes(4).toString('hex')}`
const wasm = plannerWasmPath()
const DB_ENV = 'MAPPER_CM_LIVE_DB_URL'
const POLL_MS = 150

let dbUrl: string
let admin: DbConnection
let dir: string
let stamp: string

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
  admin = await connectPg(dbUrl)
  await withCatalogLock(dbUrl, async () => {
    try {
      await admin.query(`CREATE SCHEMA ${scratch}`)
      await admin.query(`CREATE TABLE ${scratch}.items (id int PRIMARY KEY, label text)`)
      await admin.query(`GRANT USAGE ON SCHEMA ${scratch} TO anon`)
      await admin.query(`GRANT SELECT ON ${scratch}.items TO anon`)
    } catch (error) {
      await admin.query(`DROP SCHEMA IF EXISTS ${scratch} CASCADE`)
      throw error
    }
  })
}, 120_000)

afterAll(async () => {
  if (!admin) return
  await withCatalogLock(dbUrl, () => admin.query(`DROP SCHEMA IF EXISTS ${scratch} CASCADE`))
  await admin.close()
})

beforeEach(() => {
  dir = mkdtempSync(join(realpathSync(tmpdir()), 'postgrest-mapper-cm-live-'))
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(
    join(dir, 'src', 'app.ts'),
    `declare const supabase: any\nexport const q = supabase.from('items').select('*')\n`
  )
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ include: ['src'] }))
  stamp = join(dir, 'node_modules', '.cache', 'postgrest-mapper', 'refresh.stamp')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

/** '' while the stamp is absent or still being written */
const stampText = (): string => (existsSync(stamp) ? readFileSync(stamp, 'utf8') : '')

const until = async (predicate: () => boolean, what: string): Promise<void> => {
  const deadline = Date.now() + 90_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

/** The real server and project generator; every connection the schema code opens is tracked */
function start() {
  const polls = { fingerprints: 0, open: new Set<number>(), polling: new Set<number>() }
  let ids = 0
  const generator = createProjectGenerator({
    cwd: dir,
    env: { ...process.env, [DB_ENV]: dbUrl },
    schema: {
      connect: async (url, options) => {
        const connection = await connectPg(url, options)
        const id = ids++
        polls.open.add(id)
        return {
          query: async (sql, params) => {
            const rows = await connection.query(sql, params)
            if (sql.includes('bit_xor')) {
              polls.fingerprints++
              polls.polling.add(id)
            }
            return rows
          },
          close: async () => {
            polls.open.delete(id)
            await connection.close()
          },
        }
      },
    },
    ...(wasm ? { wasmPath: wasm } : {}),
  })
  const toServer = new PassThrough()
  const fromServer = new PassThrough()
  const server = createContentMapperServer({
    input: toServer,
    output: fromServer,
    logger: { debug: () => undefined, error: () => undefined },
    generator,
  })
  const client = new RpcClient(toServer, fromServer)
  const options = {
    postgrest: '16.4',
    defaultSchema: scratch,
    schema: {
      source: 'postgrest',
      dbUrlEnv: DB_ENV,
      config: { 'db-schemas': scratch },
      pollIntervalMs: POLL_MS,
    },
  }
  const open = (handle: string) =>
    client.request('openProject', {
      configFileName: join(dir, 'tsconfig.json'),
      projectHandle: handle,
      options,
      compilerOptions: {},
    })
  const transform = async (handle: string): Promise<string> =>
    (
      await client.request('transform', {
        fileName: join(dir, 'src', 'supabase.pgrst-index'),
        content: '',
        projectHandle: handle,
      })
    ).result.text
  const stop = async () => {
    server.close()
    await server.closed
    await generator.close()
  }
  return { client, polls, open, transform, stop }
}

describe('content mapper server over a live schema', () => {
  it('transforms to the new schema once a migration moved the database, with no refresh', async () => {
    const s = start()
    try {
      await s.client.request('initialize', INITIALIZE)
      const opened = await s.open('a')
      expect(opened.result.optionDiagnostics).toEqual([])
      expect(opened.result.watchedFiles).toContain(stamp)
      expect(await s.transform('a')).not.toContain('late_column')
      await until(() => s.polls.fingerprints > 0, 'the baseline')

      await withCatalogLock(dbUrl, () =>
        admin.query(`ALTER TABLE ${scratch}.items ADD COLUMN late_column int`)
      )
      // the stamp is what TypeScript watches: its write is what makes it close and open the project again
      await until(() => stampText().endsWith('\n'), 'the refresh stamp')
      await s.open('a')
      expect(await s.transform('a')).toContain(`${scratch}.items.late_column`)
    } finally {
      await s.stop()
      await withCatalogLock(dbUrl, () =>
        admin.query(`ALTER TABLE ${scratch}.items DROP COLUMN IF EXISTS late_column`)
      )
    }
  }, 180_000)

  it('stops polling when the project is closed', async () => {
    const s = start()
    try {
      await s.client.request('initialize', INITIALIZE)
      await s.open('a')
      await until(() => s.polls.fingerprints > 0, 'the baseline')
      expect([...s.polls.polling].some((id) => s.polls.open.has(id))).toBe(true)

      expect((await s.client.request('closeProject', { projectHandle: 'a' })).result).toBeNull()
      await until(
        () => [...s.polls.polling].every((id) => !s.polls.open.has(id)),
        'the poller to close its connection'
      )
      // DDL of another suite may have moved the stamp before the poller stopped: what counts is that nothing moves it now
      const stampAtClose = stampText()
      const probes = s.polls.fingerprints

      await withCatalogLock(dbUrl, () =>
        admin.query(`ALTER TABLE ${scratch}.items ADD COLUMN orphan_column int`)
      )
      await new Promise((resolve) => setTimeout(resolve, POLL_MS * 8))
      expect(stampText()).toBe(stampAtClose)
      expect(s.polls.fingerprints).toBe(probes)
    } finally {
      await s.stop()
      await withCatalogLock(dbUrl, () =>
        admin.query(`ALTER TABLE ${scratch}.items DROP COLUMN IF EXISTS orphan_column`)
      )
    }
  }, 180_000)

  it('transforms to the schema of the moment a project is reopened, whatever changed while it was closed', async () => {
    const s = start()
    try {
      await s.client.request('initialize', INITIALIZE)
      await withCatalogLock(dbUrl, () =>
        admin.query(`ALTER TABLE ${scratch}.items ADD COLUMN reopen_column int NOT NULL DEFAULT 0`)
      )
      await s.open('a')
      await until(() => s.polls.fingerprints > 0, 'the baseline')
      const before = await s.transform('a')
      const column = `reopen_column: SupabaseColumnType<'${scratch}.items.reopen_column', number>`
      expect(before).toContain(`${column}\n`)

      await s.client.request('closeProject', { projectHandle: 'a' })
      await until(
        () => [...s.polls.polling].every((id) => !s.polls.open.has(id)),
        'the poller to close its connection'
      )
      await withCatalogLock(dbUrl, () =>
        admin.query(`ALTER TABLE ${scratch}.items ALTER COLUMN reopen_column DROP NOT NULL`)
      )
      await s.open('a')
      const after = await s.transform('a')
      expect(after).toContain(`${column} | null\n`)
    } finally {
      await s.stop()
      await withCatalogLock(dbUrl, () =>
        admin.query(`ALTER TABLE ${scratch}.items DROP COLUMN IF EXISTS reopen_column`)
      )
    }
  }, 180_000)
})
