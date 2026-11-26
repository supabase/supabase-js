import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient from '../src/RealtimeClient'
import { CONNECTION_STATE } from '../src/lib/constants'
import { DEFAULT_API_KEY, setupRealtimeTest, TestSetup } from './helpers/setup'

let testSetup: TestSetup
const logSpy = vi.fn()

beforeEach(() => {
  testSetup = setupRealtimeTest({
    logger: logSpy,
    useFakeTimers: true,
    encode: undefined,
    decode: undefined,
  })
})

afterEach(() => {
  logSpy.mockClear()
  testSetup.cleanup()
})

describe('Additional Coverage Tests', () => {
  describe('Node.js WebSocket error handling', () => {
    let WebSocketFactory: any
    let originalCreateWebSocket: any

    beforeAll(async () => {
      const WebSocketFactoryModule = await import('../src/lib/websocket-factory')
      WebSocketFactory = WebSocketFactoryModule.default
      originalCreateWebSocket = WebSocketFactory.getWebSocketConstructor

      class MockWS {
        constructor(address: string | URL) {
          throw new Error('Node.js environment detected')
        }
      }

      // Mock WebSocketFactory to throw Node.js specific error
      // @ts-ignore simplified typing
      WebSocketFactory.getWebSocketConstructor = () => MockWS
    })

    afterAll(() => {
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
      }).toThrow(/WebSocket not available/)
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

      vi.advanceTimersByTime(150)

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

      vi.advanceTimersByTime(50)

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
      // Mock window.Worker — vitest 4 requires `function` (not arrow) for `new`-callable mocks
      global.Worker = vi.fn(function () {
        return mockWorker
      }) as any
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
      expect(workerClient.connectionState()).not.toBe(CONNECTION_STATE.open) // disconnecting on error

      // Restore original functions
      global.Worker = originalWorker
      global.URL.createObjectURL = originalCreateObjectURL
    })

    test('should handle worker keepAlive messages', async () => {
      // Mock window.Worker — vitest 4 requires `function` (not arrow) for `new`-callable mocks
      global.Worker = vi.fn(function () {
        return mockWorker
      }) as any
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

  describe('reconnectAfterMs default full-jitter backoff', () => {
    test('should follow the full-jitter curve: random delay in [0, min(30s, 1s * 2^(tries - 1)))', () => {
      const socket = new RealtimeClient(testSetup.realtimeUrl, {
        params: { apikey: '123456789' },
      })

      // Math.random() = 0.5, so the delay is exactly half the cap for each attempt.
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      try {
        expect(socket.reconnectAfterMs(1)).toBe(500) // cap 1s
        expect(socket.reconnectAfterMs(2)).toBe(1000) // cap 2s
        expect(socket.reconnectAfterMs(3)).toBe(2000) // cap 4s
        expect(socket.reconnectAfterMs(4)).toBe(4000) // cap 8s
      } finally {
        randomSpy.mockRestore()
      }
    })

    test('should cap the delay at 30s for later attempts', () => {
      const socket = new RealtimeClient(testSetup.realtimeUrl, {
        params: { apikey: '123456789' },
      })

      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      try {
        expect(socket.reconnectAfterMs(6)).toBe(15000) // cap would be 32s, capped to 30s
        expect(socket.reconnectAfterMs(10)).toBe(15000)
        expect(socket.reconnectAfterMs(100)).toBe(15000)
      } finally {
        randomSpy.mockRestore()
      }
    })

    test('should return 0 when Math.random() returns 0 and stay within the cap', () => {
      const socket = new RealtimeClient(testSetup.realtimeUrl, {
        params: { apikey: '123456789' },
      })

      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
      try {
        expect(socket.reconnectAfterMs(1)).toBe(0)
        expect(socket.reconnectAfterMs(5)).toBe(0)
      } finally {
        randomSpy.mockRestore()
      }

      // With real randomness, the delay is always in [0, cap].
      for (let i = 0; i < 20; i++) {
        const result = socket.reconnectAfterMs(1)
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(1000)
      }
    })

    test('should treat tries below 1 as the first attempt', () => {
      const socket = new RealtimeClient(testSetup.realtimeUrl, {
        params: { apikey: '123456789' },
      })

      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      try {
        expect(socket.reconnectAfterMs(0)).toBe(500)
        expect(socket.reconnectAfterMs(-1)).toBe(500)
      } finally {
        randomSpy.mockRestore()
      }
    })

    test('should keep a caller-supplied reconnectAfterMs unchanged', () => {
      const socket = new RealtimeClient(testSetup.realtimeUrl, {
        params: { apikey: '123456789' },
        reconnectAfterMs: () => 42,
      })

      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
      try {
        expect(socket.reconnectAfterMs(1)).toBe(42)
        expect(socket.reconnectAfterMs(10)).toBe(42)
      } finally {
        randomSpy.mockRestore()
      }
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
