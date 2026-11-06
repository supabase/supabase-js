export interface WebSocketLike {
  readonly CONNECTING: number
  readonly OPEN: number
  readonly CLOSING: number
  readonly CLOSED: number
  readonly readyState: number
  readonly url: string
  readonly protocol: string

  /**
   * Closes the socket, optionally providing a close code and reason.
   */
  close(code?: number, reason?: string): void
  /**
   * Sends data through the socket using the underlying implementation.
   */
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void

  onopen: ((this: any, ev: Event) => any) | null
  onmessage: ((this: any, ev: MessageEvent) => any) | null
  onclose: ((this: any, ev: CloseEvent) => any) | null
  onerror: ((this: any, ev: Event) => any) | null

  /**
   * Registers an event listener on the socket (compatible with browser WebSocket API).
   */
  addEventListener(type: string, listener: EventListener): void
  /**
   * Removes a previously registered event listener.
   */
  removeEventListener(type: string, listener: EventListener): void

  // Add additional properties that may exist on WebSocket implementations
  binaryType?: string
  bufferedAmount?: number
  extensions?: string
  dispatchEvent?: (event: Event) => boolean
}

export interface WebSocketEnvironment {
  type: 'native' | 'cloudflare' | 'unsupported'
  /** WebSocket constructor for this environment, if available. */
  wsConstructor?: typeof WebSocket
  error?: string
  workaround?: string
}

/**
 * Extended globalThis with optional runtime-specific properties
 * that may or may not exist depending on the environment.
 */
interface RuntimeGlobals {
  WebSocket?: { new (url: string, protocols?: string | string[]): WebSocketLike }
  WebSocketPair?: unknown
  EdgeRuntime?: unknown
  self?: typeof globalThis & RuntimeGlobals
}

type WebSocketScope = typeof globalThis & RuntimeGlobals

/**
 * Utilities for creating WebSocket instances across runtimes.
 */
export class WebSocketFactory {
  /**
   * Static-only utility – prevent instantiation.
   */
  private constructor() {}

  /**
   * Read a WebSocket constructor off a scope object.
   *
   * A bare `WebSocket` identifier and `global.WebSocket` are not reliable in
   * browser bundles: bundlers rewrite `WebSocket`, and `global` is a Node
   * binding that often does not exist (or is a shim without WebSocket).
   * Property access keeps the lookup on the real runtime global.
   */
  private static readWebSocketConstructor(scope?: WebSocketScope): typeof WebSocket | undefined {
    if (!scope) {
      return undefined
    }
    const ctor = scope['WebSocket']
    return typeof ctor === 'function' ? (ctor as typeof WebSocket) : undefined
  }

  private static detectEnvironment(): WebSocketEnvironment {
    const gt = globalThis as WebSocketScope
    // Workers and browsers expose `self` on the global object. A bare `self`
    // identifier is not declared in every runtime this package typechecks in.
    const selfScope = gt.self
    const wsConstructor =
      (typeof globalThis !== 'undefined' ? this.readWebSocketConstructor(gt) : undefined) ||
      (typeof window !== 'undefined'
        ? this.readWebSocketConstructor(window as typeof window & RuntimeGlobals)
        : undefined) ||
      this.readWebSocketConstructor(selfScope)

    if (wsConstructor) {
      return { type: 'native', wsConstructor }
    }

    if (
      typeof globalThis !== 'undefined' &&
      typeof gt.WebSocketPair !== 'undefined' &&
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
      (typeof globalThis !== 'undefined' && gt.EdgeRuntime) ||
      (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Vercel-Edge'))
    ) {
      return {
        type: 'unsupported',
        error:
          'Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.',
        workaround:
          'Use serverless functions or a different deployment target for WebSocket functionality.',
      }
    }

    // Use dynamic property access to avoid Next.js Edge Runtime static analysis warnings
    const _process = (globalThis as Record<string, unknown>)['process'] as
      | { versions?: { node?: string } }
      | undefined
    if (_process) {
      const processVersions = _process['versions']
      if (processVersions && processVersions['node']) {
        // Reaching here means an earlier check did not find a native WebSocket,
        // so this Node.js process is missing the global WebSocket (Node.js 22+).
        return {
          type: 'unsupported',
          error: 'Node.js detected but native WebSocket not found.',
          workaround:
            'Ensure you are running Node.js 22+ or provide a WebSocket implementation via the transport option.',
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

  /**
   * Returns the best available WebSocket constructor for the current runtime.
   *
   * @category Realtime
   *
   * @example Example with error handling
   * ```ts
   * try {
   *   const WS = WebSocketFactory.getWebSocketConstructor()
   *   const socket = new WS('wss://example.com/socket')
   * } catch (error) {
   *   console.error('WebSocket not available in this environment.', error)
   * }
   * ```
   */
  public static getWebSocketConstructor(): typeof WebSocket {
    const env = this.detectEnvironment()
    if (env.wsConstructor) {
      return env.wsConstructor
    }
    let errorMessage = env.error || 'WebSocket not supported in this environment.'
    if (env.workaround) {
      errorMessage += `\n\nSuggested solution: ${env.workaround}`
    }
    throw new Error(errorMessage)
  }

  /**
   * Detects whether the runtime can establish WebSocket connections.
   *
   * @category Realtime
   *
   * @example Example in a Node.js script
   * ```ts
   * if (!WebSocketFactory.isWebSocketSupported()) {
   *   console.error('WebSockets are required for this script.')
   *   process.exitCode = 1
   * }
   * ```
   */
  public static isWebSocketSupported(): boolean {
    try {
      const env = this.detectEnvironment()
      return env.type === 'native'
    } catch {
      return false
    }
  }
}

export default WebSocketFactory
