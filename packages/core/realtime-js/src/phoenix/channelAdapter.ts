import { Channel } from 'phoenix'
import { CHANNEL_STATES } from '../lib/constants'
import type { RealtimeChannelOptions } from '../RealtimeChannel'
import SocketAdapter from './socketAdapter'
import type {
  ChannelBindingCallback,
  ChannelOnMessage,
  ChannelOnErrorCallback,
  ChannelFilterBindings,
  Params,
  ChannelState,
  Push,
  Timer,
} from './types'

export default class ChannelAdapter {
  private channel: Channel
  private socket: SocketAdapter

  constructor(socket: SocketAdapter, topic: string, params: RealtimeChannelOptions) {
    const phoenixParams = phoenixChannelParams(params)
    this.channel = socket.getSocket().channel(topic, phoenixParams)
    this.socket = socket
  }

  get state(): ChannelState {
    return this.channel.state
  }

  set state(state: ChannelState) {
    this.channel.state = state
  }

  get joinedOnce(): boolean {
    return this.channel.joinedOnce
  }

  get joinPush(): Push {
    return this.channel.joinPush
  }

  get rejoinTimer(): Timer {
    return this.channel.rejoinTimer
  }

  on(event: string, callback: ChannelBindingCallback): number {
    return this.channel.on(event, callback)
  }

  off(event: string, refNumber?: number) {
    this.channel.off(event, refNumber)
  }

  subscribe(timeout?: number): Push {
    return this.channel.join(timeout)
  }

  unsubscribe(timeout?: number): Push {
    return this.channel.leave(timeout)
  }

  send(event: string, payload: object, timeout?: number) {
    this.channel.push(event, payload, timeout)
  }

  onClose(callback: ChannelBindingCallback) {
    this.channel.onClose(callback)
  }

  onError(callback: ChannelOnErrorCallback): number {
    return this.channel.onError(callback)
  }

  push(event: string, payload: { [key: string]: any }, timeout?: number): Push {
    try {
      return this.channel.push(event, payload, timeout)
    } catch (error) {
      throw `tried to push '${event}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`
    }
  }

  updateJoinPayload(payload: Record<string, any>) {
    this.channel.joinPush.payload = () => payload
  }

  joinRef(): string {
    if (!this.channel.joinPush.ref) {
      throw new Error('Join push reference not found')
    }

    return this.channel.joinPush.ref
  }

  canPush() {
    return this.socket.isConnected() && this.state === CHANNEL_STATES.joined
  }

  isJoined() {
    return this.state === CHANNEL_STATES.joined
  }

  isJoining() {
    return this.state === CHANNEL_STATES.joining
  }

  isClosed() {
    return this.state === CHANNEL_STATES.closed
  }

  isLeaving() {
    return this.state === CHANNEL_STATES.leaving
  }

  updateFilterBindings(filterBindings: ChannelFilterBindings) {
    this.channel.filterBindings = filterBindings
  }

  updatePayloadTransform(callback: ChannelOnMessage) {
    this.channel.onMessage = callback
  }

  /**
   * @internal
   */
  getChannel() {
    return this.channel
  }
}

function phoenixChannelParams(options: RealtimeChannelOptions): Params {
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
