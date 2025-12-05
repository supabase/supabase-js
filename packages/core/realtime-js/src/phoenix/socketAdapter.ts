import { Socket } from 'phoenix'
import type {
  Message,
  OnCloseCallback,
  OnErrorCallback,
  OnMessageCallback,
  OnOpenCallback,
  SocketOptions,
} from 'phoenix'
import { ConnectionState } from '../lib/constants'
import type { RealtimeClientOptions } from '../RealtimeClient'

export default class SocketAdapter {
  private socket: Socket

  constructor(endPoint: string, options: RealtimeClientOptions) {
    this.socket = new Socket(endPoint, options as SocketOptions)
  }

  get timeout(): number {
    return this.socket.timeout
  }
  set timeout(timeout: number) {
    this.socket.timeout = timeout
  }

  connect(): void {
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

  makeRef(): string {
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

  isConnected(): boolean {
    return this.socket.isConnected()
  }

  connectionState(): ConnectionState {
    return this.socket.connectionState() as ConnectionState
  }

  endPointURL(): string {
    return this.socket.endPointURL()
  }

  /**
   * @internal
   */
  getSocket(): Socket {
    return this.socket
  }
}
