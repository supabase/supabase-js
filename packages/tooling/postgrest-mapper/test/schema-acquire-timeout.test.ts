import { createServer, type AddressInfo, type Server, type Socket } from 'node:net'
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

/**
 * A stand-in for a Postgres server, so that nothing here races the real handshake against a budget: `silent` accepts
 * and never speaks, otherwise the server completes the startup (trust authentication) and answers every query with
 * `onQuery`. It records the startup parameters it was given.
 */
function fakePostgres(onQuery?: () => Buffer | undefined) {
  const startups: Array<Record<string, string>> = []
  const sockets = new Set<Socket>()
  const message = (type: string, body: Buffer) => {
    const head = Buffer.alloc(5)
    head.write(type, 0, 'latin1')
    head.writeInt32BE(body.length + 4, 1)
    return Buffer.concat([head, body])
  }
  const ready = message('Z', Buffer.from('I'))
  const server: Server = createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => undefined)
    if (!onQuery) return // accepts, never speaks
    let started = false
    socket.on('data', (chunk) => {
      if (!started) {
        started = true
        const params = chunk.subarray(8).toString('utf8').split('\0')
        const entries: Record<string, string> = {}
        for (let i = 0; i + 1 < params.length; i += 2) entries[params[i]!] = params[i + 1]!
        startups.push(entries)
        socket.write(Buffer.concat([message('R', Buffer.alloc(4)), ready]))
      } else if (chunk[0] === 'Q'.charCodeAt(0)) {
        socket.write(Buffer.concat([onQuery()!, ready]))
      }
    })
  })
  return {
    startups,
    async listen(): Promise<string> {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      return `postgres://u:secret@127.0.0.1:${(server.address() as AddressInfo).port}/d`
    },
    async close() {
      for (const socket of sockets) socket.destroy()
      await new Promise((resolve) => server.close(resolve))
    },
    error(code: string, text: string): Buffer {
      return message('E', Buffer.from(`SERROR\0C${code}\0M${text}\0\0`))
    },
  }
}

describe('connectPg deadlines', () => {
  let fake: ReturnType<typeof fakePostgres> | undefined
  afterEach(async () => {
    await fake?.close()
    fake = undefined
  })

  it('reports a timeout, not a database error, when the host never completes the connection', async () => {
    fake = fakePostgres()
    const url = await fake.listen()
    const error = await rejection(connectPg(url, { timeoutMs: 300 }))
    expect(error).toBeInstanceOf(SchemaAcquisitionError)
    expect((error as SchemaAcquisitionError).code).toBe('timeout')
    expect((error as Error).message).not.toContain('secret')
  })

  it('maps the server cancelling a statement to a timeout, and sends the budget as statement_timeout', async () => {
    // the server answers the query with the error `statement_timeout` raises; the budget is large because no wall
    // clock decides this outcome
    const stub: ReturnType<typeof fakePostgres> = fakePostgres(() =>
      stub.error('57014', 'canceling statement due to statement timeout')
    )
    fake = stub
    const url = await stub.listen()
    const db = await connectPg(url, { timeoutMs: 60_000 })
    try {
      const error = await rejection(db.query('select pg_sleep(10)'))
      expect(error).toBeInstanceOf(SchemaAcquisitionError)
      expect((error as SchemaAcquisitionError).code).toBe('timeout')
    } finally {
      await db.close()
    }
    expect(stub.startups).toHaveLength(1)
    expect(stub.startups[0]!['statement_timeout']).toBe('60000')
  })
})
