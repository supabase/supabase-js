import type { Readable, Writable } from 'node:stream'
import { encodeFrame, FrameReader } from '../../src'

export interface RpcResponse {
  id: unknown
  result?: any
  error?: { code: number; message: string }
}

/** The TypeScript side of the protocol: sends framed requests and matches responses by id. */
export class RpcClient {
  private nextId = 1
  private readonly pending = new Map<unknown, (response: RpcResponse) => void>()
  private readonly unmatched: RpcResponse[] = []

  constructor(
    private readonly toServer: Writable,
    fromServer: Readable
  ) {
    const reader = new FrameReader(
      (body) => {
        const response = JSON.parse(body) as RpcResponse
        const waiting = this.pending.get(response.id)
        if (waiting) {
          this.pending.delete(response.id)
          waiting(response)
        } else {
          this.unmatched.push(response)
        }
      },
      (reason) => {
        throw new Error(reason)
      }
    )
    fromServer.on('data', (chunk) => reader.push(chunk))
  }

  request(method: string, params?: unknown): Promise<RpcResponse> {
    const id = this.nextId++
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.toServer.write(encodeFrame({ jsonrpc: '2.0', id, method, params }))
    })
  }

  notify(method: string, params?: unknown): void {
    this.toServer.write(encodeFrame({ jsonrpc: '2.0', method, params }))
  }

  /** Bytes as they are, for malformed frames. The next response with `id` resolves the returned promise. */
  raw(bytes: Buffer | string, expectId: unknown): Promise<RpcResponse> {
    return new Promise((resolve) => {
      const early = this.unmatched.findIndex((r) => r.id === expectId)
      if (early >= 0) return resolve(this.unmatched.splice(early, 1)[0])
      this.pending.set(expectId, resolve)
      this.toServer.write(bytes)
    })
  }
}

export const INITIALIZE = { positionEncodings: ['utf-8', 'utf-16'] }

export const STUB_OPTIONS = {
  postgrest: '14.4',
  schema: { source: 'supabase-local' },
}
