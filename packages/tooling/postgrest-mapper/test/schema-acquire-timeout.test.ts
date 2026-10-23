import { resolve } from 'node:path'
import {
  ExecTimeoutError,
  SchemaAcquisitionError,
  acquireSchema,
  connectPg,
  nodeExec,
  type DbConnection,
  type ExecFn,
  type SchemaSource,
} from '../src'

const SOURCE: SchemaSource = { source: 'postgrest', dbUrl: 'postgres://u:secret@db.invalid:5432/d' }
const never = <T>() => new Promise<T>(() => undefined)

/** Answers the three `postgrest` invocations the way the real image does. */
const dumps: ExecFn = async (_command, args) => {
  const flag = args[args.length - 1]
  const stdout =
    flag === '--dump-config'
      ? 'db-schemas = "public"\n'
      : flag === '--version'
        ? 'PostgREST 12.2.3\n'
        : '{}'
  return { stdout, stderr: '', exitCode: 0 }
}

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => error
  )

describe('acquisition deadline', () => {
  it('rejects with a timeout when a child process never exits, and passes the child what is left', async () => {
    const seen: Array<number | undefined> = []
    const exec: ExecFn = (_command, _args, options) => {
      seen.push(options?.timeoutMs)
      return never()
    }
    const started = Date.now()
    const error = await rejection(acquireSchema(SOURCE, { exec, timeoutMs: 150 }))
    expect(error).toBeInstanceOf(SchemaAcquisitionError)
    expect((error as SchemaAcquisitionError).code).toBe('timeout')
    expect((error as Error).message).toMatch(/schema acquisition did not finish within 150 ms/)
    expect(Date.now() - started).toBeLessThan(2000)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toBeGreaterThan(0)
    expect(seen[0]).toBeLessThanOrEqual(150)
  })

  it('kills a real child process that outlives its budget', async () => {
    const started = Date.now()
    const error = await rejection(
      acquireSchema(SOURCE, {
        // `sleep` stands in for a hung `docker run`
        exec: (_command, _args, options) => nodeExec('sleep', ['30'], options),
        timeoutMs: 200,
      })
    )
    expect((error as SchemaAcquisitionError).code).toBe('timeout')
    expect(Date.now() - started).toBeLessThan(5000)
    // nodeExec itself rejects with the dedicated error
    await expect(nodeExec('sleep', ['30'], { timeoutMs: 100 })).rejects.toBeInstanceOf(
      ExecTimeoutError
    )
  })

  it('closes the connection and rejects when the database never answers', async () => {
    let closed = false
    let timeoutMs: number | undefined
    const connection: DbConnection = {
      query: () => never(),
      close: async () => {
        closed = true
      },
    }
    const error = await rejection(
      acquireSchema(SOURCE, {
        exec: dumps,
        connect: async (_url, options) => {
          timeoutMs = options?.timeoutMs
          return connection
        },
        timeoutMs: 200,
      })
    )
    expect((error as SchemaAcquisitionError).code).toBe('timeout')
    expect(closed).toBe(true)
    expect(timeoutMs).toBeGreaterThan(0)
    expect(timeoutMs).toBeLessThanOrEqual(200)
  })

  it('stops starting child processes once the budget is spent', async () => {
    let calls = 0
    const exec: ExecFn = async (command, args, options) => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 120))
      return dumps(command, args, options)
    }
    const error = await rejection(
      acquireSchema(SOURCE, { exec, connect: () => never(), timeoutMs: 100 })
    )
    expect((error as SchemaAcquisitionError).code).toBe('timeout')
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(calls).toBe(1)
  })

  it('does not bound anything with timeoutMs: Infinity, and rejects a non-positive budget', async () => {
    const error = await rejection(acquireSchema(SOURCE, { exec: dumps, timeoutMs: 0 }))
    expect((error as SchemaAcquisitionError).code).toBe('config')
    const seen: Array<number | undefined> = []
    await rejection(
      acquireSchema(SOURCE, {
        exec: (command, args, options) => (seen.push(options?.timeoutMs), dumps(command, args)),
        connect: async () => {
          throw new Error('stop here')
        },
        timeoutMs: Infinity,
      })
    )
    expect(seen).toEqual([undefined, undefined, undefined])
  })
})

describe('connectPg statement timeout', () => {
  const WORKDIR = resolve(__dirname, '../../../core/postgrest-js/test')

  it('cancels a statement that runs past the budget', async () => {
    const status = await nodeExec('npx', ['supabase', 'status', '-o', 'json', '--workdir', WORKDIR])
    const url: string = JSON.parse(status.stdout.slice(status.stdout.indexOf('{'))).DB_URL
    const db = await connectPg(url, { timeoutMs: 300 })
    try {
      const started = Date.now()
      const error = await rejection(db.query('select pg_sleep(10)'))
      expect(error).toBeInstanceOf(SchemaAcquisitionError)
      expect((error as SchemaAcquisitionError).code).toBe('timeout')
      expect(Date.now() - started).toBeLessThan(3000)
    } finally {
      await db.close()
    }
  }, 60_000)
})
