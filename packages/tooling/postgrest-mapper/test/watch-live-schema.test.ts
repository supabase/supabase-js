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
import { dirname, join } from 'node:path'
import { connectPg, nodeExec, watch, type DbConnection, type WatchEvent } from '../src'
import { STACK_WORKDIR, plannerWasmPath } from './support/acquired'
import { withCatalogLock } from './support/catalog-lock'

/**
 * A live schema regenerates by itself when a migration changes the database: the watch polls the database (the
 * `postgrest` source here, so the scratch schema is the only one exposed) and writes the refresh stamp, with no
 * `refresh`. The DDL runs in a scratch schema of the postgrest-js test stack, under the catalog lock.
 */
const scratch = `watch_live_${randomBytes(4).toString('hex')}`
const wasm = plannerWasmPath()
const DB_ENV = 'MAPPER_WATCH_LIVE_DB_URL'

let dbUrl: string
let admin: DbConnection
let dir: string

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
  dir = mkdtempSync(join(realpathSync(tmpdir()), 'postgrest-mapper-watch-live-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function writeProject(pollIntervalMs: number | undefined): void {
  const write = (name: string, text: string): void => {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  write(
    'src/app.ts',
    `declare const supabase: any\nexport const q = supabase.from('items').select('*')\n`
  )
  write(
    'tsconfig.json',
    JSON.stringify({
      include: ['src'],
      contentMappers: [
        {
          package: '@supabase/postgrest-mapper',
          extensions: ['.pgrst-index'],
          options: {
            postgrest: '16.4',
            defaultSchema: scratch,
            schema: {
              source: 'postgrest',
              dbUrlEnv: DB_ENV,
              config: { 'db-schemas': scratch },
              ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
            },
          },
        },
      ],
    })
  )
}

/** Runs `watch` on the project; `fingerprints` counts the polls that completed, to tell when a baseline exists */
async function watching(): Promise<{
  events: WatchEvent[]
  fingerprints: () => number
  output: () => string
  until: (predicate: () => boolean, what: string) => Promise<void>
  stop: () => Promise<void>
}> {
  let fingerprints = 0
  const events: WatchEvent[] = []
  const controller = new AbortController()
  const done = watch(
    {
      cwd: dir,
      env: { ...process.env, [DB_ENV]: dbUrl },
      schema: {
        connect: async (url, options) => {
          const connection = await connectPg(url, options)
          return {
            query: async (sql, params) => {
              const rows = await connection.query(sql, params)
              if (sql.includes('bit_xor')) fingerprints++
              return rows
            },
            close: () => connection.close(),
          }
        },
      },
      ...(wasm ? { wasmPath: wasm } : {}),
    },
    { project: 'tsconfig.json', out: 'types/supabase.d.ts' },
    { debounceMs: 20, signal: controller.signal, onEvent: (event) => events.push(event) }
  )
  return {
    events,
    fingerprints: () => fingerprints,
    output: () => {
      const path = join(dir, 'types', 'supabase.d.ts')
      return existsSync(path) ? readFileSync(path, 'utf8') : ''
    },
    until: async (predicate, what) => {
      const deadline = Date.now() + 90_000
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    },
    stop: async () => {
      controller.abort()
      await done
    },
  }
}

const stampOf = (): string =>
  join(dir, 'node_modules', '.cache', 'postgrest-mapper', 'refresh.stamp')

const hasRun = (events: WatchEvent[]): boolean =>
  events.some((event) => event.kind === 'run' && event.result.ok)

describe('watch of a live schema', () => {
  it('regenerates after a migration, without refresh, in a project that never had a cache directory', async () => {
    writeProject(200)
    const w = await watching()
    try {
      await w.until(() => hasRun(w.events) && w.fingerprints() > 0, 'the first run and a baseline')
      expect(w.output()).toContain(`${scratch}.items.label`)
      expect(w.output()).not.toContain('added_column')
      const runs = w.events.length

      await withCatalogLock(dbUrl, () =>
        admin.query(`ALTER TABLE ${scratch}.items ADD COLUMN added_column int`)
      )

      // the event, not the file: the file shows up before the run that wrote it is reported
      await w.until(
        () => w.events.length > runs && w.output().includes('added_column'),
        'a run that generated the column'
      )
      expect(existsSync(stampOf())).toBe(true)
    } finally {
      await w.stop()
      await withCatalogLock(dbUrl, () =>
        admin.query(`ALTER TABLE ${scratch}.items DROP COLUMN IF EXISTS added_column`)
      )
    }
  }, 180_000)

  it('does not poll with pollIntervalMs 0: the output keeps the old schema after a migration', async () => {
    writeProject(0)
    const w = await watching()
    try {
      await w.until(() => hasRun(w.events), 'the first run')
      const before = w.output()

      await withCatalogLock(dbUrl, () =>
        admin.query(`ALTER TABLE ${scratch}.items ADD COLUMN unpolled_column int`)
      )
      await new Promise((resolve) => setTimeout(resolve, 2_000))

      // a run may still follow the first one (it creates the cache directory the watch then sees): none of them
      // acquires the schema again, because nothing wrote the stamp
      expect(w.fingerprints()).toBe(0)
      expect(existsSync(stampOf())).toBe(false)
      expect(w.output()).toBe(before)
      expect(w.output()).not.toContain('unpolled_column')
    } finally {
      await w.stop()
      await withCatalogLock(dbUrl, () =>
        admin.query(`ALTER TABLE ${scratch}.items DROP COLUMN IF EXISTS unpolled_column`)
      )
    }
  }, 180_000)
})
