import assert from 'assert'
import { beforeEach, afterEach, vi, describe, test, expect } from 'vitest'
import { type TestSetup, setupRealtimeTest } from './helpers/setup'
import { CHANNEL_EVENTS, CHANNEL_STATES } from '../src/lib/constants'

let testClient: TestSetup

beforeEach(() => {
  testClient = setupRealtimeTest()
})

afterEach(() => {
  testClient.cleanup()
})

describe('Network failure scenarios', () => {
  test('should handle network failure and schedule reconnection', async () => {
    testClient.client.connect()

    await vi.waitFor(() => expect(testClient.emitters.connected).toBeCalled())

    testClient.mockServer.close({ code: 1006, reason: 'Network error', wasClean: false })
    await vi.waitFor(() => expect(testClient.emitters.close).toBeCalled())

    // Verify reconnection is scheduled
    assert.ok(testClient.client.socketAdapter.getSocket().reconnectTimer.timer)
  })

  test('should not schedule reconnection on manual disconnect', async () => {
    testClient.client.connect()
    await vi.waitFor(() => expect(testClient.emitters.connected).toBeCalled())
    testClient.client.disconnect()

    // Verify no reconnection is scheduled
    assert.equal(testClient.client.socketAdapter.getSocket().reconnectTimer.timer, undefined)
  })
})

describe('Heartbeat timeout handling', () => {
  test('should handle heartbeat timeout with reconnection fallback', async () => {
    testClient.client.connect()

    // Simulate heartbeat timeout
    // @ts-ignore - accessing private property for testing
    testClient.client.socketAdapter.socket.pendingHeartbeatRef = 'test-ref'

    // Mock connection to prevent actual WebSocket close
    const mockConn = {
      close: () => {},
      send: () => {},
      readyState: WebSocket.OPEN,
    }
    // @ts-ignore - accessing private property for testing
    testClient.client.socketAdapter.socket.conn = mockConn as any

    // Trigger heartbeat - should detect timeout
    await testClient.client.sendHeartbeat()

    // Should have reset manual disconnect flag
    // @ts-ignore - accessing private property for testing
    assert.equal(testClient.client.socketAdapter.getSocket().closeWasClean, false)
  })
})

describe('Reconnection timer logic', () => {
  test('should use delay in reconnection callback', async () => {
    testClient.client.connect()

    // Mock isConnected to return false initially
    const originalIsConnected = testClient.client.isConnected
    testClient.client.isConnected = () => false

    // Track connect calls
    let connectCalls = 0
    const originalConnect = testClient.client.connect
    testClient.client.connect = () => {
      connectCalls++
      return originalConnect.call(testClient.client)
    }

    // Trigger reconnection
    testClient.client.reconnectTimer!.callback()

    // Should not have called connect immediately
    assert.equal(connectCalls, 0)

    // Wait for the delay
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Should have called connect after delay
    assert.equal(connectCalls, 1)

    // Restore original methods
    testClient.client.isConnected = originalIsConnected
    testClient.client.connect = originalConnect
  })
})

describe('socket close event', () => {
  beforeEach(async () => {
    testClient.client.connect()
    await vi.waitFor(() => expect(testClient.emitters.connected).toBeCalled())
  })

  test('schedules reconnectTimer timeout', async () => {
    const spy = vi.spyOn(
      testClient.client.socketAdapter.getSocket().reconnectTimer,
      'scheduleTimeout'
    )

    testClient.mockServer.close({ code: 1000, reason: '', wasClean: true })
    await vi.waitFor(() => expect(testClient.emitters.close).toBeCalled())

    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('triggers channel error', async () => {
    const channel = testClient.client.channel('topic')
    channel.state = CHANNEL_STATES.joined
    const spy = vi.spyOn(channel.channelAdapter.getChannel(), 'trigger')

    testClient.mockServer.close({ code: 1000, reason: '', wasClean: true })
    await vi.waitFor(() => expect(testClient.emitters.close).toHaveBeenCalled())

    expect(spy).toHaveBeenCalledWith(CHANNEL_EVENTS.error)
  })
})

describe('_onConnError', () => {
  beforeEach(() => {
    testClient.client.connect()
  })

  test('triggers channel error', () => {
    const channel = testClient.client.channel('topic')
    channel.subscribe()
    const spy = vi.spyOn(channel.channelAdapter.getChannel(), 'trigger')
    testClient.mockServer.simulate('error')

    expect(spy).toHaveBeenCalledWith(CHANNEL_EVENTS.error)
  })
})
