import { expect, test, vi } from 'vitest'
import { setupRealtimeTest } from './helpers/setup'

test('reuses connection handlers across explicit disconnect and reconnect cycles', async () => {
  const setup = setupRealtimeTest()
  const { client } = setup
  const userCallback = vi.fn()
  client.socketAdapter.onMessage(userCallback)

  try {
    client.connect()
    await vi.waitFor(() => expect(client.isConnected()).toBe(true))
    const initial = {
      open: [...client.stateChangeCallbacks.open],
      close: [...client.stateChangeCallbacks.close],
      message: [...client.stateChangeCallbacks.message],
    }

    for (let cycle = 0; cycle < 3; cycle++) {
      await client.disconnect()
      await vi.waitFor(() => expect(client.isConnected()).toBe(false))
      client.connect()
      await vi.waitFor(() => expect(client.isConnected()).toBe(true))
    }

    expect(client.stateChangeCallbacks.open).toEqual(initial.open)
    expect(client.stateChangeCallbacks.close).toEqual(initial.close)
    expect(client.stateChangeCallbacks.message).toEqual(initial.message)
  } finally {
    await client.disconnect()
    setup.cleanup()
  }
})

test('does not accumulate handlers when transport construction fails and is retried', () => {
  const setup = setupRealtimeTest()
  const { client } = setup
  const connect = vi.spyOn(client.socketAdapter, 'connect').mockImplementation(() => {
    throw new Error('transport unavailable')
  })

  try {
    expect(() => client.connect()).toThrow('transport unavailable')
    const initial = {
      open: [...client.stateChangeCallbacks.open],
      close: [...client.stateChangeCallbacks.close],
      message: [...client.stateChangeCallbacks.message],
    }
    expect(() => client.connect()).toThrow('transport unavailable')
    expect(client.stateChangeCallbacks.open).toEqual(initial.open)
    expect(client.stateChangeCallbacks.close).toEqual(initial.close)
    expect(client.stateChangeCallbacks.message).toEqual(initial.message)
  } finally {
    connect.mockRestore()
    setup.cleanup()
  }
})
