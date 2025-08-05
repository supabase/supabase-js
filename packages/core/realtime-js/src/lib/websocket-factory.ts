export interface WebSocketLike {
  readonly CONNECTING: number
  readonly OPEN: number
  readonly CLOSING: number
  readonly CLOSED: number
  readonly readyState: number
  readonly url: string
  readonly protocol: string

  close(code?: number, reason?: string): void
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void

  onopen: ((this: any, ev: Event) => any) | null
  onmessage: ((this: any, ev: MessageEvent) => any) | null
  onclose: ((this: any, ev: CloseEvent) => any) | null
  onerror: ((this: any, ev: Event) => any) | null

  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void

  // Add additional properties that may exist on WebSocket implementations
  binaryType?: string
  bufferedAmount?: number
  extensions?: string
  dispatchEvent?: (event: Event) => boolean
}

export interface WebSocketEnvironment {
  type: 'native' | 'ws' | 'cloudflare' | 'unsupported'
  constructor?: any
  error?: string
  workaround?: string
}

export class WebSocketFactory {
  /**
   * Dynamic require that works in both CJS and ESM environments
   * Bulletproof against strict ESM environments where require might not be in scope
   * @private
   */
  private static dynamicRequire(moduleId: string): any {
    try {
      // Check if we're in a Node.js environment first
      if (
        typeof process !== 'undefined' &&
        process.versions &&
        process.versions.node
      ) {
        // In Node.js, both CJS and ESM support require for dynamic imports
        // Wrap in try/catch to handle strict ESM environments
        if (typeof require !== 'undefined') {
          return require(moduleId)
        }
      }
      return null
    } catch {
      // Catches any error from typeof require OR require() call in strict ESM
      return null
    }
  }

  private static detectEnvironment(): WebSocketEnvironment {
    if (typeof WebSocket !== 'undefined') {
      return { type: 'native', constructor: WebSocket }
    }

    if (
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as any).WebSocket !== 'undefined'
    ) {
      return { type: 'native', constructor: (globalThis as any).WebSocket }
    }

    if (
      typeof global !== 'undefined' &&
      typeof (global as any).WebSocket !== 'undefined'
    ) {
      return { type: 'native', constructor: (global as any).WebSocket }
    }

    if (
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as any).WebSocketPair !== 'undefined' &&
      typeof globalThis.WebSocket === 'undefined'
    ) {
      return {
        type: 'cloudflare',
        error:
          'Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.',
        workaround:
          'Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime.',
      }
    }

    if (
      (typeof globalThis !== 'undefined' && (globalThis as any).EdgeRuntime) ||
      (typeof navigator !== 'undefined' &&
        navigator.userAgent?.includes('Vercel-Edge'))
    ) {
      return {
        type: 'unsupported',
        error:
          'Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.',
        workaround:
          'Use serverless functions or a different deployment target for WebSocket functionality.',
      }
    }

    if (
      typeof process !== 'undefined' &&
      process.versions &&
      process.versions.node
    ) {
      const nodeVersion = parseInt(process.versions.node.split('.')[0])
      if (nodeVersion >= 22) {
        try {
          if (typeof globalThis.WebSocket !== 'undefined') {
            return { type: 'native', constructor: globalThis.WebSocket }
          }
          const undici = this.dynamicRequire('undici')
          if (undici && undici.WebSocket) {
            return { type: 'native', constructor: undici.WebSocket }
          }
          throw new Error('undici not available')
        } catch (err) {
          return {
            type: 'unsupported',
            error: `Node.js ${nodeVersion} detected but native WebSocket not found.`,
            workaround:
              'Install the "ws" package or check your Node.js installation.',
          }
        }
      }
      try {
        // Use dynamic require to work in both CJS and ESM environments
        const ws = this.dynamicRequire('ws')
        if (ws) {
          return { type: 'ws', constructor: ws.WebSocket ?? ws }
        }
        throw new Error('ws package not available')
      } catch (err) {
        return {
          type: 'unsupported',
          error: `Node.js ${nodeVersion} detected without WebSocket support.`,
          workaround: 'Install the "ws" package: npm install ws',
        }
      }
    }

    return {
      type: 'unsupported',
      error: 'Unknown JavaScript runtime without WebSocket support.',
      workaround:
        "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation.",
    }
  }

  public static getWebSocketConstructor(): typeof WebSocket {
    const env = this.detectEnvironment()
    if (env.constructor) {
      return env.constructor
    }
    let errorMessage =
      env.error || 'WebSocket not supported in this environment.'
    if (env.workaround) {
      errorMessage += `\n\nSuggested solution: ${env.workaround}`
    }
    throw new Error(errorMessage)
  }

  public static createWebSocket(
    url: string | URL,
    protocols?: string | string[]
  ): WebSocketLike {
    const WS = this.getWebSocketConstructor()
    return new WS(url, protocols)
  }

  public static isWebSocketSupported(): boolean {
    try {
      const env = this.detectEnvironment()
      return env.type === 'native' || env.type === 'ws'
    } catch {
      return false
    }
  }
}

export default WebSocketFactory
