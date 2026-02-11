import assert from 'assert'
import { beforeEach, afterEach, vi, describe, test, expect } from 'vitest'
import { type TestSetup, phxReply, setupRealtimeTest } from './helpers/setup'
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
    await testClient.socketConnected()

    testClient.mockServer.close({ code: 1006, reason: 'Network error', wasClean: false })
    await testClient.socketClosed()

    // Verify reconnection is scheduled
    assert.ok(testClient.client.socketAdapter.getSocket().reconnectTimer.timer)
  })

  test('should not schedule reconnection on manual disconnect', async () => {
    testClient.client.connect()
    await testClient.socketConnected()
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
    testClient.cleanup()
    testClient = setupRealtimeTest({
      socketHandlers: {
        phx_close: (socket, message) => {
          socket.send(phxReply(message, { status: 'ok', response: {} }))
        },
      },
    })

    testClient.client.connect()
    await testClient.socketConnected()

    const connectSpy = vi.spyOn(testClient.client, 'connect')

    // Trigger reconnection
    testClient.client.reconnectTimer!.callback()

    // Should not have called connect immediately
    expect(connectSpy).toHaveBeenCalledTimes(0)

    // Should have called connect after socket teardown
    await vi.waitFor(() => expect(connectSpy).toHaveBeenCalledTimes(1))
  })
})

describe('socket close event', () => {
  beforeEach(async () => {
    testClient.client.connect()
    await testClient.socketConnected()
  })

  test('schedules reconnectTimer timeout', async () => {
    const spy = vi.spyOn(
      testClient.client.socketAdapter.getSocket().reconnectTimer,
      'scheduleTimeout'
    )

    testClient.mockServer.close({ code: 1000, reason: '', wasClean: true })
    await testClient.socketClosed()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('triggers channel error', async () => {
    const channel = testClient.client.channel('topic')
    channel.state = CHANNEL_STATES.joined
    const spy = vi.spyOn(channel.channelAdapter.getChannel(), 'trigger')

    testClient.mockServer.close({ code: 1000, reason: '', wasClean: true })
    await testClient.socketClosed()

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
