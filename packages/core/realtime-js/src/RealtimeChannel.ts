import { CHANNEL_EVENTS, CHANNEL_STATES } from './lib/constants'
import Push from './lib/push'
import RealtimeClient from './RealtimeClient'
import Timer from './lib/timer'
import RealtimePresence from './RealtimePresence'

export default class RealtimeChannel {
  bindings: any[] = []
  timeout: number
  state = CHANNEL_STATES.closed
  joinedOnce = false
  joinPush: Push
  rejoinTimer: Timer
  pushBuffer: Push[] = []
  presence: RealtimePresence

  constructor(
    public topic: string,
    public params: { [key: string]: unknown } = {},
    public socket: RealtimeClient
  ) {
    this.timeout = this.socket.timeout
    this.joinPush = new Push(
      this,
      CHANNEL_EVENTS.join,
      this.params,
      this.timeout
    )
    this.rejoinTimer = new Timer(
      () => this.rejoinUntilConnected(),
      this.socket.reconnectAfterMs
    )
    this.joinPush.receive('ok', () => {
      this.state = CHANNEL_STATES.joined
      this.rejoinTimer.reset()
      this.pushBuffer.forEach((pushEvent: Push) => pushEvent.send())
      this.pushBuffer = []
    })
    this.onClose(() => {
      this.rejoinTimer.reset()
      this.socket.log('channel', `close ${this.topic} ${this.joinRef()}`)
      this.state = CHANNEL_STATES.closed
      this.socket.remove(this)
    })
    this.onError((reason: string) => {
      if (this.isLeaving() || this.isClosed()) {
        return
      }
      this.socket.log('channel', `error ${this.topic}`, reason)
      this.state = CHANNEL_STATES.errored
      this.rejoinTimer.scheduleTimeout()
    })
    this.joinPush.receive('timeout', () => {
      if (!this.isJoining()) {
        return
      }
      this.socket.log('channel', `timeout ${this.topic}`, this.joinPush.timeout)
      this.state = CHANNEL_STATES.errored
      this.rejoinTimer.scheduleTimeout()
    })
    this.on(CHANNEL_EVENTS.reply, {}, (payload: any, ref: string) => {
      this.trigger(this.replyEventName(ref), payload)
    })
    this.presence = new RealtimePresence(this)
  }

  list() {
    return this.presence.list()
  }

  rejoinUntilConnected() {
    this.rejoinTimer.scheduleTimeout()
    if (this.socket.isConnected()) {
      this.rejoin()
    }
  }

  subscribe(timeout = this.timeout) {
    if (this.joinedOnce) {
      throw `tried to subscribe multiple times. 'subscribe' can only be called a single time per channel instance`
    } else {
      const configs = this.bindings.reduce(
        (acc, binding: { [key: string]: any }) => {
          const { type } = binding
          if (
            ![
              'phx_close',
              'phx_error',
              'phx_reply',
              'presence_diff',
              'presence_state',
            ].includes(type)
          ) {
            acc[type] = binding
          }
          return acc
        },
        {}
      )

      if (Object.keys(configs).length) {
        this.updateJoinPayload({ configs })
      }

      this.joinedOnce = true
      this.rejoin(timeout)
      return this.joinPush
    }
  }

  /**
   * Registers a callback that will be executed when the channel closes.
   */
  onClose(callback: Function) {
    this.on(CHANNEL_EVENTS.close, {}, callback)
  }

  /**
   * Registers a callback that will be executed when the channel encounteres an error.
   */
  onError(callback: Function) {
    this.on(CHANNEL_EVENTS.error, {}, (reason: string) => callback(reason))
  }

  on(type: string, filter?: { [key: string]: string }, callback?: Function) {
    this.bindings.push({
      type,
      filter: filter ?? {},
      callback: callback ?? (() => {}),
    })
  }

  off(type: string, filter: { [key: string]: any }) {
    this.bindings = this.bindings.filter((bind) => {
      return !(
        bind.type === type && RealtimeChannel.isEqual(bind.filter, filter)
      )
    })
  }

  /**
   * Returns `true` if the socket is connected and the channel has been joined.
   */
  canPush(): boolean {
    return this.socket.isConnected() && this.isJoined()
  }

  push(event: CHANNEL_EVENTS, payload: any, timeout = this.timeout) {
    if (!this.joinedOnce) {
      throw `tried to push '${event}' to '${this.topic}' before joining. Use channel.subscribe() before pushing events`
    }
    let pushEvent = new Push(this, event, payload, timeout)
    if (this.canPush()) {
      pushEvent.send()
    } else {
      pushEvent.startTimeout()
      this.pushBuffer.push(pushEvent)
    }

    return pushEvent
  }

  updateJoinPayload(payload: { [key: string]: unknown }): void {
    this.joinPush.updatePayload(payload)
  }

  /**
   * Leaves the channel.
   *
   * Unsubscribes from server events, and instructs channel to terminate on server.
   * Triggers onClose() hooks.
   *
   * To receive leave acknowledgements, use the a `receive` hook to bind to the server ack, ie:
   * channel.unsubscribe().receive("ok", () => alert("left!") )
   */
  unsubscribe(timeout = this.timeout): Push {
    this.state = CHANNEL_STATES.leaving
    const onClose = () => {
      this.socket.log('channel', `leave ${this.topic}`)
      this.trigger(CHANNEL_EVENTS.close, 'leave', this.joinRef())
    }
    // Destroy joinPush to avoid connection timeouts during unscription phase
    this.joinPush.destroy()

    const leavePush = new Push(this, CHANNEL_EVENTS.leave, {}, timeout)
    leavePush.receive('ok', () => onClose()).receive('timeout', () => onClose())
    leavePush.send()
    if (!this.canPush()) {
      leavePush.trigger('ok', {})
    }

    return leavePush
  }

  /**
   * Overridable message hook
   *
   * Receives all events for specialized message handling before dispatching to the channel callbacks.
   * Must return the payload, modified or unmodified.
   */
  onMessage(event: string, payload: any, ref?: string) {
    return payload
  }

  isMember(topic: string): boolean {
    return this.topic === topic
  }

  joinRef(): string {
    return this.joinPush.ref
  }

  rejoin(timeout = this.timeout): void {
    if (this.isLeaving()) {
      return
    }
    this.socket.leaveOpenTopic(this.topic)
    this.state = CHANNEL_STATES.joining
    this.joinPush.resend(timeout)
  }

  trigger(type: string, payload?: any, ref?: string) {
    const { close, error, leave, join } = CHANNEL_EVENTS
    const events: string[] = [close, error, leave, join]
    if (ref && events.indexOf(type) >= 0 && ref !== this.joinRef()) {
      return
    }
    const handledPayload = this.onMessage(type, payload, ref)
    if (payload && !handledPayload) {
      throw 'channel onMessage callbacks must return the payload, modified or unmodified'
    }

    this.bindings
      .filter((bind) => {
        return (
          bind?.type === type &&
          (bind?.filter?.event === '*' ||
            bind?.filter?.event === payload?.event)
        )
      })
      .map((bind) => bind.callback(handledPayload, ref))
  }

  send(payload: { type: string; [key: string]: any }) {
    const push = this.push(payload.type as any, payload)

    return new Promise((resolve, reject) => {
      push.receive('ok', () => resolve('ok'))
      push.receive('timeout', () => reject('timeout'))
    })
  }

  replyEventName(ref: string): string {
    return `chan_reply_${ref}`
  }

  isClosed(): boolean {
    return this.state === CHANNEL_STATES.closed
  }
  isErrored(): boolean {
    return this.state === CHANNEL_STATES.errored
  }
  isJoined(): boolean {
    return this.state === CHANNEL_STATES.joined
  }
  isJoining(): boolean {
    return this.state === CHANNEL_STATES.joining
  }
  isLeaving(): boolean {
    return this.state === CHANNEL_STATES.leaving
  }

  private static isEqual(
    obj1: { [key: string]: string },
    obj2: { [key: string]: string }
  ) {
    if (Object.keys(obj1).length !== Object.keys(obj2).length) {
      return false
    }

    for (const k in obj1) {
      if (obj1[k] !== obj2[k]) {
        return false
      }
    }

    return true
  }
}
