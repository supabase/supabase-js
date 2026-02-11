import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { setupRealtimeTest, type TestSetup } from '../helpers/setup'
import SocketAdapter from '../../src/phoenix/socketAdapter'
import { CONNECTION_STATE, SOCKET_STATES } from '../../src/lib/constants'

let testSetup: TestSetup
let socketAdapter: SocketAdapter
const defaultTimeout = 1000

beforeEach(() => {
  testSetup = setupRealtimeTest({
    timeout: defaultTimeout,
    useFakeTimers: true,
  })
  socketAdapter = testSetup.client.socketAdapter
})

afterEach(() => {
  testSetup.cleanup()
})

describe('disconnect', () => {
  test('returns timeout if execution time exceeds', async () => {
    testSetup.connect()
    await testSetup.socketConnected()

    const callback = vi.fn()

    const result = await socketAdapter.disconnect(callback, undefined, undefined, 1)

    expect(result).toBe('timeout')
    expect(callback).not.toHaveBeenCalled()
  })

  test('returns ok after proper disconnection', async () => {
    testSetup.connect()
    await testSetup.socketConnected()

    const result = await socketAdapter.disconnect(() => {})

    expect(result).toBe('ok')
  })

  test('runs callback after disconnection', async () => {
    testSetup.connect()
    await testSetup.socketConnected()

    const callback = vi.fn()
    const result = await socketAdapter.disconnect(callback)

    expect(callback).toHaveBeenCalled()
  })
})

describe('connection state', () => {
  test('isConnecting', () => {
    vi.spyOn(socketAdapter.getSocket(), 'connectionState').mockReturnValue('connecting')
    expect(socketAdapter.isConnecting()).toBe(true)
  })

  test('isDisconnecting', () => {
    vi.spyOn(socketAdapter.getSocket(), 'connectionState').mockReturnValue('closing')
    expect(socketAdapter.isDisconnecting()).toBe(true)
  })
})
