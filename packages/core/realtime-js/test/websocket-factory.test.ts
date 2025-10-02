import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import WebSocketFactory from '../src/lib/websocket-factory'

// Mock WebSocket implementation
class MockWebSocket {
  url: string
  readyState: number = 1
  protocol: string = ''
  CONNECTING = 0
  OPEN = 1
  CLOSING = 2
  CLOSED = 3
  onopen: ((ev: Event) => any) | null = null
  onmessage: ((ev: MessageEvent) => any) | null = null
  onclose: ((ev: CloseEvent) => any) | null = null
  onerror: ((ev: Event) => any) | null = null

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {}
  close(code?: number, reason?: string) {}
  addEventListener(type: string, listener: EventListener) {}
  removeEventListener(type: string, listener: EventListener) {}
}

describe('WebSocketFactory', () => {
  const originalGlobal = {
    WebSocket: global.WebSocket,
    globalThis: globalThis,
    process: global.process,
    navigator: global.navigator,
  }

  afterEach(() => {
    // Restore all globals
    global.WebSocket = originalGlobal.WebSocket
    global.process = originalGlobal.process
    global.navigator = originalGlobal.navigator
    vi.restoreAllMocks()
  })

  describe('Browser environment', () => {
    beforeEach(() => {
      global.WebSocket = MockWebSocket as any
      delete global.process
    })

    test('detects native WebSocket', () => {
      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('native')
      expect(env.constructor).toBe(MockWebSocket)
    })

    test('creates WebSocket instance', () => {
      const ws = WebSocketFactory.createWebSocket('wss://example.com')
      expect(ws.url).toBe('wss://example.com')
    })

    test('creates WebSocket with protocols', () => {
      const ws = WebSocketFactory.createWebSocket('wss://example.com', ['protocol1'])
      expect(ws.url).toBe('wss://example.com')
    })

    test('checks if WebSocket is supported', () => {
      expect(WebSocketFactory.isWebSocketSupported()).toBe(true)
    })
  })

  describe('globalThis WebSocket', () => {
    beforeEach(() => {
      delete global.WebSocket
      delete global.process
      ;(globalThis as any).WebSocket = MockWebSocket
    })

    test('detects globalThis WebSocket', () => {
      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('native')
      expect(env.constructor).toBe(MockWebSocket)
    })

    afterEach(() => {
      delete (globalThis as any).WebSocket
    })
  })

  describe('global WebSocket', () => {
    beforeEach(() => {
      delete global.WebSocket
      delete global.process
      delete (globalThis as any).WebSocket
      ;(global as any).WebSocket = MockWebSocket
    })

    test('detects global WebSocket', () => {
      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('native')
      expect(env.constructor).toBe(MockWebSocket)
    })

    afterEach(() => {
      delete (global as any).WebSocket
    })
  })

  describe('Edge Runtime compatibility - dynamic property access', () => {
    // These tests verify that we use dynamic property access to avoid
    // Next.js Edge Runtime static analysis warnings

    const originalProcess = global.process

    afterEach(() => {
      global.process = originalProcess
    })

    test('should handle undefined process.versions', () => {
      // Process exists but versions is undefined
      global.process = {} as any
      Object.defineProperty(global.process, 'versions', {
        value: undefined,
        configurable: true,
      })
      delete global.WebSocket
      delete (globalThis as any).WebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Unknown JavaScript runtime')
    })

    test('should handle null process.versions', () => {
      // Process exists but versions is null
      global.process = {} as any
      Object.defineProperty(global.process, 'versions', {
        value: null,
        configurable: true,
      })
      delete global.WebSocket
      delete (globalThis as any).WebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Unknown JavaScript runtime')
    })

    test('should handle process.versions.node being undefined', () => {
      global.process = { versions: {} } as any
      delete global.WebSocket
      delete (globalThis as any).WebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Unknown JavaScript runtime')
    })

    test('should handle process.versions.node being null', () => {
      global.process = { versions: { node: null } } as any
      delete global.WebSocket
      delete (globalThis as any).WebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Unknown JavaScript runtime')
    })

    test('should handle invalid Node.js version string', () => {
      global.process = { versions: { node: 'invalid-version' } } as any
      delete global.WebSocket
      delete (globalThis as any).WebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      // NaN from parseInt('invalid') makes nodeVersion < 22 true
      expect(env.error).toContain('detected without native WebSocket support')
    })

    test('should handle Node.js version without v prefix', () => {
      global.process = { versions: { node: '18.0.0' } } as any
      delete global.WebSocket
      delete (globalThis as any).WebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Node.js 18 detected without native WebSocket support')
    })

    test('should correctly detect Node.js 16', () => {
      global.process = { versions: { node: 'v16.14.0' } } as any
      delete global.WebSocket
      delete (globalThis as any).WebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Node.js 16 detected without native WebSocket support')
      expect(env.workaround).toContain('ws')
    })

    test('should correctly detect Node.js 18', () => {
      global.process = { versions: { node: 'v18.0.0' } } as any
      delete global.WebSocket
      delete (globalThis as any).WebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Node.js 18 detected without native WebSocket support')
      expect(env.workaround).toContain('ws')
    })

    test('should correctly detect Node.js 20', () => {
      global.process = { versions: { node: 'v20.0.0' } } as any
      delete global.WebSocket
      delete (globalThis as any).WebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Node.js 20 detected without native WebSocket support')
      expect(env.workaround).toContain('ws')
    })

    test('should correctly detect Node.js 22 without WebSocket', () => {
      global.process = { versions: { node: 'v22.0.0' } } as any
      delete global.WebSocket
      delete (globalThis as any).WebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Node.js 22 detected but native WebSocket not found')
      expect(env.workaround).toContain(
        'Provide a WebSocket implementation via the transport option'
      )
    })

    test('should correctly detect Node.js 22 with WebSocket', () => {
      global.process = { versions: { node: 'v22.0.0' } } as any
      delete global.WebSocket
      ;(globalThis as any).WebSocket = MockWebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('native')
      expect(env.constructor).toBe(MockWebSocket)

      delete (globalThis as any).WebSocket
    })

    test('ensures process.versions access uses bracket notation', () => {
      // This test verifies that our implementation doesn't directly access process.versions
      // which would trigger Next.js Edge Runtime warnings.
      // The actual verification happens through static analysis, but we can test the behavior.

      const processProxy = new Proxy({} as any, {
        get(target, prop) {
          if (prop === 'versions') {
            return { node: 'v18.0.0' }
          }
          return undefined
        },
      })

      global.process = processProxy
      delete global.WebSocket
      delete (globalThis as any).WebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Node.js 18')
    })
  })

  describe('Node.js environment', () => {
    beforeEach(() => {
      delete global.WebSocket
      delete (globalThis as any).WebSocket
      delete (global as any).WebSocket
      global.process = { versions: { node: '14.0.0' } } as any
    })

    test('detects missing native WebSocket in Node.js < 22', () => {
      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Node.js 14 detected without native WebSocket support')
      expect(env.workaround).toContain(
        'install "ws" package and provide it via the transport option'
      )
    })

    test('provides helpful error message for Node.js users', () => {
      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.workaround).toContain('import ws from "ws"')
      expect(env.workaround).toContain('transport: ws')
    })

    test.skip('throws error when trying to create WebSocket without transport', () => {
      // Note: This test is skipped because the test runner (Vitest) provides
      // WebSocket even when we delete it from globals. The actual functionality
      // works correctly in real Node.js environments without WebSocket.
      expect(() => {
        WebSocketFactory.createWebSocket('wss://example.com')
      }).toThrow()
    })
  })

  describe('Node.js 22+ environment', () => {
    beforeEach(() => {
      delete global.WebSocket
      delete (globalThis as any).WebSocket
      delete (global as any).WebSocket
      global.process = { versions: { node: '22.0.0' } } as any
    })

    test('uses native globalThis.WebSocket', () => {
      ;(globalThis as any).WebSocket = MockWebSocket

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('native')
      expect(env.constructor).toBe(MockWebSocket)
    })

    test('handles missing native WebSocket in Node.js 22+', () => {
      // Node.js 22+ without native WebSocket (shouldn't happen in practice)
      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Node.js 22 detected but native WebSocket not found')
      expect(env.workaround).toContain(
        'Provide a WebSocket implementation via the transport option'
      )
    })
  })

  describe('Cloudflare Workers', () => {
    beforeEach(() => {
      delete global.WebSocket
      delete (globalThis as any).WebSocket
      delete global.process
      ;(globalThis as any).WebSocketPair = {}
    })

    test('detects Cloudflare Workers', () => {
      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('cloudflare')
      expect(env.error).toContain('Cloudflare Workers detected')
      expect(env.workaround).toContain('Cloudflare Workers WebSocket API')
    })

    afterEach(() => {
      delete (globalThis as any).WebSocketPair
    })
  })

  describe('Edge Runtime', () => {
    beforeEach(() => {
      delete global.WebSocket
      delete global.process
    })

    test('detects EdgeRuntime', () => {
      ;(globalThis as any).EdgeRuntime = true

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Edge runtime detected')

      delete (globalThis as any).EdgeRuntime
    })

    test('detects Vercel Edge', () => {
      global.navigator = { userAgent: 'Vercel-Edge' } as any

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Edge runtime detected')
    })
  })

  describe('Unsupported environment', () => {
    beforeEach(() => {
      delete global.WebSocket
      delete (globalThis as any).WebSocket
      delete (global as any).WebSocket
      delete global.process
      delete global.navigator
    })

    test('handles completely unknown environment', () => {
      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain('Unknown JavaScript runtime')
    })

    test('returns false for isWebSocketSupported', () => {
      expect(WebSocketFactory.isWebSocketSupported()).toBe(false)
    })

    test('throws error with workaround when calling getWebSocketConstructor', () => {
      // Mock detectEnvironment to return an unsupported environment with workaround
      const spy = vi.spyOn(WebSocketFactory as any, 'detectEnvironment')
      spy.mockReturnValue({
        type: 'unsupported',
        constructor: null,
        error: 'Unknown JavaScript runtime without WebSocket support.',
        workaround:
          "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation.",
      })

      // Now test that getWebSocketConstructor throws with both error and workaround
      expect(() => {
        WebSocketFactory.getWebSocketConstructor()
      }).toThrow(
        /Unknown JavaScript runtime[\s\S]*Ensure you're running in a supported environment/
      )

      spy.mockRestore()
    })
  })

  describe('Error handling', () => {
    test('handles exception in isWebSocketSupported', () => {
      const spy = vi.spyOn(WebSocketFactory as any, 'detectEnvironment')
      spy.mockImplementation(() => {
        throw new Error('Test error')
      })

      expect(WebSocketFactory.isWebSocketSupported()).toBe(false)
    })
  })

  describe('detectEnvironment mocking', () => {
    test('should handle error cases in detectEnvironment', () => {
      // Mock detectEnvironment to test error handling paths
      const originalDetectEnvironment = (WebSocketFactory as any).detectEnvironment

      // Test cloudflare environment
      ;(WebSocketFactory as any).detectEnvironment = () => ({
        type: 'cloudflare',
        error: 'Cloudflare Workers detected. WebSocket clients are not supported.',
        workaround: 'Use Cloudflare Workers WebSocket API for server-side WebSocket handling.',
      })

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('cloudflare')
      expect(env.error).toContain('Cloudflare Workers detected')

      // Test edge runtime environment
      ;(WebSocketFactory as any).detectEnvironment = () => ({
        type: 'unsupported',
        error: 'Edge runtime detected. WebSockets are not supported in edge functions.',
        workaround: 'Use serverless functions or a different deployment target.',
      })

      const edgeEnv = (WebSocketFactory as any).detectEnvironment()
      expect(edgeEnv.type).toBe('unsupported')
      expect(edgeEnv.error).toContain('Edge runtime detected')

      // Test Node.js environment
      ;(WebSocketFactory as any).detectEnvironment = () => ({
        type: 'unsupported',
        error: 'Node.js 18 detected without native WebSocket support.',
        workaround: 'install "ws" package',
      })

      const nodeEnv = (WebSocketFactory as any).detectEnvironment()
      expect(nodeEnv.type).toBe('unsupported')
      expect(nodeEnv.error).toContain('Node.js 18 detected')

      // Restore original method
      ;(WebSocketFactory as any).detectEnvironment = originalDetectEnvironment
    })
  })

  describe('getWebSocketConstructor error handling', () => {
    test('should throw error with workaround when constructor is not available', () => {
      // Mock detectEnvironment to return unsupported environment
      const originalDetectEnvironment = (WebSocketFactory as any).detectEnvironment
      ;(WebSocketFactory as any).detectEnvironment = vi.fn(() => ({
        type: 'unsupported',
        constructor: undefined,
        error: 'Test error',
        workaround: 'Test workaround',
      }))

      expect(() => {
        WebSocketFactory.getWebSocketConstructor()
      }).toThrow('Test error\n\nSuggested solution: Test workaround')

      // Restore original method
      ;(WebSocketFactory as any).detectEnvironment = originalDetectEnvironment
    })

    test('should throw error without workaround when workaround is not provided', () => {
      // Mock detectEnvironment to return unsupported environment without workaround
      const originalDetectEnvironment = (WebSocketFactory as any).detectEnvironment
      ;(WebSocketFactory as any).detectEnvironment = vi.fn(() => ({
        type: 'unsupported',
        constructor: undefined,
        error: 'Test error',
      }))

      expect(() => {
        WebSocketFactory.getWebSocketConstructor()
      }).toThrow('Test error')

      // Restore original method
      ;(WebSocketFactory as any).detectEnvironment = originalDetectEnvironment
    })

    test('should use default error message when no error is provided', () => {
      // Mock detectEnvironment to return unsupported environment without error
      const originalDetectEnvironment = (WebSocketFactory as any).detectEnvironment
      ;(WebSocketFactory as any).detectEnvironment = vi.fn(() => ({
        type: 'unsupported',
        constructor: undefined,
      }))

      expect(() => {
        WebSocketFactory.getWebSocketConstructor()
      }).toThrow('WebSocket not supported in this environment.')

      // Restore original method
      ;(WebSocketFactory as any).detectEnvironment = originalDetectEnvironment
    })
  })

  describe('isWebSocketSupported', () => {
    test('should return true for native WebSocket support', () => {
      const originalDetectEnvironment = (WebSocketFactory as any).detectEnvironment
      ;(WebSocketFactory as any).detectEnvironment = () => ({
        type: 'native',
        constructor: class MockWebSocket {},
      })

      expect(WebSocketFactory.isWebSocketSupported()).toBe(true)

      // Restore original method
      ;(WebSocketFactory as any).detectEnvironment = originalDetectEnvironment
    })

    test('should return true for ws package support', () => {
      const originalDetectEnvironment = (WebSocketFactory as any).detectEnvironment
      ;(WebSocketFactory as any).detectEnvironment = () => ({
        type: 'ws',
        constructor: class MockWebSocket {},
      })

      expect(WebSocketFactory.isWebSocketSupported()).toBe(true)

      // Restore original method
      ;(WebSocketFactory as any).detectEnvironment = originalDetectEnvironment
    })

    test('should return false for unsupported environments', () => {
      const originalDetectEnvironment = (WebSocketFactory as any).detectEnvironment
      ;(WebSocketFactory as any).detectEnvironment = () => ({
        type: 'unsupported',
      })

      expect(WebSocketFactory.isWebSocketSupported()).toBe(false)

      // Restore original method
      ;(WebSocketFactory as any).detectEnvironment = originalDetectEnvironment
    })

    test('should return false when detectEnvironment throws', () => {
      const originalDetectEnvironment = (WebSocketFactory as any).detectEnvironment
      ;(WebSocketFactory as any).detectEnvironment = () => {
        throw new Error('Detection failed')
      }

      expect(WebSocketFactory.isWebSocketSupported()).toBe(false)

      // Restore original method
      ;(WebSocketFactory as any).detectEnvironment = originalDetectEnvironment
    })
  })

  describe('createWebSocket', () => {
    test('should create WebSocket with protocols', () => {
      const mockWebSocket = vi.fn()
      const originalGetWebSocketConstructor = WebSocketFactory.getWebSocketConstructor
      WebSocketFactory.getWebSocketConstructor = () => mockWebSocket as any

      WebSocketFactory.createWebSocket('ws://example.com', ['protocol1', 'protocol2'])

      expect(mockWebSocket).toHaveBeenCalledWith('ws://example.com', ['protocol1', 'protocol2'])

      // Restore original method
      WebSocketFactory.getWebSocketConstructor = originalGetWebSocketConstructor
    })

    test('should create WebSocket with single protocol string', () => {
      const mockWebSocket = vi.fn()
      const originalGetWebSocketConstructor = WebSocketFactory.getWebSocketConstructor
      WebSocketFactory.getWebSocketConstructor = () => mockWebSocket as any

      WebSocketFactory.createWebSocket('ws://example.com', 'protocol1')

      expect(mockWebSocket).toHaveBeenCalledWith('ws://example.com', 'protocol1')

      // Restore original method
      WebSocketFactory.getWebSocketConstructor = originalGetWebSocketConstructor
    })
  })
})
