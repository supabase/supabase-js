import WebSocketFactory, { WebSocketLike } from './lib/websocket-factory'

import {
  CHANNEL_EVENTS,
  CONNECTION_STATE,
  DEFAULT_VERSION,
  DEFAULT_TIMEOUT,
  DEFAULT_VSN,
  VSN_1_0_0,
  VSN_2_0_0,
} from './lib/constants'

import Serializer from './lib/serializer'
import { httpEndpointURL } from './lib/transformers'
import RealtimeChannel from './RealtimeChannel'
import type { RealtimeChannelOptions } from './RealtimeChannel'
import SocketAdapter from './phoenix/socketAdapter'
import type {
  Message,
  SocketOptions,
  HeartbeatCallback,
  Encode,
  Decode,
  Vsn,
} from './phoenix/types'

type Fetch = typeof fetch

export type LogLevel = 'info' | 'warn' | 'error'

export type RealtimeMessage = {
  topic: string
  event: string
  payload: any
  ref: string
  join_ref?: string
}

export type RealtimeRemoveChannelResponse = 'ok' | 'timed out' | 'error'
export type HeartbeatStatus = 'sent' | 'ok' | 'error' | 'timeout' | 'disconnected'
export type HeartbeatTimer = ReturnType<typeof setTimeout> | undefined

// Connection-related constants
const CONNECTION_TIMEOUTS = {
  HEARTBEAT_INTERVAL: 25000,
  RECONNECT_DELAY: 10,
  HEARTBEAT_TIMEOUT_FALLBACK: 100,
} as const

const RECONNECT_INTERVALS = [1000, 2000, 5000, 10000] as const
const DEFAULT_RECONNECT_FALLBACK = 10000

/**
 * Minimal WebSocket constructor interface that RealtimeClient can work with.
 * Supply a compatible implementation (native WebSocket, `ws`, etc) when running outside the browser.
 */
export interface WebSocketLikeConstructor {
  new (address: string | URL, subprotocols?: string | string[] | undefined): WebSocketLike
  // Allow additional properties that may exist on WebSocket constructors
  [key: string]: any
}

export type RealtimeClientOptions = {
  transport?: WebSocketLikeConstructor
  timeout?: number
  heartbeatIntervalMs?: number
  heartbeatCallback?: (status: HeartbeatStatus, latency?: number) => void
  vsn?: Vsn
  logger?: (kind: string, msg: string, data?: any) => void
  encode?: Encode<void>
  decode?: Decode<void>
  reconnectAfterMs?: (tries: number) => number
  headers?: { [key: string]: string }
  params?: { [key: string]: any }
  //Deprecated: Use it in favour of correct casing `logLevel`
  log_level?: LogLevel
  logLevel?: LogLevel
  fetch?: Fetch
  worker?: boolean
  workerUrl?: string
  accessToken?: () => Promise<string | null>
}

const WORKER_SCRIPT = `
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`

export default class RealtimeClient {
  socketAdapter: SocketAdapter
  channels: RealtimeChannel[] = new Array()

  accessTokenValue: string | null = null
  accessToken: (() => Promise<string | null>) | null = null
  apiKey: string | null = null

  httpEndpoint: string = ''
  /** @deprecated headers cannot be set on websocket connections */
  headers?: { [key: string]: string } = {}
  params?: { [key: string]: string } = {}

  ref: number = 0

  logLevel?: LogLevel

  fetch: Fetch
  worker?: boolean
  workerUrl?: string
  workerRef?: Worker

  serializer: Serializer = new Serializer()

  get endPoint() {
    return this.socketAdapter.endPoint
  }

  get timeout() {
    return this.socketAdapter.timeout
  }

  get transport() {
    return this.socketAdapter.transport
  }

  get heartbeatCallback() {
    return this.socketAdapter.heartbeatCallback
  }

  get heartbeatIntervalMs() {
    return this.socketAdapter.heartbeatIntervalMs
  }

  get heartbeatTimer() {
    if (this.worker) {
      return this._workerHeartbeatTimer
    }
    return this.socketAdapter.heartbeatTimer
  }

  get pendingHeartbeatRef() {
    if (this.worker) {
      return this._pendingWorkerHeartbeatRef
    }
    return this.socketAdapter.pendingHeartbeatRef
  }

  get reconnectTimer() {
    return this.socketAdapter.reconnectTimer
  }

  get vsn() {
    return this.socketAdapter.vsn
  }

  get encode() {
    return this.socketAdapter.encode
  }

  get decode() {
    return this.socketAdapter.decode
  }

  get reconnectAfterMs() {
    return this.socketAdapter.reconnectAfterMs
  }

  get sendBuffer() {
    return this.socketAdapter.sendBuffer
  }

  get stateChangeCallbacks(): {
    open: [string, Function][]
    close: [string, Function][]
    error: [string, Function][]
    message: [string, Function][]
  } {
    return this.socketAdapter.stateChangeCallbacks
  }

  private _manuallySetToken: boolean = false
  private _authPromise: Promise<void> | null = null
  private _workerHeartbeatTimer: HeartbeatTimer = undefined
  private _pendingWorkerHeartbeatRef: string | null = null

  /**
   * Initializes the Socket.
   *
   * @param endPoint The string WebSocket endpoint, ie, "ws://example.com/socket", "wss://example.com", "/socket" (inherited host & protocol)
   * @param httpEndpoint The string HTTP endpoint, ie, "https://example.com", "/" (inherited host & protocol)
   * @param options.transport The Websocket Transport, for example WebSocket. This can be a custom implementation
   * @param options.timeout The default timeout in milliseconds to trigger push timeouts.
   * @param options.params The optional params to pass when connecting.
   * @param options.headers Deprecated: headers cannot be set on websocket connections and this option will be removed in the future.
   * @param options.heartbeatIntervalMs The millisec interval to send a heartbeat message.
   * @param options.heartbeatCallback The optional function to handle heartbeat status and latency.
   * @param options.logger The optional function for specialized logging, ie: logger: (kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }
   * @param options.logLevel Sets the log level for Realtime
   * @param options.encode The function to encode outgoing messages. Defaults to JSON: (payload, callback) => callback(JSON.stringify(payload))
   * @param options.decode The function to decode incoming messages. Defaults to Serializer's decode.
   * @param options.reconnectAfterMs he optional function that returns the millsec reconnect interval. Defaults to stepped backoff off.
   * @param options.worker Use Web Worker to set a side flow. Defaults to false.
   * @param options.workerUrl The URL of the worker script. Defaults to https://realtime.supabase.com/worker.js that includes a heartbeat event call to keep the connection alive.
   * @param options.vsn The protocol version to use when connecting. Supported versions are "1.0.0" and "2.0.0". Defaults to "2.0.0".
   * @example
   * ```ts
   * import RealtimeClient from '@supabase/realtime-js'
   *
   * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
   *   params: { apikey: 'public-anon-key' },
   * })
   * client.connect()
   * ```
   */
  constructor(endPoint: string, options?: RealtimeClientOptions) {
    // Validate required parameters
    if (!options?.params?.apikey) {
      throw new Error('API key is required to connect to Realtime')
    }
    this.apiKey = options.params.apikey

    const socketAdapterOptions = this._initializeOptions(options)

    this.socketAdapter = new SocketAdapter(endPoint, socketAdapterOptions)
    this.httpEndpoint = httpEndpointURL(endPoint)

    this.fetch = this._resolveFetch(options?.fetch)
  }

  /**
   * Connects the socket, unless already connected.
   */
  connect(): void {
    // Skip if already connecting, disconnecting, or connected
    if (this.isConnecting() || this.isDisconnecting() || this.isConnected()) {
      return
    }

    // Trigger auth if needed and not already in progress
    // This ensures auth is called for standalone RealtimeClient usage
    // while avoiding race conditions with SupabaseClient's immediate setAuth call
    if (this.accessToken && !this._authPromise) {
      this._setAuthSafely('connect')
    }

    this._setupConnectionHandlers()

    try {
      this.socketAdapter.connect()
    } catch (error) {
      const errorMessage = (error as Error).message

      // Provide helpful error message based on environment
      if (errorMessage.includes('Node.js')) {
        throw new Error(
          `${errorMessage}\n\n` +
            'To use Realtime in Node.js, you need to provide a WebSocket implementation:\n\n' +
            'Option 1: Use Node.js 22+ which has native WebSocket support\n' +
            'Option 2: Install and provide the "ws" package:\n\n' +
            '  npm install ws\n\n' +
            '  import ws from "ws"\n' +
            '  const client = new RealtimeClient(url, {\n' +
            '    ...options,\n' +
            '    transport: ws\n' +
            '  })'
        )
      }
      throw new Error(`WebSocket not available: ${errorMessage}`)
    }

    this._handleNodeJsRaceCondition()
  }

  /**
   * Returns the URL of the websocket.
   * @returns string The URL of the websocket.
   */
  endpointURL(): string {
    return this.socketAdapter.endPointURL()
  }

  /**
   * Disconnects the socket.
   *
   * @param code A numeric status code to send on disconnect.
   * @param reason A custom reason for the disconnect.
   */
  async disconnect(code?: number, reason?: string) {
    if (this.isDisconnecting()) {
      return 'ok'
    }
    return await this.socketAdapter.disconnect(
      () => {
        clearInterval(this._workerHeartbeatTimer)
        this._terminateWorker()
      },
      code,
      reason
    )
  }

  /**
   * Returns all created channels
   */
  getChannels(): RealtimeChannel[] {
    return this.channels
  }

  /**
   * Unsubscribes and removes a single channel
   * @param channel A RealtimeChannel instance
   */
  async removeChannel(channel: RealtimeChannel): Promise<RealtimeRemoveChannelResponse> {
    const status = await channel.unsubscribe()

    if (status === 'ok') {
      channel.teardown()
    }

    if (this.channels.length === 0) {
      this.disconnect()
    }

    return status
  }

  /**
   * Unsubscribes and removes all channels
   */
  async removeAllChannels(): Promise<RealtimeRemoveChannelResponse[]> {
    const promises = this.channels.map(async (channel) => {
      const result = await channel.unsubscribe()
      channel.teardown()
      return result
    })

    const result = await Promise.all(promises)
    this.disconnect()
    return result
  }

  /**
   * Logs the message.
   *
   * For customized logging, `this.logger` can be overridden in Client constructor.
   */
  log(kind: string, msg: string, data?: any) {
    this.socketAdapter.log(kind, msg, data)
  }

  /**
   * Returns the current state of the socket.
   */
  connectionState() {
    return this.socketAdapter.connectionState() || CONNECTION_STATE.closed
  }

  /**
   * Returns `true` is the connection is open.
   */
  isConnected(): boolean {
    return this.socketAdapter.isConnected()
  }

  /**
   * Returns `true` if the connection is currently connecting.
   */
  isConnecting(): boolean {
    return this.socketAdapter.isConnecting()
  }

  /**
   * Returns `true` if the connection is currently disconnecting.
   */
  isDisconnecting(): boolean {
    return this.socketAdapter.isDisconnecting()
  }

  /**
   * Creates (or reuses) a {@link RealtimeChannel} for the provided topic.
   *
   * Topics are automatically prefixed with `realtime:` to match the Realtime service.
   * If a channel with the same topic already exists it will be returned instead of creating
   * a duplicate connection.
   */
  channel(topic: string, params: RealtimeChannelOptions = { config: {} }): RealtimeChannel {
    const realtimeTopic = `realtime:${topic}`
    const exists = this.getChannels().find((c: RealtimeChannel) => c.topic === realtimeTopic)

    if (!exists) {
      const chan = new RealtimeChannel(`realtime:${topic}`, params, this)
      this.channels.push(chan)

      return chan
    } else {
      return exists
    }
  }

  /**
   * Push out a message if the socket is connected.
   *
   * If the socket is not connected, the message gets enqueued within a local buffer, and sent out when a connection is next established.
   */
  push(data: RealtimeMessage): void {
    this.socketAdapter.push(data)
  }

  /**
   * Sets the JWT access token used for channel subscription authorization and Realtime RLS.
   *
   * If param is null it will use the `accessToken` callback function or the token set on the client.
   *
   * On callback used, it will set the value of the token internal to the client.
   *
   * When a token is explicitly provided, it will be preserved across channel operations
   * (including removeChannel and resubscribe). The `accessToken` callback will not be
   * invoked until `setAuth()` is called without arguments.
   *
   * @param token A JWT string to override the token set on the client.
   *
   * @example
   * // Use a manual token (preserved across resubscribes, ignores accessToken callback)
   * client.realtime.setAuth('my-custom-jwt')
   *
   * // Switch back to using the accessToken callback
   * client.realtime.setAuth()
   */
  async setAuth(token: string | null = null): Promise<void> {
    this._authPromise = this._performAuth(token)
    try {
      await this._authPromise
    } finally {
      this._authPromise = null
    }
  }

  /**
   * Returns true if the current access token was explicitly set via setAuth(token),
   * false if it was obtained via the accessToken callback.
   * @internal
   */
  _isManualToken(): boolean {
    return this._manuallySetToken
  }

  /**
   * Sends a heartbeat message if the socket is connected.
   */
  async sendHeartbeat() {
    this.socketAdapter.sendHeartbeat()
  }

  /**
   * Sets a callback that receives lifecycle events for internal heartbeat messages.
   * Useful for instrumenting connection health (e.g. sent/ok/timeout/disconnected).
   */
  onHeartbeat(callback: HeartbeatCallback) {
    this.socketAdapter.heartbeatCallback = this._wrapHeartbeatCallback(callback)
  }

  /**
   * Use either custom fetch, if provided, or default fetch to make HTTP requests
   *
   * @internal
   */
  _resolveFetch = (customFetch?: Fetch): Fetch => {
    if (customFetch) {
      return (...args) => customFetch(...args)
    }
    return (...args) => fetch(...args)
  }

  /**
   * Return the next message ref, accounting for overflows
   *
   * @internal
   */
  _makeRef(): string {
    return this.socketAdapter.makeRef()
  }

  /**
   * Removes a channel from RealtimeClient
   *
   * @param channel An open subscription.
   *
   * @internal
   */
  _remove(channel: RealtimeChannel) {
    this.channels = this.channels.filter((c) => c.topic !== channel.topic)
  }

  /**
   * Perform the actual auth operation
   * @internal
   */
  private async _performAuth(token: string | null = null): Promise<void> {
    let tokenToSend: string | null
    let isManualToken = false

    if (token) {
      tokenToSend = token
      // Track if this is a manually-provided token
      isManualToken = true
    } else if (this.accessToken) {
      // Call the accessToken callback to get fresh token
      try {
        tokenToSend = await this.accessToken()
      } catch (e) {
        this.log('error', 'Error fetching access token from callback', e)
        // Fall back to cached value if callback fails
        tokenToSend = this.accessTokenValue
      }
    } else {
      tokenToSend = this.accessTokenValue
    }

    // Track whether this token was manually set or fetched via callback
    if (isManualToken) {
      this._manuallySetToken = true
    } else if (this.accessToken) {
      // If we used the callback, clear the manual flag
      this._manuallySetToken = false
    }

    if (this.accessTokenValue != tokenToSend) {
      this.accessTokenValue = tokenToSend
      this.channels.forEach((channel) => {
        const payload = {
          access_token: tokenToSend,
          version: DEFAULT_VERSION,
        }

        tokenToSend && channel.updateJoinPayload(payload)

        if (channel.joinedOnce && channel.channelAdapter.isJoined()) {
          channel.channelAdapter.push(CHANNEL_EVENTS.access_token, {
            access_token: tokenToSend,
          })
        }
      })
    }
  }

  /**
   * Wait for any in-flight auth operations to complete
   * @internal
   */
  private async _waitForAuthIfNeeded(): Promise<void> {
    if (this._authPromise) {
      await this._authPromise
    }
  }

  /**
   * Safely call setAuth with standardized error handling
   * @internal
   */
  private _setAuthSafely(context = 'general'): void {
    // Only refresh auth if using callback-based tokens
    if (!this._isManualToken()) {
      this.setAuth().catch((e) => {
        this.log('error', `Error setting auth in ${context}`, e)
      })
    }
  }

  private _setupConnectionHandlers(): void {
    this.socketAdapter.onOpen(() => {
      const authPromise =
        this._authPromise ||
        (this.accessToken && !this.accessTokenValue ? this.setAuth() : Promise.resolve())

      authPromise.catch((e) => {
        this.log('error', 'error waiting for auth on connect', e)
      })

      if (this.worker && !this.workerRef) {
        this._startWorkerHeartbeat()
      }
    })
    this.socketAdapter.onClose(() => {
      if (this.worker && this.workerRef) {
        this._terminateWorker()
      }
    })
    this.socketAdapter.onMessage((message: Message<any>) => {
      if (message.ref && message.ref === this._pendingWorkerHeartbeatRef) {
        this._pendingWorkerHeartbeatRef = null
      }
    })
  }

  private _handleNodeJsRaceCondition() {
    if (this.socketAdapter.isConnected()) {
      // hack: ensure onConnOpen is called
      this.socketAdapter.getSocket().onConnOpen()
    }
  }

  private _wrapHeartbeatCallback(heartbeatCallback?: HeartbeatCallback) {
    return (status: HeartbeatStatus) => {
      if (status == 'sent') this._setAuthSafely()
      if (heartbeatCallback) heartbeatCallback(status)
    }
  }

  /** @internal */
  private _startWorkerHeartbeat() {
    if (this.workerUrl) {
      this.log('worker', `starting worker for from ${this.workerUrl}`)
    } else {
      this.log('worker', `starting default worker`)
    }
    const objectUrl = this._workerObjectUrl(this.workerUrl!)
    this.workerRef = new Worker(objectUrl)
    this.workerRef.onerror = (error) => {
      this.log('worker', 'worker error', (error as ErrorEvent).message)
      this._terminateWorker()
      this.disconnect()
    }
    this.workerRef.onmessage = (event) => {
      if (event.data.event === 'keepAlive') {
        this.sendHeartbeat()
      }
    }
    this.workerRef.postMessage({
      event: 'start',
      interval: this.heartbeatIntervalMs,
    })
  }

  /**
   * Terminate the Web Worker and clear the reference
   * @internal
   */
  private _terminateWorker(): void {
    if (this.workerRef) {
      this.log('worker', 'terminating worker')
      this.workerRef.terminate()
      this.workerRef = undefined
    }
  }

  /** @internal */
  private _workerObjectUrl(url: string | undefined): string {
    let result_url: string
    if (url) {
      result_url = url
    } else {
      const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' })
      result_url = URL.createObjectURL(blob)
    }
    return result_url
  }

  private async _reconnectAuth() {
    await this._waitForAuthIfNeeded()
    if (!this.isConnected()) {
      this.connect()
    }
  }

  /**
   * Initialize socket options with defaults
   * @internal
   */
  private _initializeOptions(options?: RealtimeClientOptions): SocketOptions {
    this.worker = options?.worker ?? false
    this.accessToken = options?.accessToken ?? null

    const result: SocketOptions = {}
    result.timeout = options?.timeout ?? DEFAULT_TIMEOUT
    result.heartbeatIntervalMs =
      options?.heartbeatIntervalMs ?? CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL
    result.vsn = options?.vsn ?? DEFAULT_VSN
    // @ts-ignore - mismatch between phoenix and supabase
    result.transport = options?.transport ?? WebSocketFactory.getWebSocketConstructor()
    result.params = options?.params
    result.logger = options?.logger
    result.heartbeatCallback = this._wrapHeartbeatCallback(options?.heartbeatCallback)
    result.reconnectAfterMs =
      options?.reconnectAfterMs ??
      ((tries: number) => {
        return RECONNECT_INTERVALS[tries - 1] || DEFAULT_RECONNECT_FALLBACK
      })

    let defaultEncode: Encode<void>
    let defaultDecode: Decode<void>

    switch (result.vsn) {
      case VSN_1_0_0:
        defaultEncode = (payload, callback) => {
          return callback(JSON.stringify(payload))
        }
        defaultDecode = (payload, callback) => {
          return callback(JSON.parse(payload as string))
        }
        break
      case VSN_2_0_0:
        defaultEncode = this.serializer.encode.bind(this.serializer)
        defaultDecode = this.serializer.decode.bind(this.serializer)
        break
      default:
        throw new Error(`Unsupported serializer version: ${result.vsn}`)
    }

    result.encode = options?.encode ?? defaultEncode
    result.decode = options?.decode ?? defaultDecode

    result.beforeReconnect = this._reconnectAuth.bind(this)

    if (options?.logLevel || options?.log_level) {
      this.logLevel = options.logLevel || options.log_level
      result.params = { ...result.params, log_level: this.logLevel as string }
    }

    // Handle worker setup
    if (this.worker) {
      if (typeof window !== 'undefined' && !window.Worker) {
        throw new Error('Web Worker is not supported')
      }
      this.workerUrl = options?.workerUrl
      result.autoSendHeartbeat = !this.worker
    }

    return result
  }
}
