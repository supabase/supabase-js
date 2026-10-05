import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import type { LockFunc } from '../src/lib/types'

const passthroughLock: LockFunc = async (_name, _acquireTimeout, fn) => await fn()

const makeClient = (storageKey: string, lock?: LockFunc) =>
  new GoTrueClient({
    url: 'http://localhost:9999',
    autoRefreshToken: false,
    persistSession: false,
    storage: memoryLocalStorageAdapter(),
    storageKey,
    ...(lock ? { lock } : {}),
  })

describe('deprecated lock option warning', () => {
  let warnSpy: jest.SpyInstance
  const clients: GoTrueClient[] = []

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(async () => {
    warnSpy.mockRestore()
    await Promise.all(clients.splice(0).map((client) => client.dispose()))
  })

  const deprecationWarnings = () =>
    warnSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('"lock" option is deprecated')
    )

  it('warns once per environment when a lock is supplied, never without one', () => {
    clients.push(makeClient('lock-warning-none'))
    expect(deprecationWarnings()).toHaveLength(0)

    clients.push(makeClient('lock-warning-first', passthroughLock))
    expect(deprecationWarnings()).toHaveLength(1)
    expect(deprecationWarnings()[0][0]).toContain('migrations/lockless-coordination.md')

    clients.push(makeClient('lock-warning-second', passthroughLock))
    expect(deprecationWarnings()).toHaveLength(1)
  })
})
