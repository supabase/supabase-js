import { version } from './version'
import type {
  SocketState,
  ChannelState,
  ChannelEvent as PhoenixChannelEvent,
  Transport,
} from '../phoenix/types'

export type { SocketState, ChannelState, Transport }

export const DEFAULT_VERSION = `realtime-js/${version}`

export const VSN_1_0_0: string = '1.0.0'
export const VSN_2_0_0: string = '2.0.0'
export const DEFAULT_VSN: string = VSN_2_0_0

export const VERSION = version

export const DEFAULT_TIMEOUT = 10000

export const WS_CLOSE_NORMAL = 1000
export const MAX_PUSH_BUFFER_SIZE = 100

export const SOCKET_STATES = {
  connecting: 0,
  open: 1,
  closing: 2,
  closed: 3,
} as const

export const CHANNEL_STATES = {
  closed: 'closed',
  errored: 'errored',
  joined: 'joined',
  joining: 'joining',
  leaving: 'leaving',
} as const

export type ChannelEvent = PhoenixChannelEvent | 'access_token'

export const CHANNEL_EVENTS = {
  close: 'phx_close',
  error: 'phx_error',
  join: 'phx_join',
  reply: 'phx_reply',
  leave: 'phx_leave',
  access_token: 'access_token',
} as const

export const TRANSPORTS = {
  websocket: 'websocket',
} as const

export type ConnectionState = 'connecting' | 'open' | 'closing' | 'closed'

export const CONNECTION_STATE = {
  connecting: 'connecting',
  open: 'open',
  closing: 'closing',
  closed: 'closed',
} as const
