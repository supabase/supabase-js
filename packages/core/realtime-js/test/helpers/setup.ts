import { Mock, vi, expect } from 'vitest'
import crypto from 'crypto'
import { Server, Client } from 'mock-socket'
import RealtimeClient, { RealtimeClientOptions } from '../../src/RealtimeClient'
import RealtimeChannel from '../../src/RealtimeChannel'
import { CHANNEL_STATES } from '../../src/lib/constants'

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
  socketConnected: () => Promise<void>
  socketClosed: () => Promise<void>
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
          socket.send(
            phxReply(message as string, { status: 'ok', response: { postgres_changes: [] } })
          )
        }

        if (msg.event === 'heartbeat') {
          socket.send(phxReply(message as string, { status: 'ok', response: {} }))
        }
      })
    })

  mockServer.on('connection', onConnection)

  const client = new RealtimeClient(realtimeUrl, {
    decode: (msg, callback) => callback(JSON.parse(msg as string)),
    encode: (msg, callback) => callback(JSON.stringify(msg)),
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
    socketConnected: async () => waitForHaveBeenCalled(emitters.connected),
    socketClosed: async () => waitForHaveBeenCalled(emitters.close),
  }
}

function cleanupRealtimeTest(client: RealtimeClient, mockServer: Server, clock?: any): void {
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

async function waitForHaveBeenCalled(connected: Mock) {
  return vi.waitFor(() => expect(connected).toHaveBeenCalled())
}

export async function waitForChannelSubscribed(channel: RealtimeChannel) {
  return vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.joined))
}

export function phxReply(message: string, payload: Object) {
  const { topic, ref } = JSON.parse(message)

  return JSON.stringify({
    topic: topic,
    event: 'phx_reply',
    ref: ref,
    payload,
  })
}
