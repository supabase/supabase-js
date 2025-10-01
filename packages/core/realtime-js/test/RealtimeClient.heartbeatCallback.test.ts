import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient, { HeartbeatStatus } from '../src/RealtimeClient'
import { setupRealtimeTest, cleanupRealtimeTest, TestSetup } from './helpers/setup'

let testSetup: TestSetup

beforeEach(() => (testSetup = setupRealtimeTest()))
afterEach(() => cleanupRealtimeTest(testSetup))

describe('heartbeatCallback option', () => {
  test('should set default heartbeatCallback to noop when not provided', () => {
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
    })

    expect(typeof socket.heartbeatCallback).toBe('function')
    expect(() => socket.heartbeatCallback('sent')).not.toThrow()
  })

  test('should set custom heartbeatCallback when provided in options', () => {
    const mockCallback = vi.fn()
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: mockCallback,
    })

    expect(socket.heartbeatCallback).toBe(mockCallback)
  })

  test('should call heartbeatCallback with "sent" when heartbeat is sent', async () => {
    const mockCallback = vi.fn()
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: mockCallback,
    })

    socket.connect()

    // Wait for connection to be established
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Mock the connection as connected
    vi.spyOn(socket, 'isConnected').mockReturnValue(true)

    // Send heartbeat
    await socket.sendHeartbeat()

    expect(mockCallback).toHaveBeenCalledWith('sent')
  })

  test('should call heartbeatCallback with "disconnected" when heartbeat sent while disconnected', async () => {
    const mockCallback = vi.fn()
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: mockCallback,
    })

    // Ensure socket is disconnected
    vi.spyOn(socket, 'isConnected').mockReturnValue(false)

    // Send heartbeat while disconnected
    await socket.sendHeartbeat()

    expect(mockCallback).toHaveBeenCalledWith('disconnected')
  })

  test('should call heartbeatCallback with "timeout" when heartbeat times out', async () => {
    const mockCallback = vi.fn()
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: mockCallback,
    })

    socket.connect()

    // Wait for connection to be established
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Mock the connection as connected
    vi.spyOn(socket, 'isConnected').mockReturnValue(true)

    // Set a pending heartbeat to simulate timeout condition
    socket.pendingHeartbeatRef = 'test-ref'

    // Send heartbeat - should trigger timeout
    await socket.sendHeartbeat()

    expect(mockCallback).toHaveBeenCalledWith('timeout')
  })

  test('should call heartbeatCallback with "ok" when heartbeat response is successful', () => {
    const mockCallback = vi.fn()
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: mockCallback,
    })

    socket.connect()

    // Mock the connection
    const mockConn = {
      onmessage: null as any,
      readyState: MockWebSocket.OPEN,
    }
    socket.conn = mockConn as any

    // Simulate heartbeat response message
    const heartbeatResponse = {
      topic: 'phoenix',
      event: 'phx_reply',
      payload: { status: 'ok' },
      ref: '1',
    }

    // Trigger message handling
    socket['_onConnMessage']({ data: JSON.stringify(heartbeatResponse) })

    expect(mockCallback).toHaveBeenCalledWith('ok')
  })

  test('should call heartbeatCallback with "error" when heartbeat response indicates error', () => {
    const mockCallback = vi.fn()
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: mockCallback,
    })

    socket.connect()

    // Mock the connection
    const mockConn = {
      onmessage: null as any,
      readyState: MockWebSocket.OPEN,
    }
    socket.conn = mockConn as any

    // Simulate heartbeat error response message
    const heartbeatResponse = {
      topic: 'phoenix',
      event: 'phx_reply',
      payload: { status: 'error' },
      ref: '1',
    }

    // Trigger message handling
    socket['_onConnMessage']({ data: JSON.stringify(heartbeatResponse) })

    expect(mockCallback).toHaveBeenCalledWith('error')
  })

  test('should call heartbeatCallback multiple times for different heartbeat events', async () => {
    const mockCallback = vi.fn()
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: mockCallback,
    })

    socket.connect()

    // Wait for connection to be established
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Mock the connection as connected
    vi.spyOn(socket, 'isConnected').mockReturnValue(true)

    // Send heartbeat (should call with 'sent')
    await socket.sendHeartbeat()

    // Mock the connection for message handling
    const mockConn = {
      onmessage: null as any,
      readyState: MockWebSocket.OPEN,
    }
    socket.conn = mockConn as any

    // Simulate successful heartbeat response (should call with 'ok')
    const heartbeatResponse = {
      topic: 'phoenix',
      event: 'phx_reply',
      payload: { status: 'ok' },
      ref: '1',
    }

    socket['_onConnMessage']({ data: JSON.stringify(heartbeatResponse) })

    // Verify both calls were made
    expect(mockCallback).toHaveBeenCalledTimes(2)
    expect(mockCallback).toHaveBeenNthCalledWith(1, 'sent')
    expect(mockCallback).toHaveBeenNthCalledWith(2, 'ok')
  })

  test('should handle heartbeatCallback errors gracefully in sendHeartbeat', async () => {
    const errorCallback = vi.fn().mockImplementation(() => {
      throw new Error('Callback error')
    })

    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: errorCallback,
    })

    socket.connect()

    // Wait for connection to be established
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Mock the connection as connected
    vi.spyOn(socket, 'isConnected').mockReturnValue(true)

    // Mock the log method to verify error logging
    const logSpy = vi.spyOn(socket, 'log')

    // Send heartbeat - should not throw despite callback error
    await expect(socket.sendHeartbeat()).resolves.not.toThrow()

    // Callback should still be called
    expect(errorCallback).toHaveBeenCalledWith('sent')

    // Error should be logged
    expect(logSpy).toHaveBeenCalledWith('error', 'error in heartbeat callback', expect.any(Error))
  })

  test('should handle heartbeatCallback errors gracefully in message handling', () => {
    const errorCallback = vi.fn().mockImplementation(() => {
      throw new Error('Callback error')
    })

    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: errorCallback,
    })

    socket.connect()

    // Mock the connection
    const mockConn = {
      onmessage: null as any,
      readyState: MockWebSocket.OPEN,
    }
    socket.conn = mockConn as any

    // Mock the log method to verify error logging
    const logSpy = vi.spyOn(socket, 'log')

    // Simulate heartbeat response message - should not throw despite callback error
    const heartbeatResponse = {
      topic: 'phoenix',
      event: 'phx_reply',
      payload: { status: 'ok' },
      ref: '1',
    }

    expect(() => {
      socket['_onConnMessage']({ data: JSON.stringify(heartbeatResponse) })
    }).not.toThrow()

    // Callback should still be called
    expect(errorCallback).toHaveBeenCalledWith('ok')

    // Error should be logged
    expect(logSpy).toHaveBeenCalledWith('error', 'error in heartbeat callback', expect.any(Error))
  })

  test('should work with onHeartbeat method to update callback', () => {
    const initialCallback = vi.fn()
    const updatedCallback = vi.fn()

    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: initialCallback,
    })

    // Verify initial callback is set
    expect(socket.heartbeatCallback).toBe(initialCallback)

    // Update callback using onHeartbeat method
    socket.onHeartbeat(updatedCallback)

    // Verify callback is updated
    expect(socket.heartbeatCallback).toBe(updatedCallback)

    // Call the callback
    socket.heartbeatCallback('sent')

    // Verify updated callback is called, not initial
    expect(updatedCallback).toHaveBeenCalledWith('sent')
    expect(initialCallback).not.toHaveBeenCalled()
  })

  test('should handle all HeartbeatStatus values correctly', () => {
    const mockCallback = vi.fn()
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: mockCallback,
    })

    const statuses: HeartbeatStatus[] = ['sent', 'ok', 'error', 'timeout', 'disconnected']

    // Test each status
    statuses.forEach((status) => {
      socket.heartbeatCallback(status)
      expect(mockCallback).toHaveBeenCalledWith(status)
    })

    expect(mockCallback).toHaveBeenCalledTimes(statuses.length)
  })
})
