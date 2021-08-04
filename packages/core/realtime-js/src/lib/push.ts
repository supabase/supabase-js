import { DEFAULT_TIMEOUT } from '../lib/constants'
import RealtimeSubscription from '../RealtimeSubscription'

export default class Push {
  sent: boolean = false
  timeoutTimer: number | undefined = undefined
  ref: string = ''
  receivedResp: {
    status: string
    response: Function
  } | null = null
  recHooks: {
    status: string
    callback: Function
  }[] = []
  refEvent: string | null = null

  /**
   * Initializes the Push
   *
   * @param channel The Channel
   * @param event The event, for example `"phx_join"`
   * @param payload The payload, for example `{user_id: 123}`
   * @param timeout The push timeout in milliseconds
   */
  constructor(
    public channel: RealtimeSubscription,
    public event: string,
    public payload: any = {},
    public timeout: number = DEFAULT_TIMEOUT
  ) {}

  resend(timeout: number) {
    this.timeout = timeout
    this._cancelRefEvent()
    this.ref = ''
    this.refEvent = null
    this.receivedResp = null
    this.sent = false
    this.send()
  }

  send() {
    if (this._hasReceived('timeout')) {
      return
    }
    this.startTimeout()
    this.sent = true
    this.channel.socket.push({
      topic: this.channel.topic,
      event: this.event,
      payload: this.payload,
      ref: this.ref,
    })
  }

  receive(status: string, callback: Function) {
    if (this._hasReceived(status)) {
      callback(this.receivedResp?.response)
    }

    this.recHooks.push({ status, callback })
    return this
  }

  startTimeout() {
    if (this.timeoutTimer) {
      return
    }
    this.ref = this.channel.socket.makeRef()
    this.refEvent = this.channel.replyEventName(this.ref)

    this.channel.on(this.refEvent, (payload: any) => {
      this._cancelRefEvent()
      this._cancelTimeout()
      this.receivedResp = payload
      this._matchReceive(payload)
    })

    this.timeoutTimer = <any>setTimeout(() => {
      this.trigger('timeout', {})
    }, this.timeout)
  }

  trigger(status: string, response: any) {
    if (this.refEvent) this.channel.trigger(this.refEvent, { status, response })
  }

  destroy() {
    this._cancelRefEvent()
    this._cancelTimeout()
  }

  private _cancelRefEvent() {
    if (!this.refEvent) {
      return
    }
    this.channel.off(this.refEvent)
  }

  private _cancelTimeout() {
    clearTimeout(this.timeoutTimer)
    this.timeoutTimer = undefined
  }

  private _matchReceive({
    status,
    response,
  }: {
    status: string
    response: Function
  }) {
    this.recHooks
      .filter((h) => h.status === status)
      .forEach((h) => h.callback(response))
  }

  private _hasReceived(status: string) {
    return this.receivedResp && this.receivedResp.status === status
  }
}
