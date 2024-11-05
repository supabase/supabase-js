// @ts-nocheck
import type { RealtimeClientOptions } from '@supabase/realtime-js'

export const WxSocketTask: NonNullable<RealtimeClientOptions['transport']> = function (
  address: string | URL,
  _ignored: any,
  options?: { headers?: any }
) {
  const addressString = address.toString()
  return new (class {
    binaryType: string = 'arraybuffer'
    private socket: WechatMiniprogram.SocketTask
    readyState: number = 0
    url: string | URL | null

    constructor(address: string) {
      this.url = address
      this.socket = wx.connectSocket({
        url: address,
        header: options?.headers || {},
      })

      this.socket.onOpen(() => {
        // console.log('[WS] Connected:', address)
        this.readyState = 1
        this.onopen?.()
      })

      this.socket.onMessage((res) => {
        // console.log('[WS] Received:', res)
        this.onmessage?.(res)
      })

      this.socket.onError((err) => {
        console.error('[WS] Error:', err)
        this.onerror?.(err)
      })

      this.socket.onClose((res) => {
        // console.log('[WS] Closed:', res)
        this.readyState = 3
        this.onclose?.(res)
      })
    }

    onclose: (result?: any) => void = () => {}
    onmessage: (message?: any) => void = () => {}
    onerror: (error?: any) => void = () => {}
    onopen: () => void = () => {}

    send(data: string) {
      this.socket.send({ data })
    }

    close(code?: number, reason?: string) {
      this.socket.close({
        code,
        reason,
      })
    }
  })(addressString)
} as unknown as { new (address: string | URL, _ignored: any, options?: { headers?: any }): any }
