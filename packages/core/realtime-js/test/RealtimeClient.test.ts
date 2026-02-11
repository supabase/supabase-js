import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient, { WebSocketLikeConstructor } from '../src/RealtimeClient'
import { SOCKET_STATES } from '../src/lib/constants'
import { DEFAULT_API_KEY, setupRealtimeTest, TestSetup } from './helpers/setup'

let testSetup: TestSetup
const logSpy = vi.fn()

beforeEach(() => {
  testSetup = setupRealtimeTest({
    logger: logSpy,
    encode: undefined,
    decode: undefined,
  })
})

afterEach(() => {
  logSpy.mockClear()
  testSetup.cleanup()
})

describe('Additional Coverage Tests', () => {
  describe('Node.js WebSocket error handling', async () => {
    const WebSocketFactoryModule = await import('../src/lib/websocket-factory')
    const WebSocketFactory = WebSocketFactoryModule.default
    const originalCreateWebSocket = WebSocketFactory.getWebSocketConstructor

    beforeEach(() => {
      class MockWS {
        constructor(address: string | URL) {
          throw new Error('Node.js environment detected')
        }
      }

      // Mock WebSocketFactory to throw Node.js specific error
      // @ts-ignore simplified typing
      WebSocketFactory.getWebSocketConstructor = () => MockWS
    })

    afterEach(() => {
      WebSocketFactory.getWebSocketConstructor = originalCreateWebSocket
    })

    test('should provide helpful error message for Node.js WebSocket errors', async () => {
      // Create a socket without transport to trigger WebSocketFactory usage
      const socketWithoutTransport = new RealtimeClient(testSetup.realtimeUrl, {
        params: { apikey: '123456789' },
      })

      expect(() => {
        socketWithoutTransport.connect()
      }).toThrow(/Node.js environment detected/)

      expect(() => {
        socketWithoutTransport.connect()
      }).toThrow(/To use Realtime in Node.js, you need to provide a WebSocket implementation/)
    })
  })

  describe('disconnect with fallback timer', () => {
    test('should handle disconnect with fallback timer when connection close is slow', async () => {
      testSetup.client.connect()

      // Mock a connection that doesn't close immediately
      const mockConn = {
        close: vi.fn(),
        onclose: null as any,
        readyState: MockWebSocket.OPEN,
      }

      testSetup.client.socketAdapter.getSocket().conn = mockConn as any

      // Start disconnect
      testSetup.client.disconnect(1000, 'test reason')

      // Verify close was called with correct parameters
      expect(mockConn.close).toHaveBeenCalledWith(1000, 'test reason')

      // Wait for fallback timer to trigger
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Verify state was set to disconnected by fallback timer
      expect(testSetup.client.isDisconnecting()).toBe(false)
    })

    test('should handle disconnect when connection close callback fires normally', async () => {
      testSetup.client.connect()

      // Mock a connection that closes normally
      const mockConn = {
        close: vi.fn(() => {
          // Simulate immediate close callback
          setTimeout(() => mockConn.onclose?.(), 0)
        }),
        onclose: null as any,
        readyState: MockWebSocket.OPEN,
      }
      testSetup.client.socketAdapter.getSocket().conn = mockConn as any

      // Start disconnect
      testSetup.client.disconnect()

      // Wait for close callback to fire
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Verify state was set to disconnected by close callback
      expect(testSetup.client.isDisconnecting()).toBe(false)
    })
  })

  describe('heartbeat timeout reconnection fallback', () => {
    test('should trigger reconnection fallback after heartbeat timeout', async () => {
      testSetup.client.connect()
      await testSetup.socketConnected()

      // Set up a pending heartbeat
      testSetup.client.socketAdapter.getSocket().pendingHeartbeatRef = 'test-ref'

      // Mock reconnectTimer
      const scheduleTimeoutSpy = vi.spyOn(testSetup.client.reconnectTimer!, 'scheduleTimeout')

      // Trigger heartbeat timeout
      await testSetup.client.sendHeartbeat()

      await testSetup.socketClosed()

      // Verify reconnection was scheduled
      await vi.waitFor(() => expect(scheduleTimeoutSpy).toHaveBeenCalled())
    })
  })

  describe('Node.js fetch fallback', () => {
    test('should handle missing fetch in Node.js environment', () => {
      // Mock environment without fetch
      const originalFetch = global.fetch
      // @ts-ignore
      delete global.fetch

      const socket = new RealtimeClient(testSetup.realtimeUrl, {
        params: { apikey: DEFAULT_API_KEY },
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

      const socket = new RealtimeClient(testSetup.realtimeUrl, {
        params: { apikey: DEFAULT_API_KEY },
      })

      const resolvedFetch = socket._resolveFetch()
      expect(typeof resolvedFetch).toBe('function')
    })

    test('should use global fetch when available and no custom fetch provided', () => {
      // Mock global fetch
      const mockGlobalFetch = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = mockGlobalFetch

      const socket = new RealtimeClient(testSetup.realtimeUrl, {
        params: { apikey: DEFAULT_API_KEY },
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

      const socket = new RealtimeClient(testSetup.realtimeUrl, {
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

  describe('message handling with heartbeat reference', () => {
    test('should clear pending heartbeat reference on matching message', () => {
      testSetup.client.socketAdapter.getSocket().pendingHeartbeatRef = 'test-ref-123'

      const message = {
        data: JSON.stringify([null, 'test-ref-123', 'phoenix', 'phx_reply', { status: 'ok' }]),
      }

      // @ts-ignore simplified typing
      testSetup.client.socketAdapter.getSocket().onConnMessage(message)

      expect(testSetup.client.pendingHeartbeatRef).toBe(null)
    })

    test('should not clear pending heartbeat reference on non-matching message', () => {
      testSetup.client.socketAdapter.getSocket().pendingHeartbeatRef = 'test-ref-123'

      const message = {
        data: JSON.stringify([null, 'different-ref', 'phoenix', 'phx_reply', { status: 'ok' }]),
      }

      // @ts-ignore simplified typing
      testSetup.client.socketAdapter.getSocket().onConnMessage(message)

      expect(testSetup.client.pendingHeartbeatRef).toBe('test-ref-123')
    })

    test('should handle message without ref', () => {
      const message = {
        data: JSON.stringify([null, null, 'test-topic', 'test-event', { data: 'test' }]),
      }

      // @ts-ignore simplified typing
      testSetup.client.socketAdapter.getSocket().onConnMessage(message)

      expect(logSpy).toHaveBeenCalledWith('receive', 'test-topic test-event', {
        data: 'test',
      })
    })
  })

  describe('worker error handling', () => {
    const originalWorker = global.Worker
    const originalCreateObjectURL = global.URL.createObjectURL

    let mockWorker: any // to simplify typing

    beforeEach(() => {
      mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onerror: null as any,
        onmessage: null as any,
      }
    })

    test('should handle worker errors', async () => {
      // Mock window.Worker
      global.Worker = vi.fn(() => mockWorker) as any
      // Mock URL.createObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')

      const workerClient = new RealtimeClient(testSetup.realtimeUrl, {
        worker: true,
        logger: logSpy,
        params: { apikey: DEFAULT_API_KEY },
      })

      workerClient.connect()
      await testSetup.socketConnected()

      expect(logSpy).toHaveBeenCalledWith('worker', 'starting default worker', undefined)

      // Simulate worker error
      const errorEvent = new ErrorEvent('error', {
        message: 'Worker script error',
        error: new Error('Worker script error'),
      })

      mockWorker.onerror?.(errorEvent)

      expect(logSpy).toHaveBeenCalledWith('worker', 'worker error', 'Worker script error')
      expect(mockWorker.terminate).toHaveBeenCalled()
      expect(workerClient.connectionState()).not.toBe(SOCKET_STATES.open) // disconnecting on error

      // Restore original functions
      global.Worker = originalWorker
      global.URL.createObjectURL = originalCreateObjectURL
    })

    test('should handle worker keepAlive messages', async () => {
      // Mock window.Worker
      global.Worker = vi.fn(() => mockWorker) as any
      // Mock URL.createObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')

      const workerClient = new RealtimeClient(testSetup.realtimeUrl, {
        worker: true,
        params: { apikey: DEFAULT_API_KEY },
      })

      const sendHeartbeatSpy = vi.spyOn(workerClient, 'sendHeartbeat')

      workerClient.connect()
      await testSetup.socketConnected()

      // Simulate worker keepAlive message
      const messageEvent = {
        data: { event: 'keepAlive' },
      }

      mockWorker.onmessage?.(messageEvent as MessageEvent)

      expect(sendHeartbeatSpy).toHaveBeenCalled()

      // Restore original functions
      global.Worker = originalWorker
      global.URL.createObjectURL = originalCreateObjectURL
    })
  })

  describe('reconnectAfterMs fallback', () => {
    test('should use default fallback when tries exceed available intervals', () => {
      const socket = new RealtimeClient(testSetup.realtimeUrl, {
        params: { apikey: '123456789' },
      })

      // Test with tries that exceed RECONNECT_INTERVALS length
      const result = socket.reconnectAfterMs(10) // Much higher than intervals array length
      expect(result).toBe(10000) // DEFAULT_RECONNECT_FALLBACK
    })
  })

  describe('message ref string handling', () => {
    test('should handle message with ref as string', () => {
      const message = {
        data: JSON.stringify([null, '123', 'test-topic', 'test-event', { data: 'test' }]),
      }

      // @ts-ignore
      testSetup.client.socketAdapter.getSocket().onConnMessage(message)

      expect(logSpy).toHaveBeenCalledWith('receive', 'test-topic test-event (123)', {
        data: 'test',
      })
    })
  })
})
