import { CHANNEL_STATES } from './lib/constants'
import type { ChannelState } from './lib/constants'
import type RealtimeClient from './RealtimeClient'
import RealtimePresence, { REALTIME_PRESENCE_LISTEN_EVENTS } from './RealtimePresence'
import type {
  RealtimePresenceJoinPayload,
  RealtimePresenceLeavePayload,
  RealtimePresenceState,
} from './RealtimePresence'
import * as Transformers from './lib/transformers'
import { httpEndpointURL } from './lib/transformers'
import ChannelAdapter from './phoenix/channelAdapter'
import { BindingCallback, ChanelOnErrorCallback } from './phoenix/types'
import { Timer } from 'phoenix'

type ReplayOption = {
  since: number
  limit?: number
}

export type RealtimeChannelOptions = {
  config: {
    /**
     * self option enables client to receive message it broadcast
     * ack option instructs server to acknowledge that broadcast message was received
     * replay option instructs server to replay broadcast messages
     */
    broadcast?: { self?: boolean; ack?: boolean; replay?: ReplayOption }
    /**
     * key option is used to track presence payload across clients
     */
    presence?: { key?: string; enabled?: boolean }
    /**
     * defines if the channel is private or not and if RLS policies will be used to check data
     */
    private?: boolean
  }
}

type RealtimeChangesPayloadBase = {
  schema: string
  table: string
}

type RealtimeBroadcastChangesPayloadBase = RealtimeChangesPayloadBase & {
  id: string
}

export type RealtimeBroadcastInsertPayload<T extends { [key: string]: any }> =
  RealtimeBroadcastChangesPayloadBase & {
    operation: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT}`
    record: T
    old_record: null
  }

export type RealtimeBroadcastUpdatePayload<T extends { [key: string]: any }> =
  RealtimeBroadcastChangesPayloadBase & {
    operation: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE}`
    record: T
    old_record: T
  }

export type RealtimeBroadcastDeletePayload<T extends { [key: string]: any }> =
  RealtimeBroadcastChangesPayloadBase & {
    operation: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE}`
    record: null
    old_record: T
  }

export type RealtimeBroadcastPayload<T extends { [key: string]: any }> =
  | RealtimeBroadcastInsertPayload<T>
  | RealtimeBroadcastUpdatePayload<T>
  | RealtimeBroadcastDeletePayload<T>

type RealtimePostgresChangesPayloadBase = {
  schema: string
  table: string
  commit_timestamp: string
  errors: string[]
}

export type RealtimePostgresInsertPayload<T extends { [key: string]: any }> =
  RealtimePostgresChangesPayloadBase & {
    eventType: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT}`
    new: T
    old: {}
  }

export type RealtimePostgresUpdatePayload<T extends { [key: string]: any }> =
  RealtimePostgresChangesPayloadBase & {
    eventType: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE}`
    new: T
    old: Partial<T>
  }

export type RealtimePostgresDeletePayload<T extends { [key: string]: any }> =
  RealtimePostgresChangesPayloadBase & {
    eventType: `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE}`
    new: {}
    old: Partial<T>
  }

export type RealtimePostgresChangesPayload<T extends { [key: string]: any }> =
  | RealtimePostgresInsertPayload<T>
  | RealtimePostgresUpdatePayload<T>
  | RealtimePostgresDeletePayload<T>

export type RealtimePostgresChangesFilter<T extends `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT}`> = {
  /**
   * The type of database change to listen to.
   */
  event: T
  /**
   * The database schema to listen to.
   */
  schema: string
  /**
   * The database table to listen to.
   */
  table?: string
  /**
   * Receive database changes when filter is matched.
   */
  filter?: string
}

export type RealtimeChannelSendResponse = 'ok' | 'timed out' | 'error'

export enum REALTIME_POSTGRES_CHANGES_LISTEN_EVENT {
  ALL = '*',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum REALTIME_LISTEN_TYPES {
  BROADCAST = 'broadcast',
  PRESENCE = 'presence',
  POSTGRES_CHANGES = 'postgres_changes',
  SYSTEM = 'system',
}

export enum REALTIME_SUBSCRIBE_STATES {
  SUBSCRIBED = 'SUBSCRIBED',
  TIMED_OUT = 'TIMED_OUT',
  CLOSED = 'CLOSED',
  CHANNEL_ERROR = 'CHANNEL_ERROR',
}

export const REALTIME_CHANNEL_STATES = CHANNEL_STATES

type PostgresChangesFilters = {
  postgres_changes: {
    id: string
    event: string
    schema?: string
    table?: string
    filter?: string
  }[]
}

type Binding = {
  type: string
  filter: { [key: string]: any }
  callback: Function
  ref: number
  id?: string
}

/** A channel is the basic building block of Realtime
 * and narrows the scope of data flow to subscribed clients.
 * You can think of a channel as a chatroom where participants are able to see who's online
 * and send and receive messages.
 */
export default class RealtimeChannel {
  bindings: Record<string, Binding[]> = {}
  subTopic: string
  broadcastEndpointURL: string
  private: boolean
  presence: RealtimePresence
  channelAdapter: ChannelAdapter

  get state() {
    return this.channelAdapter.state
  }

  set state(state: ChannelState) {
    this.channelAdapter.state = state
  }

  get joinedOnce() {
    return this.channelAdapter.joinedOnce
  }

  get timeout() {
    return this.socket.timeout
  }

  get joinPush() {
    return this.channelAdapter.joinPush
  }

  get rejoinTimer(): Timer {
    return this.channelAdapter.rejoinTimer
  }

  /**
   * Creates a channel that can broadcast messages, sync presence, and listen to Postgres changes.
   *
   * The topic determines which realtime stream you are subscribing to. Config options let you
   * enable acknowledgement for broadcasts, presence tracking, or private channels.
   *
   * @example
   * ```ts
   * import RealtimeClient from '@supabase/realtime-js'
   *
   * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
   *   params: { apikey: 'public-anon-key' },
   * })
   * const channel = new RealtimeChannel('realtime:public:messages', { config: {} }, client)
   * ```
   */
  constructor(
    /** Topic name can be any string. */
    public topic: string,
    public params: RealtimeChannelOptions = { config: {} },
    public socket: RealtimeClient
  ) {
    this.subTopic = topic.replace(/^realtime:/i, '')
    this.params.config = {
      ...{
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        private: false,
      },
      ...params.config,
    }

    this.channelAdapter = new ChannelAdapter(this.socket.socketAdapter, topic, this.params)
    this.presence = new RealtimePresence(this)

    this._onClose(() => {
      this.socket._remove(this)
    })

    this.broadcastEndpointURL = httpEndpointURL(this.socket.socketAdapter.endPointURL())
    this.private = this.params.config.private || false

    if (!this.private && this.params.config?.broadcast?.replay) {
      throw `tried to use replay on public channel '${this.topic}'. It must be a private channel.`
    }
  }

  /** Subscribe registers your client with the server */
  subscribe(
    callback?: (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void,
    timeout = this.timeout
  ): RealtimeChannel {
    if (!this.socket.isConnected()) {
      this.socket.connect()
    }
    if (this.channelAdapter.isClosed()) {
      const {
        config: { broadcast, presence, private: isPrivate },
      } = this.params

      const postgres_changes = this.bindings.postgres_changes?.map((r) => r.filter) ?? []

      const presence_enabled =
        (!!this.bindings[REALTIME_LISTEN_TYPES.PRESENCE] &&
          this.bindings[REALTIME_LISTEN_TYPES.PRESENCE].length > 0) ||
        this.params.config.presence?.enabled === true
      const accessTokenPayload: { access_token?: string } = {}
      const config = {
        broadcast,
        presence: { ...presence, enabled: presence_enabled },
        postgres_changes,
        private: isPrivate,
      }

      if (this.socket.accessTokenValue) {
        accessTokenPayload.access_token = this.socket.accessTokenValue
      }

      this._onError((reason: Error) => {
        callback?.(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, reason)
      })

      this._onClose(() => callback?.(REALTIME_SUBSCRIBE_STATES.CLOSED))

      this._updateFilterTransform()

      this.updateJoinPayload({ ...{ config }, ...accessTokenPayload })

      this.channelAdapter
        .subscribe(timeout)
        .receive('ok', async ({ postgres_changes }: PostgresChangesFilters) => {
          // Only refresh auth if using callback-based tokens
          if (!this.socket._isManualToken()) {
            this.socket.setAuth()
          }
          if (postgres_changes === undefined) {
            callback?.(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED)
            return
          }

          this._updatePostgresBindings(postgres_changes, callback)
        })
        .receive('error', (error: { [key: string]: any }) => {
          this.state = CHANNEL_STATES.errored
          callback?.(
            REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
            new Error(JSON.stringify(Object.values(error).join(', ') || 'error'))
          )
        })
        .receive('timeout', () => {
          callback?.(REALTIME_SUBSCRIBE_STATES.TIMED_OUT)
        })
    }
    return this
  }

  private _updatePostgresBindings(
    postgres_changes: PostgresChangesFilters['postgres_changes'],
    callback?: (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void
  ): Binding[] | undefined {
    const clientPostgresBindings = this.bindings.postgres_changes
    const bindingsLen = clientPostgresBindings?.length ?? 0
    const newPostgresBindings = []

    for (let i = 0; i < bindingsLen; i++) {
      const clientPostgresBinding = clientPostgresBindings[i]
      const {
        filter: { event, schema, table, filter },
      } = clientPostgresBinding
      const serverPostgresFilter = postgres_changes && postgres_changes[i]

      if (
        serverPostgresFilter &&
        serverPostgresFilter.event === event &&
        RealtimeChannel.isFilterValueEqual(serverPostgresFilter.schema, schema) &&
        RealtimeChannel.isFilterValueEqual(serverPostgresFilter.table, table) &&
        RealtimeChannel.isFilterValueEqual(serverPostgresFilter.filter, filter)
      ) {
        newPostgresBindings.push({
          ...clientPostgresBinding,
          id: serverPostgresFilter.id,
        })
      } else {
        this.unsubscribe()
        this.channelAdapter.state = CHANNEL_STATES.errored

        callback?.(
          REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
          new Error('mismatch between server and client bindings for postgres changes')
        )
        return
      }
    }

    this.bindings.postgres_changes = newPostgresBindings

    callback && callback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED)
  }

  /**
   * Returns the current presence state for this channel.
   *
   * The shape is a map keyed by presence key (for example a user id) where each entry contains the
   * tracked metadata for that user.
   */
  presenceState<T extends { [key: string]: any } = {}>(): RealtimePresenceState<T> {
    return this.presence.state as RealtimePresenceState<T>
  }

  /**
   * Sends the supplied payload to the presence tracker so other subscribers can see that this
   * client is online. Use `untrack` to stop broadcasting presence for the same key.
   */
  async track(
    payload: { [key: string]: any },
    opts: { [key: string]: any } = {}
  ): Promise<RealtimeChannelSendResponse> {
    return await this.send(
      {
        type: 'presence',
        event: 'track',
        payload,
      },
      opts.timeout || this.timeout
    )
  }

  /**
   * Removes the current presence state for this client.
   */
  async untrack(opts: { [key: string]: any } = {}): Promise<RealtimeChannelSendResponse> {
    return await this.send(
      {
        type: 'presence',
        event: 'untrack',
      },
      opts
    )
  }

  /**
   * Creates an event handler that listens to changes.
   */
  on(
    type: `${REALTIME_LISTEN_TYPES.PRESENCE}`,
    filter: { event: `${REALTIME_PRESENCE_LISTEN_EVENTS.SYNC}` },
    callback: () => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.PRESENCE}`,
    filter: { event: `${REALTIME_PRESENCE_LISTEN_EVENTS.JOIN}` },
    callback: (payload: RealtimePresenceJoinPayload<T>) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.PRESENCE}`,
    filter: { event: `${REALTIME_PRESENCE_LISTEN_EVENTS.LEAVE}` },
    callback: (payload: RealtimePresenceLeavePayload<T>) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`,
    filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL}`>,
    callback: (payload: RealtimePostgresChangesPayload<T>) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`,
    filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT}`>,
    callback: (payload: RealtimePostgresInsertPayload<T>) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`,
    filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE}`>,
    callback: (payload: RealtimePostgresUpdatePayload<T>) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`,
    filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE}`>,
    callback: (payload: RealtimePostgresDeletePayload<T>) => void
  ): RealtimeChannel
  /**
   * The following is placed here to display on supabase.com/docs/reference/javascript/subscribe.
   * @param type One of "broadcast", "presence", or "postgres_changes".
   * @param filter Custom object specific to the Realtime feature detailing which payloads to receive.
   * @param callback Function to be invoked when event handler is triggered.
   */
  on(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: string },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: string
      meta?: {
        replayed?: boolean
        id: string
      }
      [key: string]: any
    }) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: string },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: string
      meta?: {
        replayed?: boolean
        id: string
      }
      payload: T
    }) => void
  ): RealtimeChannel
  on<T extends Record<string, unknown>>(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL
      payload: RealtimeBroadcastPayload<T>
    }) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT
      payload: RealtimeBroadcastInsertPayload<T>
    }) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE
      payload: RealtimeBroadcastUpdatePayload<T>
    }) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.BROADCAST}`,
    filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE },
    callback: (payload: {
      type: `${REALTIME_LISTEN_TYPES.BROADCAST}`
      event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE
      payload: RealtimeBroadcastDeletePayload<T>
    }) => void
  ): RealtimeChannel
  on<T extends { [key: string]: any }>(
    type: `${REALTIME_LISTEN_TYPES.SYSTEM}`,
    filter: {},
    callback: (payload: any) => void
  ): RealtimeChannel
  on(
    type: `${REALTIME_LISTEN_TYPES}`,
    filter: { event: string; [key: string]: string },
    callback: (payload: any) => void
  ): RealtimeChannel {
    if (this.channelAdapter.isJoined() && type === REALTIME_LISTEN_TYPES.PRESENCE) {
      this.socket.log(
        'channel',
        `resubscribe to ${this.topic} due to change in presence callbacks on joined channel`
      )
      this.unsubscribe().then(() => this.subscribe())
    }
    return this._on(type, filter, callback)
  }
  /**
   * Sends a broadcast message explicitly via REST API.
   *
   * This method always uses the REST API endpoint regardless of WebSocket connection state.
   * Useful when you want to guarantee REST delivery or when gradually migrating from implicit REST fallback.
   *
   * @param event The name of the broadcast event
   * @param payload Payload to be sent (required)
   * @param opts Options including timeout
   * @returns Promise resolving to object with success status, and error details if failed
   */
  async httpSend(
    event: string,
    payload: any,
    opts: { timeout?: number } = {}
  ): Promise<{ success: true } | { success: false; status: number; error: string }> {
    const authorization = this.socket.accessTokenValue
      ? `Bearer ${this.socket.accessTokenValue}`
      : ''

    if (payload === undefined || payload === null) {
      return Promise.reject('Payload is required for httpSend()')
    }

    const options = {
      method: 'POST',
      headers: {
        Authorization: authorization,
        apikey: this.socket.apiKey ? this.socket.apiKey : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            topic: this.subTopic,
            event,
            payload: payload,
            private: this.private,
          },
        ],
      }),
    }

    const response = await this._fetchWithTimeout(
      this.broadcastEndpointURL,
      options,
      opts.timeout ?? this.timeout
    )

    if (response.status === 202) {
      return { success: true }
    }

    let errorMessage = response.statusText
    try {
      const errorBody = await response.json()
      errorMessage = errorBody.error || errorBody.message || errorMessage
    } catch {}

    return Promise.reject(new Error(errorMessage))
  }

  /**
   * Sends a message into the channel.
   *
   * @param args Arguments to send to channel
   * @param args.type The type of event to send
   * @param args.event The name of the event being sent
   * @param args.payload Payload to be sent
   * @param opts Options to be used during the send process
   */
  async send(
    args: {
      type: 'broadcast' | 'presence' | 'postgres_changes'
      event: string
      payload?: any
      [key: string]: any
    },
    opts: { [key: string]: any } = {}
  ): Promise<RealtimeChannelSendResponse> {
    if (!this.channelAdapter.canPush() && args.type === 'broadcast') {
      console.warn(
        'Realtime send() is automatically falling back to REST API. ' +
          'This behavior will be deprecated in the future. ' +
          'Please use httpSend() explicitly for REST delivery.'
      )

      const { event, payload: endpoint_payload } = args
      const authorization = this.socket.accessTokenValue
        ? `Bearer ${this.socket.accessTokenValue}`
        : ''
      const options = {
        method: 'POST',
        headers: {
          Authorization: authorization,
          apikey: this.socket.apiKey ? this.socket.apiKey : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              topic: this.subTopic,
              event,
              payload: endpoint_payload,
              private: this.private,
            },
          ],
        }),
      }

      try {
        const response = await this._fetchWithTimeout(
          this.broadcastEndpointURL,
          options,
          opts.timeout ?? this.timeout
        )

        await response.body?.cancel()
        return response.ok ? 'ok' : 'error'
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return 'timed out'
        } else {
          return 'error'
        }
      }
    } else {
      return new Promise((resolve) => {
        const push = this.channelAdapter.push(args.type, args, opts.timeout || this.timeout)

        if (args.type === 'broadcast' && !this.params?.config?.broadcast?.ack) {
          resolve('ok')
        }

        push.receive('ok', () => resolve('ok'))
        push.receive('error', () => resolve('error'))
        push.receive('timeout', () => resolve('timed out'))
      })
    }
  }

  /**
   * Updates the payload that will be sent the next time the channel joins (reconnects).
   * Useful for rotating access tokens or updating config without re-creating the channel.
   */
  updateJoinPayload(payload: Record<string, any>) {
    this.channelAdapter.updateJoinPayload(payload)
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
    return new Promise((resolve) => {
      this.channelAdapter
        .unsubscribe(timeout)
        .receive('ok', () => resolve('ok'))
        .receive('timeout', () => resolve('timed out'))
        .receive('error', () => resolve('error'))
    })
  }

  /** @internal */
  async _fetchWithTimeout(url: string, options: { [key: string]: any }, timeout: number) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    const response = await this.socket.fetch(url, {
      ...options,
      signal: controller.signal,
    })

    clearTimeout(id)

    return response
  }

  /** @internal */
  _on(type: string, filter: { [key: string]: any }, callback: BindingCallback) {
    const typeLower = type.toLocaleLowerCase()

    const ref = this.channelAdapter.on(type, callback)

    const binding: Binding = {
      type: typeLower,
      filter: filter,
      callback: callback,
      ref: ref,
    }

    if (this.bindings[typeLower]) {
      this.bindings[typeLower].push(binding)
    } else {
      this.bindings[typeLower] = [binding]
    }

    this._updateFilterMessage()

    return this
  }

  /**
   * Registers a callback that will be executed when the channel closes.
   *
   * @internal
   */
  private _onClose(callback: BindingCallback) {
    this.channelAdapter.onClose(callback)
  }

  /**
   * Registers a callback that will be executed when the channel encounteres an error.
   *
   * @internal
   */
  private _onError(callback: ChanelOnErrorCallback) {
    this.channelAdapter.onError(callback)
  }

  /** @internal */
  private _updateFilterMessage() {
    this.channelAdapter.updateFilterMessage((event, payload: any, messageRef, phoenixBind) => {
      const typeLower = event.toLocaleLowerCase()
      const bind = this.bindings[typeLower]?.find((bind) => bind.ref === phoenixBind.ref)

      if (!bind) {
        return true
      }

      if (['broadcast', 'presence', 'postgres_changes'].includes(typeLower)) {
        if ('id' in bind) {
          const bindId = bind.id
          const bindEvent = bind.filter?.event
          return (
            bindId &&
            payload.ids?.includes(bindId) &&
            (bindEvent === '*' ||
              bindEvent?.toLocaleLowerCase() === payload.data?.type.toLocaleLowerCase())
          )
        } else {
          const bindEvent = bind?.filter?.event?.toLocaleLowerCase()
          return bindEvent === '*' || bindEvent === payload?.event?.toLocaleLowerCase()
        }
      } else {
        return bind.type.toLocaleLowerCase() === typeLower
      }
    })
  }

  /** @internal */
  private _updateFilterTransform() {
    this.channelAdapter.updatePayloadTransform((event, payload: any, ref) => {
      if (typeof payload === 'object' && 'ids' in payload) {
        const postgresChanges = payload.data
        const { schema, table, commit_timestamp, type, errors } = postgresChanges
        const enrichedPayload = {
          schema: schema,
          table: table,
          commit_timestamp: commit_timestamp,
          eventType: type,
          new: {},
          old: {},
          errors: errors,
        }
        return {
          ...enrichedPayload,
          ...this._getPayloadRecords(postgresChanges),
        }
      }

      return payload
    })
  }

  /**
   * Compares two optional filter values for equality.
   * Treats undefined, null, and empty string as equivalent empty values.
   * @internal
   */
  private static isFilterValueEqual(
    serverValue: string | undefined | null,
    clientValue: string | undefined
  ): boolean {
    const normalizedServer = serverValue ?? undefined
    const normalizedClient = clientValue ?? undefined
    return normalizedServer === normalizedClient
  }

  /** @internal */
  private _getPayloadRecords(payload: any) {
    const records = {
      new: {},
      old: {},
    }

    if (payload.type === 'INSERT' || payload.type === 'UPDATE') {
      records.new = Transformers.convertChangeData(payload.columns, payload.record)
    }

    if (payload.type === 'UPDATE' || payload.type === 'DELETE') {
      records.old = Transformers.convertChangeData(payload.columns, payload.old_record)
    }

    return records
  }
}
