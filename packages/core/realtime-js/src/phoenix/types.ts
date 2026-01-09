export type {
  Socket,
  SocketOptions,
  SocketState,
  SocketOnOpen,
  SocketOnError,
  SocketOnMessage,
  SocketOnClose,
  Channel,
  ChannelState,
  ChannelEvent,
  ChannelBindingCallback,
  ChannelOnMessage,
  ChannelOnErrorCallback,
  PresenceState,
  Message,
  Params,
  Transport,
  HeartbeatCallback,
  HeartbeatStatus,
} from 'phoenix'

import type { Channel, PresenceState } from 'phoenix'

export type Push = ReturnType<Channel['push']>
export type PresenceStates = Record<string, PresenceState>
