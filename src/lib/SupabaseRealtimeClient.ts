import { RealtimeChannel, RealtimeClient, Transformers } from '@supabase/realtime-js'
import { GenericObject, SupabaseRealtimePayload } from './types'

export class SupabaseRealtimeClient {
  channel: RealtimeChannel

  constructor(socket: RealtimeClient, name: string, token: string, opts?: { [key: string]: any }) {
    let chanParams: GenericObject = { user_token: token }

    if (opts) {
      chanParams = { ...chanParams, ...opts }
    }

    this.channel = socket.channel(`realtime:${name}`, chanParams) as RealtimeChannel
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
  on(
    event: string,
    filter?: GenericObject,
    callback?: (payload: SupabaseRealtimePayload<any>) => void
  ) {
    this.channel.on(event, filter ?? {}, (payload: any) => {
      const { schema, table, commit_timestamp, type, errors } = payload.payload
      let enrichedPayload: SupabaseRealtimePayload<any> = {
        schema: schema,
        table: table,
        commit_timestamp: commit_timestamp,
        eventType: type,
        new: {},
        old: {},
        errors: errors,
      }

      enrichedPayload = { ...enrichedPayload, ...this.getPayloadRecords(payload.payload) }

      callback && callback(enrichedPayload)
    })
    return this
  }

  /**
   * Enables the channel.
   */
  subscribe(callback: Function = () => {}) {
    this.channel.onError((e: Error) => callback('CHANNEL_ERROR', e))
    this.channel.onClose(() => callback('CLOSED'))
    this.channel
      .subscribe()
      .receive('ok', () => callback('SUBSCRIBED'))
      .receive('error', (e: Error) => callback('CHANNEL_ERROR', e))
      .receive('timeout', () => callback('RETRYING_AFTER_TIMEOUT'))
    return this.channel
  }
}
