import { RealtimeChannel, RealtimeClient, Transformers } from '@supabase/realtime-js'
import { SupabaseRealtimePayload } from './types'

export class SupabaseRealtimeClient {
  socket: RealtimeClient
  channel: RealtimeChannel

  constructor(socket: RealtimeClient, name: string, opts: { [key: string]: any } = {}) {
    this.socket = socket
    this.channel = socket.channel(`realtime:${name}`, opts) as RealtimeChannel
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
}
