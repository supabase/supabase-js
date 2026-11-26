import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

// Peek at protected state the auth client keeps for its timers.
type Internals = {
  autoRefreshTicker: unknown
  autoRefreshTickTimeout: unknown
  initializePromise: Promise<unknown> | null
  _stopAutoRefresh: () => Promise<void>
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('GoTrueClient.dispose() racing an in-flight initialize()', () => {
  test('leaves no auto-refresh ticker running once initialize() finishes', async () => {
    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      storageKey: 'dispose-race-test',
      storage: memoryLocalStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
    })
    const internals = client as unknown as Internals

    try {
      // React Strict Mode: mount creates the client, the effect cleanup disposes it
      // immediately, before the async initialize() has settled.
      await client.dispose()
      await internals.initializePromise
      await settle()

      expect(internals.autoRefreshTicker).toBeNull()
      expect(internals.autoRefreshTickTimeout).toBeNull()
    } finally {
      // never leak the timer out of this test, even when the assertion fails
      await internals._stopAutoRefresh()
    }
  })
})
