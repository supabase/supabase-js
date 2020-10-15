import {
  VSN,
  CHANNEL_EVENTS,
  TRANSPORTS,
  SOCKET_STATES,
  DEFAULT_TIMEOUT,
  WS_CLOSE_NORMAL,
} from './lib/constants'
import querystring from 'query-string'
import Timer from './lib/timer'
import Channel from './channel'
import { w3cwebsocket as WebSocket } from 'websocket'

type Options = {
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

export default class Socket {
  channels: Channel[] = []
  endPoint: string = ''
  headers?: { [key: string]: string } = {}
  params?: { [key: string]: string } = {}
  timeout: number = DEFAULT_TIMEOUT
  transport: any = WebSocket
  heartbeatIntervalMs: number = 30000
  longpollerTimeout: number = 20000
  heartbeatTimer: number | undefined = undefined
  pendingHeartbeatRef: string | null = null
  ref: number = 0
  reconnectTimer: Timer
  logger: Function = noop
  encode: Function
  decode: Function
  reconnectAfterMs: Function
  conn: WebSocket | null = null
  sendBuffer: Function[] = []
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
   * @param options.decode The function to decode incoming messages. Defaults to JSON: (payload, callback) => callback(JSON.parse(payload))
   * @param options.longpollerTimeout The maximum timeout of a long poll AJAX request. Defaults to 20s (double the server long poll timer).
   * @param options.reconnectAfterMs he optional function that returns the millsec reconnect interval. Defaults to stepped backoff off.
   */
  constructor(endPoint: string, options?: Options) {
    this.endPoint = `${endPoint}/${TRANSPORTS.websocket}`

    if (options?.params) this.params = options.params
    if (options?.headers) this.headers = options.headers
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
      : (payload: string, callback: Function) => {
          return callback(JSON.parse(payload))
        }
    this.reconnectTimer = new Timer(async () => {
      await this.disconnect()
      this.connect()
    }, this.reconnectAfterMs)
  }

  endPointURL() {
    return this.appendParams(
      this.endPoint,
      Object.assign({}, this.params, { vsn: VSN })
    )
  }

  appendParams(url: string, params: { [key: string]: string }) {
    if (Object.keys(params).length === 0) {
      return url
    }
    let prefix = url.match(/\?/) ? '&' : '?'
    return `${url}${prefix}${querystring.stringify(params)}`
  }

  /**
   * Disconnects the socket.
   *
   * @param code A numeric status code to send on disconnect.
   * @param reason A custom reason for the disconnect.
   */
  disconnect(code?: number, reason?: string) {
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
        }
        resolve({ error: null, data: true })
      } catch (error) {
        resolve({ error })
      }
    })
  }

  connect() {
    if (this.conn) {
      return
    }

    this.conn = new this.transport(this.endPointURL(), [], null, this.headers)
    if (this.conn) {
      // this.conn.timeout = this.longpollerTimeout // TYPE ERROR
      this.conn.onopen = () => this.onConnOpen()
      this.conn.onerror = (error) => this.onConnError(error)
      this.conn.onmessage = (event) => this.onConnMessage(event)
      this.conn.onclose = (event) => this.onConnClose(event)
    }
  }

  /**
   * Logs the message. Override `this.logger` for specialized logging. noops by default.
   */
  log(kind: string, msg: string, data?: any) {
    this.logger(kind, msg, data)
  }

  /**
   * Registers callbacks for connection state change events.
   *
   * @example
   *    socket.onError(function(error){ alert("An error occurred") })
   */
  onOpen(callback: Function) {
    this.stateChangeCallbacks.open.push(callback)
  }
  onClose(callback: Function) {
    this.stateChangeCallbacks.close.push(callback)
  }
  onError(callback: Function) {
    this.stateChangeCallbacks.error.push(callback)
  }
  onMessage(callback: Function) {
    this.stateChangeCallbacks.message.push(callback)
  }

  onConnOpen() {
    this.log('transport', `connected to ${this.endPointURL()}`)
    this.flushSendBuffer()
    this.reconnectTimer.reset()
    // if (!this.conn?.skipHeartbeat) { // Skip heartbeat doesn't exist on w3Socket
    clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = <any>(
      setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs)
    )
    // }
    this.stateChangeCallbacks.open.forEach((callback) => callback())!
  }

  onConnClose(event: any) {
    this.log('transport', 'close', event)
    this.triggerChanError()
    clearInterval(this.heartbeatTimer)
    this.reconnectTimer.scheduleTimeout()
    this.stateChangeCallbacks.close.forEach((callback) => callback(event))
  }

  onConnError(error: Error) {
    this.log('transport', error.message)
    this.triggerChanError()
    this.stateChangeCallbacks.error.forEach((callback) => callback(error))
  }

  triggerChanError() {
    this.channels.forEach((channel: Channel) =>
      channel.trigger(CHANNEL_EVENTS.error)
    )
  }

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

  isConnected() {
    return this.connectionState() === 'open'
  }

  remove(channel: Channel) {
    this.channels = this.channels.filter(
      (c: Channel) => c.joinRef() !== channel.joinRef()
    )
  }

  channel(topic: string, chanParams = {}) {
    let chan = new Channel(topic, chanParams, this)
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

  sendHeartbeat() {
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
    this.push({
      topic: 'phoenix',
      event: 'heartbeat',
      payload: {},
      ref: this.pendingHeartbeatRef,
    })
  }

  flushSendBuffer() {
    if (this.isConnected() && this.sendBuffer.length > 0) {
      this.sendBuffer.forEach((callback) => callback())
      this.sendBuffer = []
    }
  }

  onConnMessage(rawMessage: any) {
    this.decode(rawMessage.data, (msg: Message) => {
      let { topic, event, payload, ref } = msg
      if (ref && ref === this.pendingHeartbeatRef) {
        this.pendingHeartbeatRef = null
      }

      this.log(
        'receive',
        `${payload.status || ''} ${topic} ${event} ${
          (ref && '(' + ref + ')') || ''
        }`,
        payload
      )
      this.channels
        .filter((channel: Channel) => channel.isMember(topic))
        .forEach((channel: Channel) => channel.trigger(event, payload, ref))
      this.stateChangeCallbacks.message.forEach((callback) => callback(msg))
    })
  }
}
