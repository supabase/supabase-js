import { CHANNEL_EVENTS, CHANNEL_STATES } from './lib/constants'
import Push from './lib/push'
import RealtimeClient from './RealtimeClient'
import Timer from './lib/timer'
import RealtimePresence, { PresenceState } from './RealtimePresence'
import * as Transformers from './lib/transformers'

export default class RealtimeChannel {
  bindings: {
    [key: string]: {
      type: string
      filter: { [key: string]: any }
      callback: Function
      id?: string
    }[]
  } = {}
  timeout: number
  state = CHANNEL_STATES.closed
  joinedOnce = false
  joinPush: Push
  rejoinTimer: Timer
  pushBuffer: Push[] = []
  presence: RealtimePresence

  constructor(
    public topic: string,
    public params: { [key: string]: any } = {},
    public socket: RealtimeClient
  ) {
    this.params.config = {
      ...{
        broadcast: { ack: false, self: false },
        presence: { key: '' },
      },
      ...params.config,
    }
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

  rejoinUntilConnected() {
    this.rejoinTimer.scheduleTimeout()
    if (this.socket.isConnected()) {
      this.rejoin()
    }
  }

  subscribe(callback?: Function, timeout = this.timeout): void {
    if (this.joinedOnce) {
      throw `tried to subscribe multiple times. 'subscribe' can only be called a single time per channel instance`
    } else {
      const {
        config: { broadcast, presence },
      } = this.params
      this.onError((e: Error) => callback && callback('CHANNEL_ERROR', e))
      this.onClose(() => callback && callback('CLOSED'))

      const accessTokenPayload: { access_token?: string } = {}
      const config = {
        broadcast,
        presence,
        postgres_changes:
          this.bindings.postgres_changes?.map((r) => r.filter) ?? [],
      }

      if (this.socket.accessToken) {
        accessTokenPayload.access_token = this.socket.accessToken
      }

      this.updateJoinPayload({ ...{ config }, ...accessTokenPayload })

      this.joinedOnce = true
      this.rejoin(timeout)

      this.joinPush
        .receive(
          'ok',
          ({
            postgres_changes: serverPostgresFilters,
          }: {
            postgres_changes: {
              id: string
              event: string
              schema?: string
              table?: string
              filter?: string
            }[]
          }) => {
            this.socket.accessToken &&
              this.socket.setAuth(this.socket.accessToken)

            if (serverPostgresFilters === undefined) {
              callback && callback('SUBSCRIBED')
              return
            } else {
              const clientPostgresBindings = this.bindings.postgres_changes
              const bindingsLen = clientPostgresBindings?.length ?? 0
              const newPostgresBindings = []

              for (let i = 0; i < bindingsLen; i++) {
                const clientPostgresBinding = clientPostgresBindings[i]
                const {
                  filter: { event, schema, table, filter },
                } = clientPostgresBinding
                const serverPostgresFilter =
                  serverPostgresFilters && serverPostgresFilters[i]

                if (
                  serverPostgresFilter &&
                  serverPostgresFilter.event === event &&
                  serverPostgresFilter.schema === schema &&
                  serverPostgresFilter.table === table &&
                  serverPostgresFilter.filter === filter
                ) {
                  newPostgresBindings.push({
                    ...clientPostgresBinding,
                    id: serverPostgresFilter.id,
                  })
                } else {
                  this.unsubscribe()
                  callback &&
                    callback(
                      'CHANNEL_ERROR',
                      new Error(
                        'mismatch between server and client bindings for postgres changes'
                      )
                    )
                  return
                }
              }

              this.bindings.postgres_changes = newPostgresBindings

              callback && callback('SUBSCRIBED')
              return
            }
          }
        )
        .receive('error', (error: { [key: string]: any }) => {
          callback &&
            callback(
              'CHANNEL_ERROR',
              new Error(
                JSON.stringify(Object.values(error).join(', ') || 'error')
              )
            )
          return
        })
        .receive('timeout', () => {
          callback && callback('TIMED OUT')
          return
        })
    }
  }

  presenceState(): PresenceState {
    return this.presence.state
  }

  async track(
    payload: { [key: string]: any },
    opts: { [key: string]: any } = {}
  ): Promise<'ok' | 'timed out' | 'rate limited'> {
    return await this.send(
      {
        type: 'presence',
        event: 'track',
        payload,
      },
      opts.timeout || this.timeout
    )
  }

  async untrack(
    opts: { [key: string]: any } = {}
  ): Promise<'ok' | 'timed out' | 'rate limited'> {
    return await this.send(
      {
        type: 'presence',
        event: 'untrack',
      },
      opts
    )
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

  on(type: string, filter: { [key: string]: any }, callback: Function) {
    const typeLower = type.toLocaleLowerCase()

    const binding = {
      type: typeLower,
      filter: filter,
      callback: callback,
    }

    if (this.bindings[typeLower]) {
      this.bindings[typeLower].push(binding)
    } else {
      this.bindings[typeLower] = [binding]
    }

    return this
  }

  off(type: string, filter: { [key: string]: any }) {
    const typeLower = type.toLocaleLowerCase()

    this.bindings[typeLower] = this.bindings[typeLower].filter((bind) => {
      return !(
        bind.type?.toLocaleLowerCase() === typeLower &&
        RealtimeChannel.isEqual(bind.filter, filter)
      )
    })
    return this
  }

  /**
   * Returns `true` if the socket is connected and the channel has been joined.
   */
  canPush(): boolean {
    return this.socket.isConnected() && this.isJoined()
  }

  push(event: string, payload: { [key: string]: any }, timeout = this.timeout) {
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

  send(
    payload: { type: string; [key: string]: any },
    opts: { [key: string]: any } = {}
  ): Promise<'ok' | 'timed out' | 'rate limited'> {
    return new Promise((resolve) => {
      const push = this.push(
        payload.type,
        payload,
        opts.timeout || this.timeout
      )

      if (push.rateLimited) {
        resolve('rate limited')
      }

      if (
        payload.type === 'broadcast' &&
        !this.params?.config?.broadcast?.ack
      ) {
        resolve('ok')
      }

      push.receive('ok', () => resolve('ok'))
      push.receive('timeout', () => resolve('timed out'))
    })
  }

  updateJoinPayload(payload: { [key: string]: any }): void {
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
  unsubscribe(timeout = this.timeout): Promise<'ok' | 'timed out' | 'error'> {
    this.state = CHANNEL_STATES.leaving
    const onClose = () => {
      this.socket.log('channel', `leave ${this.topic}`)
      this.trigger(CHANNEL_EVENTS.close, 'leave', this.joinRef())
    }
    // Destroy joinPush to avoid connection timeouts during unscription phase
    this.joinPush.destroy()

    return new Promise((resolve) => {
      const leavePush = new Push(this, CHANNEL_EVENTS.leave, {}, timeout)

      leavePush
        .receive('ok', () => {
          onClose()
          resolve('ok')
        })
        .receive('timeout', () => {
          onClose()
          resolve('timed out')
        })
        .receive('error', () => {
          onClose()
          resolve('error')
        })

      leavePush.send()

      if (!this.canPush()) {
        leavePush.trigger('ok', {})
      }
    })
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
    const typeLower = type.toLocaleLowerCase()
    const { close, error, leave, join } = CHANNEL_EVENTS
    const events: string[] = [close, error, leave, join]
    if (ref && events.indexOf(typeLower) >= 0 && ref !== this.joinRef()) {
      return
    }
    let handledPayload = this.onMessage(typeLower, payload, ref)
    if (payload && !handledPayload) {
      throw 'channel onMessage callbacks must return the payload, modified or unmodified'
    }

    if (['insert', 'update', 'delete'].includes(typeLower)) {
      this.bindings.postgres_changes
        ?.filter((bind) => {
          return (
            bind.filter?.event === '*' ||
            bind.filter?.event?.toLocaleLowerCase() === typeLower
          )
        })
        .map((bind) => bind.callback(handledPayload, ref))
    } else {
      this.bindings[typeLower]
        ?.filter((bind) => {
          if (
            ['broadcast', 'presence', 'postgres_changes'].includes(typeLower)
          ) {
            if ('id' in bind) {
              const bindId = bind.id
              const bindEvent = bind.filter?.event
              return (
                bindId &&
                payload.ids?.includes(bindId) &&
                (bindEvent === '*' ||
                  bindEvent?.toLocaleLowerCase() ===
                    payload.data?.type.toLocaleLowerCase())
              )
            } else {
              const bindEvent = bind?.filter?.event?.toLocaleLowerCase()
              return (
                bindEvent === '*' ||
                bindEvent === payload?.event?.toLocaleLowerCase()
              )
            }
          } else {
            return bind.type.toLocaleLowerCase() === typeLower
          }
        })
        .map((bind) => {
          if (typeof handledPayload === 'object' && 'ids' in handledPayload) {
            const postgresChanges = handledPayload.data
            const { schema, table, commit_timestamp, type, errors } =
              postgresChanges
            const enrichedPayload = {
              schema: schema,
              table: table,
              commit_timestamp: commit_timestamp,
              eventType: type,
              new: {},
              old: {},
              errors: errors,
            }
            handledPayload = {
              ...enrichedPayload,
              ...this.getPayloadRecords(postgresChanges),
            }
          }
          bind.callback(handledPayload, ref)
        })
    }
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

  private getPayloadRecords(payload: any) {
    const records = {
      new: {},
      old: {},
    }

    if (payload.type === 'INSERT' || payload.type === 'UPDATE') {
      records.new = Transformers.convertChangeData(
        payload.columns,
        payload.record
      )
    }

    if (payload.type === 'UPDATE' || payload.type === 'DELETE') {
      records.old = Transformers.convertChangeData(
        payload.columns,
        payload.old_record
      )
    }

    return records
  }
}
