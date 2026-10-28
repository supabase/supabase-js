import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, test } from 'vitest'
import RealtimeClient from '../../src/RealtimeClient'
import { LongPoll } from '@supabase/phoenix'

const require = createRequire(import.meta.url)

describe('phoenix transport selection', () => {
  test('uses globalThis.WebSocket when self is a shim without WebSocket', () => {
    const phoenixPath = require.resolve('@supabase/phoenix')
    const source = readFileSync(phoenixPath, 'utf8')
    const MockWebSocket = class WebSocket {}
    const module = { exports: {} as Record<string, unknown> }
    const sandbox = {
      self: {},
      window: undefined,
      WebSocket: MockWebSocket,
      console,
      module,
      exports: module.exports,
      setTimeout,
      clearTimeout,
      TextEncoder,
      TextDecoder,
    }

    vm.createContext(sandbox)
    vm.runInContext(source, sandbox, { filename: phoenixPath })

    const socketExports = sandbox.module.exports as {
      Socket: new (endPoint: string, opts?: Record<string, unknown>) => { transport: unknown }
      LongPoll: unknown
    }
    const socket = new socketExports.Socket('/socket', {})

    expect(socket.transport).toBe(MockWebSocket)
    expect(socket.transport).not.toBe(socketExports.LongPoll)
  })

  test('RealtimeClient does not fall back to LongPoll when WebSocket exists', () => {
    const client = new RealtimeClient('wss://example.supabase.co/realtime/v1', {
      params: { apikey: 'test-key' },
    })

    expect(client.transport).toBe(globalThis.WebSocket)
    expect(client.transport).not.toBe(LongPoll)
  })
})
