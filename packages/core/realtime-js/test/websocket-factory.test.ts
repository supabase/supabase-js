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
      const ws = WebSocketFactory.createWebSocket('wss://example.com', [
        'protocol1',
      ])
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

  describe('Node.js environment', () => {
    beforeEach(() => {
      delete global.WebSocket
      delete (globalThis as any).WebSocket
      delete (global as any).WebSocket
      global.process = { versions: { node: '14.0.0' } } as any
    })

    test('detects ws package', () => {
      const spy = vi.spyOn(WebSocketFactory as any, 'dynamicRequire')
      spy.mockReturnValue(MockWebSocket)

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('ws')
      expect(env.constructor).toBe(MockWebSocket)
    })

    test('handles missing ws package', () => {
      const spy = vi.spyOn(WebSocketFactory as any, 'dynamicRequire')
      spy.mockReturnValue(null)

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain(
        'Node.js 14 detected without WebSocket support'
      )
      expect(env.workaround).toContain('Install the "ws" package')
    })

    test('handles ws package with WebSocket property', () => {
      const spy = vi.spyOn(WebSocketFactory as any, 'dynamicRequire')
      spy.mockReturnValue({ WebSocket: MockWebSocket })

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('ws')
      expect(env.constructor).toBe(MockWebSocket)
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

    test('falls back to undici', () => {
      const spy = vi.spyOn(WebSocketFactory as any, 'dynamicRequire')
      spy.mockReturnValue({ WebSocket: MockWebSocket })

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('native')
      expect(env.constructor).toBe(MockWebSocket)
    })

    test('handles missing undici', () => {
      const spy = vi.spyOn(WebSocketFactory as any, 'dynamicRequire')
      spy.mockReturnValue(null)

      const env = (WebSocketFactory as any).detectEnvironment()
      expect(env.type).toBe('unsupported')
      expect(env.error).toContain(
        'Node.js 22 detected but native WebSocket not found'
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

  describe('dynamicRequire', () => {
    test('returns null when process is undefined', () => {
      delete global.process
      const result = (WebSocketFactory as any).dynamicRequire('test-module')
      expect(result).toBeNull()
    })

    test('returns null when require is undefined', () => {
      global.process = { versions: { node: '14.0.0' } } as any
      // Simulate environment where require is not available
      const originalRequire = global.require
      delete global.require

      const result = (WebSocketFactory as any).dynamicRequire('test-module')
      expect(result).toBeNull()

      global.require = originalRequire
    })

    test('handles require throwing error', () => {
      global.process = { versions: { node: '14.0.0' } } as any
      global.require = vi.fn().mockImplementation(() => {
        throw new Error('Module not found')
      })

      const result = (WebSocketFactory as any).dynamicRequire('test-module')
      expect(result).toBeNull()
    })
  })
})
