/**
 * Unit tests for the async-callback deprecation warning in onAuthStateChange.
 *
 * These tests do NOT require a running Supabase instance — they only exercise
 * the synchronous registration path of onAuthStateChange.
 */

import GoTrueClient from '../src/GoTrueClient'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

function makeClient() {
  return new GoTrueClient({
    url: 'http://localhost:9999',
    autoRefreshToken: false,
    persistSession: false,
    storage: memoryLocalStorageAdapter(),
  })
}

describe('onAuthStateChange – async callback deprecation warning', () => {
  test('emits console.warn when an async function is registered', () => {
    const client = makeClient()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const {
      data: { subscription },
    } = client.onAuthStateChange(async (_event, _session) => {})

    subscription.unsubscribe()

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toMatch(/async callbacks are deprecated/)
    warnSpy.mockRestore()
  })

  test('does NOT emit console.warn when a sync function is registered', () => {
    const client = makeClient()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const {
      data: { subscription },
    } = client.onAuthStateChange((_event, _session) => {})

    subscription.unsubscribe()

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  test('emits warning only once per async registration, not per event', async () => {
    const client = makeClient()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const {
      data: { subscription },
    } = client.onAuthStateChange(async (_event, _session) => {})

    // Give the async INITIAL_SESSION emit a chance to fire
    await new Promise((resolve) => setTimeout(resolve, 20))
    subscription.unsubscribe()

    // The warning must fire exactly once — at registration time
    expect(warnSpy).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })
})
