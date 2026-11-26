/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost:9999"}
 */

import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

type Internals = {
  autoRefreshTicker: unknown
  autoRefreshTickTimeout: unknown
  initializePromise: Promise<unknown> | null
  _stopAutoRefresh: () => Promise<void>
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('GoTrueClient.dispose() racing an in-flight initialize() (browser)', () => {
  test('does not leave a visibilitychange listener or an auto-refresh ticker behind', async () => {
    let added = 0
    let removed = 0
    const addSpy = jest.spyOn(window, 'addEventListener').mockImplementation(((type: string) => {
      if (type === 'visibilitychange') added++
    }) as typeof window.addEventListener)
    const removeSpy = jest.spyOn(window, 'removeEventListener').mockImplementation(((
      type: string
    ) => {
      if (type === 'visibilitychange') removed++
    }) as typeof window.removeEventListener)

    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      storageKey: 'dispose-race-browser-test',
      storage: memoryLocalStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
    })
    const internals = client as unknown as Internals

    try {
      // React Strict Mode: the effect cleanup disposes the client before the async
      // initialize() has settled.
      await client.dispose()
      await internals.initializePromise
      await settle()

      expect(added - removed).toBe(0)
      expect(internals.autoRefreshTicker).toBeNull()
      expect(internals.autoRefreshTickTimeout).toBeNull()
    } finally {
      await internals._stopAutoRefresh()
      addSpy.mockRestore()
      removeSpy.mockRestore()
    }
  })

  test('a client that is not disposed still registers the listener and starts the ticker', async () => {
    let added = 0
    const addSpy = jest.spyOn(window, 'addEventListener').mockImplementation(((type: string) => {
      if (type === 'visibilitychange') added++
    }) as typeof window.addEventListener)

    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      storageKey: 'dispose-control-browser-test',
      storage: memoryLocalStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
    })
    const internals = client as unknown as Internals

    try {
      await internals.initializePromise
      await settle()

      expect(added).toBe(1)
      expect(internals.autoRefreshTicker).not.toBeNull()
    } finally {
      await client.dispose()
      addSpy.mockRestore()
    }
  })
})
