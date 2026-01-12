import { Socket } from 'phoenix'
import type {
  Message,
  SocketOnClose,
  SocketOnMessage,
  SocketOnOpen,
  SocketOnError,
  SocketOptions,
  SocketStateChangeCallbacks,
  Vsn,
  Encode,
  Decode,
  HeartbeatCallback,
} from './types'
import { CONNECTION_STATE, ConnectionState } from '../lib/constants'
import type { HeartbeatTimer, WebSocketLikeConstructor } from '../RealtimeClient'

export default class SocketAdapter {
  private socket: Socket

  constructor(endPoint: string, options: SocketOptions) {
    this.socket = new Socket(endPoint, options)
  }

  get timeout(): number {
    return this.socket.timeout
  }

  get endPoint(): string {
    return this.socket.endPoint
  }

  get transport(): WebSocketLikeConstructor {
    return this.socket.transport as WebSocketLikeConstructor
  }

  get heartbeatIntervalMs(): number {
    return this.socket.heartbeatIntervalMs
  }

  get heartbeatCallback(): HeartbeatCallback {
    return this.socket.heartbeatCallback
  }

  set heartbeatCallback(callback: HeartbeatCallback) {
    this.socket.heartbeatCallback = callback
  }

  get heartbeatTimer(): HeartbeatTimer {
    return this.socket.heartbeatTimer
  }

  get pendingHeartbeatRef(): string | null {
    return this.socket.pendingHeartbeatRef
  }

  get vsn(): Vsn {
    return this.socket.vsn
  }

  get encode(): Encode<void> {
    return this.socket.encode
  }

  get decode(): Decode<void> {
    return this.socket.decode
  }

  get reconnectAfterMs(): (tries: number) => number {
    return this.socket.reconnectAfterMs
  }

  get sendBuffer(): (() => void)[] {
    return this.socket.sendBuffer
  }

  get stateChangeCallbacks(): SocketStateChangeCallbacks {
    return this.socket.stateChangeCallbacks
  }

  connect() {
    this.socket.connect()
  }

  disconnect(code?: number, reason?: string, timeout: number = 10000): Promise<'ok' | 'timeout'> {
    return new Promise((resolve) => {
      setTimeout(() => resolve('timeout'), timeout)
      this.socket.disconnect(
        () => {
          resolve('ok')
        },
        code,
        reason
      )
    })
  }

  push(data: Message<Record<string, unknown>>) {
    this.socket.push(data)
  }

  log(kind: string, msg: string, data?: any) {
    this.socket.log(kind, msg, data)
  }

  makeRef(): string {
    return this.socket.makeRef()
  }

  onOpen(callback: SocketOnOpen) {
    this.socket.onOpen(callback)
  }

  onClose(callback: SocketOnClose) {
    this.socket.onClose(callback)
  }

  onError(callback: SocketOnError) {
    this.socket.onError(callback)
  }

  onMessage(callback: SocketOnMessage) {
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

  endPointURL(): string {
    return this.socket.endPointURL()
  }

  sendHeartbeat() {
    this.socket.sendHeartbeat()
  }

  /**
   * @internal
   */
  getSocket() {
    return this.socket
  }
}
