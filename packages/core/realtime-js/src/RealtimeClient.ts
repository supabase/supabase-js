import {
  VSN,
  CHANNEL_EVENTS,
  TRANSPORTS,
  SOCKET_STATES,
  DEFAULT_TIMEOUT,
  WS_CLOSE_NORMAL,
  DEFAULT_HEADERS,
} from './lib/constants'
import Timer from './lib/timer'
import RealtimeSubscription from './RealtimeSubscription'
import { w3cwebsocket as WebSocket } from 'websocket'
import Serializer from './lib/serializer'

export type Options = {
  transport?: WebSocket
  timeout?: number
  heartbeatIntervalMs?: number
  longpollerTimeout?: number
  logger?: Function
  encode?: Function
  decode?: Function
  reconnectAfterMs?: Function
  headers?: { [key: string]: string }
  params?: { [key: string]: string }
}
type Message = {
  topic: string
  event: string
  payload: any
  ref: string
}

const noop = () => {}

export default class RealtimeClient {
  accessToken: string | null = null
  channels: RealtimeSubscription[] = []
  endPoint: string = ''
  headers?: { [key: string]: string } = DEFAULT_HEADERS
  params?: { [key: string]: string } = {}
  timeout: number = DEFAULT_TIMEOUT
  transport: any = WebSocket
  heartbeatIntervalMs: number = 30000
  longpollerTimeout: number = 20000
  heartbeatTimer: ReturnType<typeof setInterval> | undefined = undefined
  pendingHeartbeatRef: string | null = null
  ref: number = 0
  reconnectTimer: Timer
  logger: Function = noop
  encode: Function
  decode: Function
  reconnectAfterMs: Function
  conn: WebSocket | null = null
  sendBuffer: Function[] = []
  serializer: Serializer = new Serializer()
  stateChangeCallbacks: {
    open: Function[]
    close: Function[]
    error: Function[]
    message: Function[]
  } = {
    open: [],
    close: [],
    error: [],
    message: [],
  }

  /**
   * Initializes the Socket
   *
   * @param endPoint The string WebSocket endpoint, ie, "ws://example.com/socket", "wss://example.com", "/socket" (inherited host & protocol)
   * @param options.transport The Websocket Transport, for example WebSocket.
   * @param options.timeout The default timeout in milliseconds to trigger push timeouts.
   * @param options.params The optional params to pass when connecting.
   * @param options.headers The optional headers to pass when connecting.
   * @param options.heartbeatIntervalMs The millisec interval to send a heartbeat message.
   * @param options.logger The optional function for specialized logging, ie: logger: (kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }
   * @param options.encode The function to encode outgoing messages. Defaults to JSON: (payload, callback) => callback(JSON.stringify(payload))
   * @param options.decode The function to decode incoming messages. Defaults to Serializer's decode.
   * @param options.longpollerTimeout The maximum timeout of a long poll AJAX request. Defaults to 20s (double the server long poll timer).
   * @param options.reconnectAfterMs he optional function that returns the millsec reconnect interval. Defaults to stepped backoff off.
   */
  constructor(endPoint: string, options?: Options) {
    this.endPoint = `${endPoint}/${TRANSPORTS.websocket}`

    if (options?.params) this.params = options.params
    if (options?.headers) this.headers = { ...this.headers, ...options.headers }
    if (options?.timeout) this.timeout = options.timeout
    if (options?.logger) this.logger = options.logger
    if (options?.transport) this.transport = options.transport
    if (options?.heartbeatIntervalMs)
      this.heartbeatIntervalMs = options.heartbeatIntervalMs
    if (options?.longpollerTimeout)
      this.longpollerTimeout = options.longpollerTimeout

    this.reconnectAfterMs = options?.reconnectAfterMs
      ? options.reconnectAfterMs
      : (tries: number) => {
          return [1000, 2000, 5000, 10000][tries - 1] || 10000
        }
    this.encode = options?.encode
      ? options.encode
      : (payload: JSON, callback: Function) => {
          return callback(JSON.stringify(payload))
        }
    this.decode = options?.decode
      ? options.decode
      : this.serializer.decode.bind(this.serializer)
    this.reconnectTimer = new Timer(async () => {
      await this.disconnect()
      this.connect()
    }, this.reconnectAfterMs)
  }

  /**
   * Connects the socket.
   */
  connect() {
    if (this.conn) {
      return
    }

    this.conn = new this.transport(this.endPointURL(), [], null, this.headers)
    if (this.conn) {
      // this.conn.timeout = this.longpollerTimeout // TYPE ERROR
      this.conn.binaryType = 'arraybuffer'
      this.conn.onopen = () => this._onConnOpen()
      this.conn.onerror = (error) => this._onConnError(error)
      this.conn.onmessage = (event) => this.onConnMessage(event)
      this.conn.onclose = (event) => this._onConnClose(event)
    }
  }

  /**
   * Disconnects the socket.
   *
   * @param code A numeric status code to send on disconnect.
   * @param reason A custom reason for the disconnect.
   */
  disconnect(
    code?: number,
    reason?: string
  ): Promise<{ error: Error | null; data: boolean }> {
    return new Promise((resolve, _reject) => {
      try {
        if (this.conn) {
          this.conn.onclose = function () {} // noop
          if (code) {
            this.conn.close(code, reason || '')
          } else {
            this.conn.close()
          }
          this.conn = null
          // remove open handles
          this.heartbeatTimer && clearInterval(this.heartbeatTimer)
          this.reconnectTimer.reset()
        }
        resolve({ error: null, data: true })
      } catch (error) {
        resolve({ error: error as Error, data: false })
      }
    })
  }

  /**
   * Logs the message. Override `this.logger` for specialized logging.
   */
  log(kind: string, msg: string, data?: any) {
    this.logger(kind, msg, data)
  }

  /**
   * Registers a callback for connection state change event.
   * @param callback A function to be called when the event occurs.
   *
   * @example
   *    socket.onOpen(() => console.log("Socket opened."))
   */
  onOpen(callback: Function) {
    this.stateChangeCallbacks.open.push(callback)
  }

  /**
   * Registers a callbacks for connection state change events.
   * @param callback A function to be called when the event occurs.
   *
   * @example
   *    socket.onOpen(() => console.log("Socket closed."))
   */
  onClose(callback: Function) {
    this.stateChangeCallbacks.close.push(callback)
  }

  /**
   * Registers a callback for connection state change events.
   * @param callback A function to be called when the event occurs.
   *
   * @example
   *    socket.onOpen((error) => console.log("An error occurred"))
   */
  onError(callback: Function) {
    this.stateChangeCallbacks.error.push(callback)
  }

  /**
   * Calls a function any time a message is received.
   * @param callback A function to be called when the event occurs.
   *
   * @example
   *    socket.onMessage((message) => console.log(message))
   */
  onMessage(callback: Function) {
    this.stateChangeCallbacks.message.push(callback)
  }

  /**
   * Returns the current state of the socket.
   */
  connectionState() {
    switch (this.conn && this.conn.readyState) {
      case SOCKET_STATES.connecting:
        return 'connecting'
      case SOCKET_STATES.open:
        return 'open'
      case SOCKET_STATES.closing:
        return 'closing'
      default:
        return 'closed'
    }
  }

  /**
   * Retuns `true` is the connection is open.
   */
  isConnected() {
    return this.connectionState() === 'open'
  }

  /**
   * Removes a subscription from the socket.
   *
   * @param channel An open subscription.
   */
  remove(channel: RealtimeSubscription) {
    this.channels = this.channels.filter(
      (c: RealtimeSubscription) => c.joinRef() !== channel.joinRef()
    )
  }

  channel(topic: string, chanParams = {}) {
    let chan = new RealtimeSubscription(topic, chanParams, this)
    this.channels.push(chan)
    return chan
  }

  push(data: Message) {
    let { topic, event, payload, ref } = data
    let callback = () => {
      this.encode(data, (result: any) => {
        this.conn?.send(result)
      })
    }
    this.log('push', `${topic} ${event} (${ref})`, payload)
    if (this.isConnected()) {
      callback()
    } else {
      this.sendBuffer.push(callback)
    }
  }

  onConnMessage(rawMessage: any) {
    this.decode(rawMessage.data, (msg: Message) => {
      let { topic, event, payload, ref } = msg
      if (ref && ref === this.pendingHeartbeatRef) {
        this.pendingHeartbeatRef = null
      } else if (event === payload?.type) {
        this._resetHeartbeat()
      }

      this.log(
        'receive',
        `${payload.status || ''} ${topic} ${event} ${
          (ref && '(' + ref + ')') || ''
        }`,
        payload
      )
      this.channels
        .filter((channel: RealtimeSubscription) => channel.isMember(topic))
        .forEach((channel: RealtimeSubscription) =>
          channel.trigger(event, payload, ref)
        )
      this.stateChangeCallbacks.message.forEach((callback) => callback(msg))
    })
  }

  /**
   * Returns the URL of the websocket.
   */
  endPointURL() {
    return this._appendParams(
      this.endPoint,
      Object.assign({}, this.params, { vsn: VSN })
    )
  }

  /**
   * Return the next message ref, accounting for overflows
   */
  makeRef() {
    let newRef = this.ref + 1
    if (newRef === this.ref) {
      this.ref = 0
    } else {
      this.ref = newRef
    }

    return this.ref.toString()
  }

  /**
   * Sets the JWT access token used for channel subscription authorization and Realtime RLS.
   *
   * @param token A JWT string.
   */
  setAuth(token: string | null) {
    this.accessToken = token
    try {
      this.channels.forEach(
        (channel) =>
          channel.joinedOnce &&
          channel.isJoined() &&
          channel.push(CHANNEL_EVENTS.access_token, {
            access_token: token,
          })
      )
    } catch (error) {
      console.log('error', error)
      console.log('error', error)
      console.log('error', error)
    }
  }

  private _onConnOpen() {
    this.log('transport', `connected to ${this.endPointURL()}`)
    this._flushSendBuffer()
    this.reconnectTimer.reset()
    this._resetHeartbeat()
    this.stateChangeCallbacks.open.forEach((callback) => callback())!
  }

  private _onConnClose(event: any) {
    this.log('transport', 'close', event)
    this._triggerChanError()
    this.heartbeatTimer && clearInterval(this.heartbeatTimer)
    this.reconnectTimer.scheduleTimeout()
    this.stateChangeCallbacks.close.forEach((callback) => callback(event))
  }

  private _onConnError(error: Error) {
    this.log('transport', error.message)
    this._triggerChanError()
    this.stateChangeCallbacks.error.forEach((callback) => callback(error))
  }

  private _triggerChanError() {
    this.channels.forEach((channel: RealtimeSubscription) =>
      channel.trigger(CHANNEL_EVENTS.error)
    )
  }

  private _appendParams(url: string, params: { [key: string]: string }) {
    if (Object.keys(params).length === 0) {
      return url
    }
    const prefix = url.match(/\?/) ? '&' : '?'
    const query = new URLSearchParams(params)

    return `${url}${prefix}${query}`
  }

  private _flushSendBuffer() {
    if (this.isConnected() && this.sendBuffer.length > 0) {
      this.sendBuffer.forEach((callback) => callback())
      this.sendBuffer = []
    }
  }

  private _resetHeartbeat() {
    this.pendingHeartbeatRef = null
    this.heartbeatTimer && clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = setInterval(
      () => this._sendHeartbeat(),
      this.heartbeatIntervalMs
    )
  }

  private _sendHeartbeat() {
    if (!this.isConnected()) {
      return
    }
    if (this.pendingHeartbeatRef) {
      this.pendingHeartbeatRef = null
      this.log(
        'transport',
        'heartbeat timeout. Attempting to re-establish connection'
      )
      this.conn?.close(WS_CLOSE_NORMAL, 'hearbeat timeout')
      return
    }
    this.pendingHeartbeatRef = this.makeRef()
    this.setAuth(this.accessToken)
  }
}
