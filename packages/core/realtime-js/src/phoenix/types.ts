export type {
  Socket,
  Channel,
  Message,
  Params,
  OnCloseCallback,
  OnErrorCallback,
  OnMessageCallback,
  OnOpenCallback,
  OnSync,
  State,
  SocketOptions,
  BindingCallback,
} from 'phoenix'

import type { Channel } from 'phoenix'

export type Push = ReturnType<Channel['push']>

// TODO: Maybe it should be exported in `phoenix`
export type ChanelOnErrorCallback = (reason: any) => void
