import { Socket } from 'phoenix'
import type {
  Message,
  OnCloseCallback,
  OnErrorCallback,
  OnMessageCallback,
  OnOpenCallback,
  SocketOptions,
} from './types'
import { CONNECTION_STATE, ConnectionState } from '../lib/constants'
import type {
  HeartbeatTimer,
  RealtimeClientOptions,
  WebSocketLikeConstructor,
} from '../RealtimeClient'

export default class SocketAdapter {
  private socket: Socket

  constructor(endPoint: string, options: RealtimeClientOptions) {
    this.socket = new Socket(endPoint, options as SocketOptions)
  }

  get timeout() {
    return this.socket.timeout
  }

  get endPoint() {
    return this.socket.endPoint
  }

  get transport() {
    return this.socket.transport as WebSocketLikeConstructor
  }

  get heartbeatIntervalMs() {
    return this.socket.heartbeatIntervalMs
  }

  get heartbeatTimer() {
    return this.socket.heartbeatTimer as HeartbeatTimer
  }

  get pendingHeartbeatRef() {
    return this.socket.pendingHeartbeatRef
  }

  get vsn() {
    return this.socket.vsn
  }

  get encode() {
    return this.socket.encode
  }

  get decode() {
    return this.socket.decode
  }

  get reconnectAfterMs() {
    return this.socket.reconnectAfterMs
  }

  get sendBuffer() {
    return this.socket.sendBuffer
  }

  get stateChangeCallbacks() {
    return this.socket.stateChangeCallbacks
  }

  connect() {
    this.socket.connect()
  }

  disconnect(code?: number, reason?: string) {
    this.socket.disconnect(() => {}, code, reason)
  }

  push(data: Message<Record<string, unknown>>) {
    this.socket.push(data)
  }

  log(kind: string, msg: string, data?: any) {
    this.socket.log(kind, msg, data)
  }

  makeRef() {
    return this.socket.makeRef()
  }

  onOpen(callback: OnOpenCallback) {
    this.socket.onOpen(callback)
  }

  onClose(callback: OnCloseCallback) {
    this.socket.onClose(callback)
  }

  onError(callback: OnErrorCallback) {
    this.socket.onError(callback)
  }

  onMessage(callback: OnMessageCallback) {
    this.socket.onMessage(callback)
  }

  isConnected() {
    return this.socket.isConnected()
  }

  isConnecting() {
    return this.socket.connectionState() == CONNECTION_STATE.connecting
  }

  isDisconnecting() {
    return this.socket.connectionState() == CONNECTION_STATE.closing
  }

  connectionState(): ConnectionState {
    // @ts-ignore - requires better typing and exposing type in phoenix
    return this.socket.connectionState()
  }

  endPointURL() {
    return this.socket.endPointURL()
  }

  /**
   * @internal
   */
  getSocket() {
    return this.socket
  }
}
