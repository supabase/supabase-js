import { CHANNEL_EVENTS, CHANNEL_STATES } from './lib/constants'
import Push from './lib/push'
import RealtimeClient from './RealtimeClient'
import Timer from './lib/timer'

export default class RealtimeSubscription {
  bindings: any[] = []
  timeout: number
  state = CHANNEL_STATES.closed
  joinedOnce = false
  joinPush: Push
  rejoinTimer: Timer
  pushBuffer: Push[] = []

  constructor(
    public topic: string,
    public params: any = {},
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
    this.on(CHANNEL_EVENTS.reply, (payload: any, ref: string) => {
      this.trigger(this.replyEventName(ref), payload)
    })
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
      this.joinedOnce = true
      this.rejoin(timeout)
      return this.joinPush
    }
  }

  onClose(callback: Function) {
    this.on(CHANNEL_EVENTS.close, callback)
  }

  onError(callback: Function) {
    this.on(CHANNEL_EVENTS.error, (reason: string) => callback(reason))
  }

  on(event: string, callback: Function) {
    this.bindings.push({ event, callback })
  }

  off(event: string) {
    this.bindings = this.bindings.filter((bind) => bind.event !== event)
  }

  canPush() {
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

  /**
   * Leaves the channel
   *
   * Unsubscribes from server events, and instructs channel to terminate on server.
   * Triggers onClose() hooks.
   *
   * To receive leave acknowledgements, use the a `receive` hook to bind to the server ack, ie:
   * channel.unsubscribe().receive("ok", () => alert("left!") )
   */
  unsubscribe(timeout = this.timeout) {
    this.state = CHANNEL_STATES.leaving
    let onClose = () => {
      this.socket.log('channel', `leave ${this.topic}`)
      this.trigger(CHANNEL_EVENTS.close, 'leave', this.joinRef())
    }
    // Destroy joinPush to avoid connection timeouts during unscription phase
    this.joinPush.destroy()

    let leavePush = new Push(this, CHANNEL_EVENTS.leave, {}, timeout)
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

  isMember(topic: string) {
    return this.topic === topic
  }

  joinRef() {
    return this.joinPush.ref
  }

  sendJoin(timeout: number) {
    this.state = CHANNEL_STATES.joining
    this.joinPush.resend(timeout)
  }

  rejoin(timeout = this.timeout) {
    if (this.isLeaving()) {
      return
    }
    this.sendJoin(timeout)
  }

  trigger(event: string, payload?: any, ref?: string) {
    let { close, error, leave, join } = CHANNEL_EVENTS
    let events: string[] = [close, error, leave, join]
    if (ref && events.indexOf(event) >= 0 && ref !== this.joinRef()) {
      return
    }
    let handledPayload = this.onMessage(event, payload, ref)
    if (payload && !handledPayload) {
      throw 'channel onMessage callbacks must return the payload, modified or unmodified'
    }

    this.bindings
      .filter((bind) => {
        // Bind all events if the user specifies a wildcard.
        if (bind.event === '*') {
          return event === payload?.type
        } else {
          return bind.event === event
        }
      })
      .map((bind) => bind.callback(handledPayload, ref))
  }

  replyEventName(ref: string) {
    return `chan_reply_${ref}`
  }

  isClosed() {
    return this.state === CHANNEL_STATES.closed
  }
  isErrored() {
    return this.state === CHANNEL_STATES.errored
  }
  isJoined() {
    return this.state === CHANNEL_STATES.joined
  }
  isJoining() {
    return this.state === CHANNEL_STATES.joining
  }
  isLeaving() {
    return this.state === CHANNEL_STATES.leaving
  }
}
