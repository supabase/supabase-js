import { RealtimeChannel, RealtimeClient, Transformers } from '@supabase/realtime-js'

export class SupabaseRealtimeChannel {
  socket: RealtimeClient
  channel: RealtimeChannel

  constructor(name: string, opts: { [key: string]: any } = {}, socket: RealtimeClient) {
    this.socket = socket
    this.channel = socket.channel(`realtime:${name}`, opts) as RealtimeChannel
  }

  /**
   * The event you want to listen to.
   *
   * @param event The event
   * @param filter An object that specifies what you want to listen to from the event.
   * @param callback A callback function that is called whenever the event occurs.
   */
  on(event: string, filter?: Record<string, string>, callback?: (payload: any) => void) {
    this.channel.on(event, filter ?? {}, ({ payload }: { payload: any }) => {
      let enrichedPayload = payload

      if (event === 'realtime') {
        const { schema, table, commit_timestamp, type, errors } = enrichedPayload
        enrichedPayload = {
          schema: schema,
          table: table,
          commit_timestamp: commit_timestamp,
          eventType: type,
          new: {},
          old: {},
          errors: errors,
        }
        enrichedPayload = { ...enrichedPayload, ...this.getPayloadRecords(payload) }
      }

      callback && callback(enrichedPayload)
    })

    return this
  }

  /**
   * Enables the channel.
   */
  subscribe(callback: Function = () => {}) {
    // if the socket already has a good accessToken
    // we can just use it straight away
    if (this.socket.accessToken) {
      this.channel.updateJoinPayload({
        user_token: this.socket.accessToken,
      })
    }

    this.channel.onError((e: Error) => callback('CHANNEL_ERROR', e))
    this.channel.onClose(() => callback('CLOSED'))
    this.channel
      .subscribe()
      .receive('ok', () => {
        callback('SUBSCRIBED')

        // re-set the accessToken again in case it was set while
        // the subscription was isJoining
        if (this.socket.accessToken) {
          this.socket.setAuth(this.socket.accessToken)
        }
      })
      .receive('error', (e: Error) => callback('CHANNEL_ERROR', e))
      .receive('timeout', () => callback('RETRYING_AFTER_TIMEOUT'))

    return this.channel
  }

  presenceList() {
    return this.channel.presence.list()
  }

  send(
    payload: { type: string; [key: string]: any },
    opts: { [key: string]: any } = {}
  ): Promise<['ok' | 'timeout', number]> {
    return new Promise((resolve) => {
      const now = performance.now()
      const timeout = opts.timeout || this.channel.timeout

      this.channel
        .push(payload.type, payload, timeout)
        .receive('ok', () => {
          const diff = performance.now() - now
          resolve(['ok', diff])
        })
        .receive('timeout', () => {
          resolve(['timeout', timeout])
        })
    })
  }

  async track(
    payload: { [key: string]: any },
    opts: { [key: string]: any } = {}
  ): Promise<['ok' | 'timeout', number]> {
    return await this.send(
      {
        type: 'presence',
        event: 'track',
        payload,
      },
      opts
    )
  }

  async untrack(opts: { [key: string]: any } = {}): Promise<['ok' | 'timeout', number]> {
    return await this.send(
      {
        type: 'presence',
        event: 'untrack',
      },
      opts
    )
  }

  private getPayloadRecords(payload: any) {
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
