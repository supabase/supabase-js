import { Channel } from 'phoenix'
import type { BindingCallback } from 'phoenix'
import { CHANNEL_STATES, ChannelState } from '../lib/constants'
import type { RealtimeChannelOptions } from '../RealtimeChannel'
import SocketAdapter from './socketAdapter'

type Push = ReturnType<Channel['push']>

export default class ChannelAdapter {
  private channel: Channel
  private socket: SocketAdapter

  constructor(socket: SocketAdapter, topic: string, params: RealtimeChannelOptions) {
    const phoenixParams = phoenixChannelParams(params)
    this.channel = socket.getSocket().channel(topic, phoenixParams)
    this.socket = socket
  }

  get state(): ChannelState {
    return this.channel.state as ChannelState
  }

  set state(state: ChannelState) {
    this.channel.state = state
  }

  on(event: string, callback: BindingCallback): number {
    return this.channel.on(event, callback)
  }

  off(event: string, refNumber?: number): void {
    this.channel.off(event, refNumber)
  }

  trigger(type: string, payload: object, ref?: string): void {
    //@ts-ignore - trigger should be public
    this.channel.trigger(type, payload, ref, this.joinRef())
  }

  subscribe(timeout?: number): Push {
    return this.channel.join(timeout)
  }

  unsubscribe(timeout?: number): Push {
    return this.channel.leave(timeout)
  }

  send(event: string, payload: object, timeout?: number): void {
    this.channel.push(event, payload, timeout)
  }

  push(event: string, payload: { [key: string]: any }, timeout?: number): Push {
    try {
      return this.channel.push(event, payload, timeout)
    } catch (error) {
      throw `tried to push '${event}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`
    }
  }
  canSend(): boolean {
    return this.socket.isConnected() && this.state === CHANNEL_STATES.joined
  }

  joinRef(): string {
    //@ts-ignore - `joinRef()` will be public
    return this.channel.joinPush.ref
  }

  /**
   * @internal
   */
  getChannel(): Channel {
    return this.channel
  }
}

function phoenixChannelParams(options: RealtimeChannelOptions): Record<string, unknown> {
  return {
    config: {
      ...{
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        private: false,
      },
      ...options.config,
    },
  }
}
