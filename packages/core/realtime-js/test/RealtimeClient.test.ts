import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient from '../src/RealtimeClient'
import { CHANNEL_EVENTS } from '../src/lib/constants'
import { setupRealtimeTest, cleanupRealtimeTest, TestSetup } from './helpers/setup'

let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest()
})

afterEach(() => {
  cleanupRealtimeTest(testSetup)
})

describe('Additional Coverage Tests', () => {
  describe('Node.js WebSocket error handling', () => {
    test('should provide helpful error message for Node.js WebSocket errors', async () => {
      // Create a socket without transport to trigger WebSocketFactory usage
      const socketWithoutTransport = new RealtimeClient(testSetup.url, {
        params: { apikey: '123456789' },
      })

      // Mock WebSocketFactory to throw Node.js specific error
      const WebSocketFactoryModule = await import('../src/lib/websocket-factory')
      const WebSocketFactory = WebSocketFactoryModule.default
      const originalCreateWebSocket = WebSocketFactory.createWebSocket
      WebSocketFactory.createWebSocket = vi.fn(() => {
        throw new Error('Node.js environment detected')
      })

      expect(() => {
        socketWithoutTransport.connect()
      }).toThrow(/Node.js environment detected/)
      expect(() => {
        socketWithoutTransport.connect()
      }).toThrow(/To use Realtime in Node.js, you need to provide a WebSocket implementation/)

      // Restore original method
      WebSocketFactory.createWebSocket = originalCreateWebSocket
    })
  })

  describe('disconnect with fallback timer', () => {
    test('should handle disconnect with fallback timer when connection close is slow', async () => {
      testSetup.socket.connect()

      // Mock a connection that doesn't close immediately
      const mockConn = {
        close: vi.fn(),
        onclose: null as any,
        readyState: MockWebSocket.OPEN,
      }
      testSetup.socket.conn = mockConn as any

      // Start disconnect
      testSetup.socket.disconnect(1000, 'test reason')

      // Verify close was called with correct parameters
      expect(mockConn.close).toHaveBeenCalledWith(1000, 'test reason')

      // Wait for fallback timer to trigger
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Verify state was set to disconnected by fallback timer
      expect(testSetup.socket.isDisconnecting()).toBe(false)
    })

    test('should handle disconnect when connection close callback fires normally', async () => {
      testSetup.socket.connect()

      // Mock a connection that closes normally
      const mockConn = {
        close: vi.fn(() => {
          // Simulate immediate close callback
          setTimeout(() => mockConn.onclose?.(), 0)
        }),
        onclose: null as any,
        readyState: MockWebSocket.OPEN,
      }
      testSetup.socket.conn = mockConn as any

      // Start disconnect
      testSetup.socket.disconnect()

      // Wait for close callback to fire
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Verify state was set to disconnected by close callback
      expect(testSetup.socket.isDisconnecting()).toBe(false)
    })
  })

  describe('heartbeat timeout reconnection fallback', () => {
    test('should trigger reconnection fallback after heartbeat timeout', async () => {
      testSetup.socket.connect()

      // Set up a pending heartbeat
      testSetup.socket.pendingHeartbeatRef = 'test-ref'

      // Mock isConnected to return false after timeout
      let isConnectedCallCount = 0
      const originalIsConnected = testSetup.socket.isConnected
      testSetup.socket.isConnected = () => {
        isConnectedCallCount++
        return isConnectedCallCount <= 1 // First call returns true, subsequent false
      }

      // Mock reconnectTimer
      const scheduleTimeoutSpy = vi.spyOn(testSetup.socket.reconnectTimer!, 'scheduleTimeout')

      // Trigger heartbeat timeout
      await testSetup.socket.sendHeartbeat()

      // Wait for fallback timeout
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Verify reconnection was scheduled
      expect(scheduleTimeoutSpy).toHaveBeenCalled()

      // Restore original method
      testSetup.socket.isConnected = originalIsConnected
    })
  })

  describe('Node.js fetch fallback', () => {
    test('should handle missing fetch in Node.js environment', () => {
      // Mock environment without fetch
      const originalFetch = global.fetch
      // @ts-ignore
      delete global.fetch

      const socket = new RealtimeClient(testSetup.url, {
        params: { apikey: '123456789' },
      })

      // Access the _resolveFetch method to test native fetch usage
      const fetchFn = socket._resolveFetch()

      // Test that it returns a function (should use native fetch)
      expect(typeof fetchFn).toBe('function')

      // Restore fetch
      global.fetch = originalFetch
    })

    test('should use native fetch by default', () => {
      // Verify fetch exists (Node 20+ requirement)
      expect(typeof global.fetch).toBe('function')

      const socket = new RealtimeClient(testSetup.url, {
        params: { apikey: '123456789' },
      })

      const resolvedFetch = socket._resolveFetch()
      expect(typeof resolvedFetch).toBe('function')
    })

    test('should use global fetch when available and no custom fetch provided', () => {
      // Mock global fetch
      const mockGlobalFetch = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = mockGlobalFetch

      const socket = new RealtimeClient(testSetup.url, {
        params: { apikey: '123456789' },
      })

      // The fetch property should be a function that wraps global fetch
      expect(typeof socket.fetch).toBe('function')

      // Call the fetch function
      socket.fetch('https://example.com', { method: 'POST' })

      // Verify global fetch was called
      expect(mockGlobalFetch).toHaveBeenCalledWith('https://example.com', { method: 'POST' })

      // Test _resolveFetch without custom fetch
      const resolvedFetch = socket._resolveFetch()
      resolvedFetch('https://test.com')
      expect(mockGlobalFetch).toHaveBeenCalledWith('https://test.com')
    })

    test('should prioritize custom fetch over global fetch', () => {
      // Mock both global and custom fetch
      const mockGlobalFetch = vi.fn().mockResolvedValue({ ok: false })
      const mockCustomFetch = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = mockGlobalFetch

      const socket = new RealtimeClient(testSetup.url, {
        params: { apikey: '123456789' },
        fetch: mockCustomFetch,
      })

      // The fetch property should use custom fetch
      socket.fetch('https://example.com')

      // Verify custom fetch was called, not global
      expect(mockCustomFetch).toHaveBeenCalledWith('https://example.com')
      expect(mockGlobalFetch).not.toHaveBeenCalled()

      // Test _resolveFetch with custom fetch parameter
      const anotherCustomFetch = vi.fn().mockResolvedValue({ ok: true })
      const resolvedFetch = socket._resolveFetch(anotherCustomFetch)
      resolvedFetch('https://test.com')

      // Should use the fetch passed to _resolveFetch
      expect(anotherCustomFetch).toHaveBeenCalledWith('https://test.com')
      expect(mockCustomFetch).toHaveBeenCalledTimes(1) // Only from earlier call
      expect(mockGlobalFetch).not.toHaveBeenCalled()
    })
  })

  describe('_leaveOpenTopic', () => {
    test('should leave duplicate open topic', () => {
      const topic = 'realtime:test-topic'
      const channel = testSetup.socket.channel('test-topic')

      // Mock channel as joined
      channel._isJoined = () => true
      channel._isJoining = () => false

      const unsubscribeSpy = vi.spyOn(channel, 'unsubscribe')
      const logSpy = vi.spyOn(testSetup.socket, 'log')

      testSetup.socket._leaveOpenTopic(topic)

      expect(logSpy).toHaveBeenCalledWith('transport', `leaving duplicate topic "${topic}"`)
      expect(unsubscribeSpy).toHaveBeenCalled()
    })

    test('should leave duplicate joining topic', () => {
      const topic = 'realtime:test-topic'
      const channel = testSetup.socket.channel('test-topic')

      // Mock channel as joining
      channel._isJoined = () => false
      channel._isJoining = () => true

      const unsubscribeSpy = vi.spyOn(channel, 'unsubscribe')
      const logSpy = vi.spyOn(testSetup.socket, 'log')

      testSetup.socket._leaveOpenTopic(topic)

      expect(logSpy).toHaveBeenCalledWith('transport', `leaving duplicate topic "${topic}"`)
      expect(unsubscribeSpy).toHaveBeenCalled()
    })

    test('should not leave topic that is not joined or joining', () => {
      const topic = 'realtime:test-topic'
      const channel = testSetup.socket.channel('test-topic')

      // Mock channel as neither joined nor joining
      channel._isJoined = () => false
      channel._isJoining = () => false

      const unsubscribeSpy = vi.spyOn(channel, 'unsubscribe')
      const logSpy = vi.spyOn(testSetup.socket, 'log')

      testSetup.socket._leaveOpenTopic(topic)

      expect(logSpy).not.toHaveBeenCalled()
      expect(unsubscribeSpy).not.toHaveBeenCalled()
    })
  })

  describe('message handling with heartbeat reference', () => {
    test('should clear pending heartbeat reference on matching message', () => {
      testSetup.socket.pendingHeartbeatRef = 'test-ref-123'

      const message = {
        data: JSON.stringify({
          topic: 'phoenix',
          event: 'phx_reply',
          payload: { status: 'ok' },
          ref: 'test-ref-123',
        }),
      }

      ;(testSetup.socket as any)._onConnMessage(message)

      expect(testSetup.socket.pendingHeartbeatRef).toBe(null)
    })

    test('should not clear pending heartbeat reference on non-matching message', () => {
      testSetup.socket.pendingHeartbeatRef = 'test-ref-123'

      const message = {
        data: JSON.stringify({
          topic: 'phoenix',
          event: 'phx_reply',
          payload: { status: 'ok' },
          ref: 'different-ref',
        }),
      }

      ;(testSetup.socket as any)._onConnMessage(message)

      expect(testSetup.socket.pendingHeartbeatRef).toBe('test-ref-123')
    })

    test('should handle message without ref', () => {
      const logSpy = vi.spyOn(testSetup.socket, 'log')

      const message = {
        data: JSON.stringify({
          topic: 'test-topic',
          event: 'test-event',
          payload: { data: 'test' },
          // No ref field
        }),
      }

      ;(testSetup.socket as any)._onConnMessage(message)

      expect(logSpy).toHaveBeenCalledWith('receive', 'test-topic test-event', {
        data: 'test',
      })
    })
  })

  describe('worker error handling', () => {
    test('should handle worker errors', async () => {
      // Mock Worker for this test
      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onerror: null as any,
        onmessage: null as any,
      }

      // Mock window.Worker
      const originalWorker = global.Worker
      global.Worker = vi.fn(() => mockWorker) as any

      // Mock URL.createObjectURL
      const originalCreateObjectURL = global.URL.createObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')

      try {
        const workerClient = new RealtimeClient(testSetup.url, {
          worker: true,
          params: { apikey: '123456789' },
        })

        const logSpy = vi.spyOn(workerClient, 'log')

        // Trigger worker creation
        ;(workerClient as any)._onConnOpen()

        // Simulate worker error
        const errorEvent = new ErrorEvent('error', {
          message: 'Worker script error',
          error: new Error('Worker script error'),
        })

        mockWorker.onerror?.(errorEvent)

        expect(logSpy).toHaveBeenCalledWith('worker', 'worker error', 'Worker script error')
        expect(mockWorker.terminate).toHaveBeenCalled()
      } finally {
        // Restore original functions
        global.Worker = originalWorker
        global.URL.createObjectURL = originalCreateObjectURL
      }
    })

    test('should handle worker keepAlive messages', async () => {
      // Mock Worker for this test
      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onerror: null as any,
        onmessage: null as any,
      }

      // Mock window.Worker
      const originalWorker = global.Worker
      global.Worker = vi.fn(() => mockWorker) as any

      // Mock URL.createObjectURL
      const originalCreateObjectURL = global.URL.createObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')

      try {
        const workerClient = new RealtimeClient(testSetup.url, {
          worker: true,
          params: { apikey: '123456789' },
        })

        const sendHeartbeatSpy = vi.spyOn(workerClient, 'sendHeartbeat')

        // Trigger worker creation
        ;(workerClient as any)._onConnOpen()

        // Simulate worker keepAlive message
        const messageEvent = {
          data: { event: 'keepAlive' },
        }

        mockWorker.onmessage?.(messageEvent as MessageEvent)

        expect(sendHeartbeatSpy).toHaveBeenCalled()
      } finally {
        // Restore original functions
        global.Worker = originalWorker
        global.URL.createObjectURL = originalCreateObjectURL
      }
    })
  })

  describe('_appendParams edge cases', () => {
    test('should return URL unchanged when params is empty', () => {
      const url = 'ws://example.com/socket'
      const result = (testSetup.socket as any)._appendParams(url, {})
      expect(result).toBe(url)
    })

    test('should use & when URL already has query params', () => {
      const url = 'ws://example.com/socket?existing=param'
      const result = (testSetup.socket as any)._appendParams(url, {
        new: 'param',
      })
      expect(result).toBe('ws://example.com/socket?existing=param&new=param')
    })
  })

  describe('_setupConnectionHandlers edge case', () => {
    test('should return early when no connection exists', () => {
      testSetup.socket.conn = null

      // Should not throw when called with no connection
      expect(() => {
        ;(testSetup.socket as any)._setupConnectionHandlers()
      }).not.toThrow()
    })
  })

  describe('_startHeartbeat with existing timer', () => {
    test('should clear existing heartbeat timer before starting new one', () => {
      // Set up existing timer
      testSetup.socket.heartbeatTimer = setInterval(() => {}, 1000)
      const existingTimer = testSetup.socket.heartbeatTimer

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      ;(testSetup.socket as any)._startHeartbeat()

      expect(clearIntervalSpy).toHaveBeenCalledWith(existingTimer)
    })
  })

  describe('reconnectAfterMs fallback', () => {
    test('should use default fallback when tries exceed available intervals', () => {
      const socket = new RealtimeClient(testSetup.url, {
        params: { apikey: '123456789' },
      })

      // Test with tries that exceed RECONNECT_INTERVALS length
      const result = socket.reconnectAfterMs(10) // Much higher than intervals array length
      expect(result).toBe(10000) // DEFAULT_RECONNECT_FALLBACK
    })
  })

  describe('message ref string handling', () => {
    test('should handle message with ref as string', () => {
      const logSpy = vi.spyOn(testSetup.socket, 'log')

      const message = {
        data: JSON.stringify({
          topic: 'test-topic',
          event: 'test-event',
          payload: { data: 'test' },
          ref: '123',
        }),
      }

      ;(testSetup.socket as any)._onConnMessage(message)

      expect(logSpy).toHaveBeenCalledWith('receive', 'test-topic test-event (123)', {
        data: 'test',
      })
    })
  })
})
