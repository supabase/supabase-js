import { DiagnosticCode, validateOptions, type DbConnection } from '../src'
import { createSchemaPoller } from '../src/generate/poll'

/**
 * What the integration tests cannot reach: the poller's failure handling, over injected connections. The database
 * is a variable (`fingerprint`), the connection fails when told to.
 */
const URL = 'postgresql://postgres:s3cr3t-pw@db.example.test:5432/postgres'
const STAMP = '/project/node_modules/.cache/postgrest-mapper/refresh.stamp'

function setup(overrides: { busy?: () => boolean } = {}) {
  const files = new Map<string, string>()
  const writes: string[] = []
  const warnings: string[] = []
  const state = { fingerprint: 'aaa', failing: false, connects: 0, open: 0 }
  const connect = async (): Promise<DbConnection> => {
    state.connects++
    if (state.failing) throw new Error(`connection to ${URL} refused`)
    state.open++
    let closed = false
    return {
      query: async (sql) => {
        if (state.failing) throw new Error(`lost ${URL}`)
        return sql.includes('bit_xor') ? [{ fingerprint: state.fingerprint }] : []
      },
      close: async () => {
        if (!closed) state.open--
        closed = true
      },
    }
  }
  const poller = createSchemaPoller({
    url: URL,
    intervalMs: 10,
    stampPath: STAMP,
    connect,
    fs: {
      readFile: async (path) => {
        const text = files.get(path)
        if (text === undefined) throw new Error('ENOENT')
        return text
      },
      writeFile: async (path, data) => {
        writes.push(data)
        files.set(path, data)
      },
      mkdir: async () => undefined,
    },
    logger: { debug() {}, warn: (message) => warnings.push(message) },
    busy: overrides.busy ?? (() => false),
    timeoutMs: 2_000,
  })
  return { poller, files, writes, warnings, state }
}

const until = async (predicate: () => boolean, what: string): Promise<void> => {
  const deadline = Date.now() + 10_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

describe('schema poller', () => {
  it('takes the first fingerprint as the baseline and writes the stamp when it moves', async () => {
    const { poller, files, writes, state } = setup()
    try {
      await until(() => state.open === 1, 'the connection')
      await new Promise((resolve) => setTimeout(resolve, 60))
      expect(writes).toEqual([])
      state.fingerprint = 'bbb'
      await until(() => files.get(STAMP) === 'bbb\n', 'the stamp')
      state.fingerprint = 'ccc'
      await until(() => files.get(STAMP) === 'ccc\n', 'the next stamp')
      expect(writes).toEqual(['bbb\n', 'ccc\n'])
      expect(state.connects).toBe(1) // one connection, kept open
    } finally {
      await poller.stop()
    }
    expect(state.open).toBe(0)
  })

  it('leaves a stamp that already holds the fingerprint alone, as another process wrote it', async () => {
    const { poller, files, writes, state } = setup()
    try {
      await until(() => state.open === 1, 'the connection')
      await new Promise((resolve) => setTimeout(resolve, 30))
      files.set(STAMP, 'bbb\n')
      state.fingerprint = 'bbb'
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(writes).toEqual([])
    } finally {
      await poller.stop()
    }
  })

  it('warns once while the database is unreachable, scrubbed, keeps the baseline and recovers', async () => {
    const { poller, files, writes, warnings, state } = setup()
    try {
      await until(() => state.open === 1, 'the baseline connection')
      await new Promise((resolve) => setTimeout(resolve, 30))
      state.failing = true
      await until(() => state.connects >= 6, 'several failed probes')
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('could not check the database for schema changes')
      expect(warnings[0]).not.toContain('s3cr3t-pw')
      expect(warnings[0]).not.toContain(URL)
      expect(state.open).toBe(0) // the broken connection was closed

      // a change while it was down is seen once it is back: the baseline was kept
      state.fingerprint = 'bbb'
      state.failing = false
      await until(() => files.get(STAMP) === 'bbb\n', 'the stamp after recovery')
      expect(writes).toEqual(['bbb\n'])

      // the warning is armed again by the success
      state.failing = true
      await until(() => warnings.length === 2, 'a second warning')
    } finally {
      await poller.stop()
    }
  })

  it('writes nothing while a generation runs, and the change right after', async () => {
    let busy = false
    const { poller, files, writes, state } = setup({ busy: () => busy })
    try {
      await until(() => state.open === 1, 'the baseline connection')
      await new Promise((resolve) => setTimeout(resolve, 30))
      busy = true
      state.fingerprint = 'bbb'
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(writes).toEqual([])
      busy = false
      await until(() => files.get(STAMP) === 'bbb\n', 'the stamp')
    } finally {
      await poller.stop()
    }
  })

  it('stops probing and closes its connection on stop', async () => {
    const { poller, state } = setup()
    await until(() => state.open === 1, 'the connection')
    await poller.stop()
    expect(state.open).toBe(0)
    const connects = state.connects
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(state.connects).toBe(connects)
    expect(state.open).toBe(0)
  })
})

describe('pollIntervalMs option', () => {
  const withSchema = (schema: Record<string, unknown>) => ({ postgrest: '16.4', schema })
  const problems = (schema: Record<string, unknown>) => {
    const result = validateOptions(withSchema(schema))
    return result.ok ? [] : result.diagnostics.map((d) => `${d.path.join('.')}:${d.code}`)
  }

  it('takes a non-negative finite number or false on the live sources', () => {
    for (const value of [0, 200, 2000.5, false]) {
      expect(problems({ source: 'supabase-local', pollIntervalMs: value })).toEqual([])
      expect(problems({ source: 'postgrest', dbUrlEnv: 'DB', pollIntervalMs: value })).toEqual([])
    }
    for (const value of [-1, Infinity, NaN, '200', true, null]) {
      expect(problems({ source: 'supabase-local', pollIntervalMs: value })).toEqual([
        `schema.pollIntervalMs:${DiagnosticCode.InvalidOption}`,
      ])
    }
  })

  it('is not an option of a snapshot', () => {
    expect(problems({ source: 'snapshot', path: 's.json', pollIntervalMs: 200 })).toEqual([
      `schema.pollIntervalMs:${DiagnosticCode.UnknownOption}`,
    ])
  })
})
