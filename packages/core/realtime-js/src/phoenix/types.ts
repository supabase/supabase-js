export type {
  Socket,
  SocketOptions,
  SocketState,
  SocketOnOpen,
  SocketOnError,
  SocketOnMessage,
  SocketOnClose,
  SocketStateChangeCallbacks,
  Channel,
  ChannelState,
  ChannelEvent,
  ChannelBindingCallback,
  ChannelFilterBindings,
  ChannelOnMessage,
  ChannelOnErrorCallback,
  PresenceState,
  Message,
  Params,
  Transport,
  Timer,
  Vsn,
  Encode,
  Decode,
  HeartbeatCallback,
  HeartbeatStatus,
} from 'phoenix'

import type { Channel, PresenceState } from 'phoenix'

export type Push = ReturnType<Channel['push']>
export type PresenceStates = Record<string, PresenceState>
