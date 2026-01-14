import { Mock, vi } from 'vitest'
import crypto from 'crypto'
import { Server, WebSocket as MockWebSocket, Client } from 'mock-socket'
import RealtimeClient, { RealtimeClientOptions } from '../../src/RealtimeClient'

// Constants
export const DEFAULT_REALTIME_URL = 'localhost:4000'
export const DEFAULT_WSS_URL = 'ws://localhost:4000/socket'
export const DEFAULT_API_KEY = '123456789'
export const DEFAULT_PHX_JOIN_PAYLOAD = {
  access_token: DEFAULT_API_KEY,
  config: {
    broadcast: {
      ack: false,
      self: false,
    },
    postgres_changes: [],
    presence: {
      enabled: false,
      key: '',
    },
    private: true,
  },
}

export type ClientOnHandler = (socket: Client, msg: any) => void
export type ServerOnCallback = (socket: Client) => void
export type DataSpy = Mock<(topic: string, event: string, payload: any) => void>
export type EventEmitters = {
  close: Mock
  connected: Mock
  message: DataSpy
}

// Core Interfaces
export interface TestSetup {
  client: RealtimeClient
  mockServer: Server
  emitters: EventEmitters
  realtimeUrl: string
  wssUrl: string
  clock?: any
  projectRef: string

  cleanup: () => void
  connect: () => void
  disconnect: () => void
}

export interface BuilderOptions extends Omit<RealtimeClientOptions, 'params'> {
  socketHandlers?: Record<string, ClientOnHandler>
  onConnectionCallback?: ServerOnCallback
  onCloseCallback?: ServerOnCallback
  useFakeTimers?: boolean
  apikey?: string
  params?: Record<string, any>
}

// Core Setup Functions
export function setupRealtimeTest(options: BuilderOptions = {}): TestSetup {
  const projectRef = crypto.randomUUID()
  const wssUrl = `wss://${projectRef}/websocket`
  const realtimeUrl = `wss://${projectRef}`
  const mockServer = new Server(wssUrl)
  const emitters: EventEmitters = {
    close: vi.fn(),
    connected: vi.fn(),
    message: vi.fn(),
  }

  const onClose =
    options.onCloseCallback ??
    (() => {
      emitters.close()
    })

  mockServer.on('close', onClose)

  const onConnection =
    options.onConnectionCallback ??
    ((socket: Client) => {
      if (socket.readyState == socket.OPEN) {
        emitters.connected()
      }

      socket.on('message', (message) => {
        const msg = JSON.parse(message as string)
        emitters.message(msg.topic, msg.event, msg.payload)

        if (options.socketHandlers && options.socketHandlers[msg.event]) {
          options.socketHandlers[msg.event](socket, message)
          return
        }

        if (msg.event === 'phx_join') {
          const reply = {
            event: 'phx_reply',
            payload: { status: 'ok', response: { postgres_changes: [] } },
            ref: msg.ref,
            topic: msg.topic,
          }
          socket.send(JSON.stringify(reply))
        }

        if (msg.event === 'heartbeat') {
          const reply = {
            topic: 'phoenix',
            event: 'phx_reply',
            ref: msg.ref,
            payload: { status: 'ok', response: {} },
          }
          socket.send(JSON.stringify(reply))
        }
      })
    })

  mockServer.on('connection', onConnection)

  const client = new RealtimeClient(realtimeUrl, {
    ...options,
    params: { ...options.params, apikey: options.apikey || DEFAULT_API_KEY },
  })

  let clock = undefined
  if (options.useFakeTimers) {
    clock = vi.useFakeTimers({ shouldAdvanceTime: true })
  }

  const connect = () => client.connect()
  const disconnect = async () => client.disconnect()
  const cleanup = () => cleanupRealtimeTest(client, mockServer, clock)

  return {
    client,
    mockServer,
    emitters,
    realtimeUrl,
    wssUrl,
    clock,
    projectRef,
    connect,
    disconnect,
    cleanup,
  }
}

export function cleanupRealtimeTest(client: RealtimeClient, mockServer: Server, clock?: any): void {
  try {
    client.disconnect()
  } catch (error) {
    // Ignore WebSocket cleanup errors in mock environment
  }
  try {
    mockServer.stop()
  } catch (error) {
    // Ignore server cleanup errors
  }
  if (clock) {
    vi.useRealTimers()
  }
  vi.resetAllMocks()
}
