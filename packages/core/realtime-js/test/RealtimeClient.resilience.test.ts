import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WebSocket as MockWebSocket } from 'mock-socket'
import { setupRealtimeTest, cleanupRealtimeTest, TestSetup } from './helpers/setup'

let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest()
})

afterEach(() => {
  cleanupRealtimeTest(testSetup)
})

describe('Network failure scenarios', () => {
  test('should handle network failure and schedule reconnection', async () => {
    testSetup.socket.connect()

    // Simulate network failure by closing with abnormal code
    const closeEvent = new CloseEvent('close', {
      code: 1006, // Abnormal closure
      reason: 'Network error',
      wasClean: false,
    })

    testSetup.socket.conn?.onclose?.(closeEvent)

    // Verify reconnection is scheduled
    assert.ok(testSetup.socket.reconnectTimer.timer)
  })

  test('should not schedule reconnection on manual disconnect', () => {
    testSetup.socket.connect()
    testSetup.socket.disconnect()

    // Verify no reconnection is scheduled
    assert.equal(testSetup.socket.reconnectTimer.timer, undefined)
  })
})

describe('Heartbeat timeout handling', () => {
  test('should handle heartbeat timeout with reconnection fallback', async () => {
    testSetup.socket.connect()

    // Simulate heartbeat timeout
    testSetup.socket.pendingHeartbeatRef = 'test-ref'

    // Mock connection to prevent actual WebSocket close
    const mockConn = {
      close: () => {},
      readyState: MockWebSocket.OPEN,
    }
    testSetup.socket.conn = mockConn as any

    // Trigger heartbeat - should detect timeout
    await testSetup.socket.sendHeartbeat()

    // Should have reset manual disconnect flag
    // @ts-ignore - accessing private property for testing
    assert.equal(testSetup.socket._wasManualDisconnect, false)
  })
})

describe('Reconnection timer logic', () => {
  test('should use delay in reconnection callback', async () => {
    testSetup.socket.connect()

    // Mock isConnected to return false initially
    const originalIsConnected = testSetup.socket.isConnected
    testSetup.socket.isConnected = () => false

    // Track connect calls
    let connectCalls = 0
    const originalConnect = testSetup.socket.connect
    testSetup.socket.connect = () => {
      connectCalls++
      return originalConnect.call(testSetup.socket)
    }

    // Trigger reconnection
    testSetup.socket.reconnectTimer.callback()

    // Should not have called connect immediately
    assert.equal(connectCalls, 0)

    // Wait for the delay
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Should have called connect after delay
    assert.equal(connectCalls, 1)

    // Restore original methods
    testSetup.socket.isConnected = originalIsConnected
    testSetup.socket.connect = originalConnect
  })
})

describe('socket close event', () => {
  beforeEach(() => testSetup.socket.connect())

  test('schedules reconnectTimer timeout', () => {
    const spy = vi.spyOn(testSetup.socket.reconnectTimer, 'scheduleTimeout')

    const closeEvent = new CloseEvent('close', {
      code: 1000,
      reason: '',
      wasClean: true,
    })
    testSetup.socket.conn?.onclose?.(closeEvent)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('triggers channel error', () => {
    const channel = testSetup.socket.channel('topic')
    const spy = vi.spyOn(channel, '_trigger')

    const closeEvent = new CloseEvent('close', {
      code: 1000,
      reason: '',
      wasClean: true,
    })
    testSetup.socket.conn?.onclose?.(closeEvent)

    expect(spy).toHaveBeenCalledWith('phx_error')
  })
})

describe('_onConnError', () => {
  beforeEach(() => {
    testSetup.socket.connect()
  })

  test('triggers channel error', () => {
    const channel = testSetup.socket.channel('topic')
    const spy = vi.spyOn(channel, '_trigger')

    testSetup.socket.conn?.onerror?.(new Event('error'))

    expect(spy).toHaveBeenCalledWith('phx_error')
  })
})
