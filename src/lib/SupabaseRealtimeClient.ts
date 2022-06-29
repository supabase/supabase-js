import { RealtimeClient, RealtimeSubscription, Transformers } from '@supabase/realtime-js'
import { SupabaseEventTypes, SupabaseRealtimePayload } from './types'

export class SupabaseRealtimeClient {
  socket: RealtimeClient
  subscription: RealtimeSubscription

  constructor(socket: RealtimeClient, schema: string, tableName: string) {
    const topic = tableName === '*' ? `realtime:${schema}` : `realtime:${schema}:${tableName}`

    this.socket = socket
    this.subscription = socket.channel(topic) as RealtimeSubscription
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
   * @param callback A callback function that is called whenever the event occurs.
   */
  on(event: SupabaseEventTypes, callback: (payload: SupabaseRealtimePayload<any>) => void) {
    this.subscription.on(event, (payload: any) => {
      let enrichedPayload: SupabaseRealtimePayload<any> = {
        schema: payload.schema,
        table: payload.table,
        commit_timestamp: payload.commit_timestamp,
        eventType: payload.type,
        new: {},
        old: {},
        errors: payload.errors,
      }

      enrichedPayload = { ...enrichedPayload, ...this.getPayloadRecords(payload) }

      callback(enrichedPayload)
    })
    return this
  }

  /**
   * Enables the subscription.
   */
  subscribe(callback: Function = () => {}) {
    // if the socket already has a good accessToken
    // we can just use it strait away∏
    if (this.socket.accessToken) {
      this.subscription.updateJoinPayload({
        user_token: this.socket.accessToken,
      })
    }

    this.subscription.onError((e: Error) => callback('SUBSCRIPTION_ERROR', e))
    this.subscription.onClose(() => callback('CLOSED'))
    this.subscription
      .subscribe()
      .receive('ok', () => {
        callback('SUBSCRIBED')

        // re-set the accessToken again in case it was set while
        // the subscription was isJoining
        if (this.socket.accessToken) {
          this.socket.setAuth(this.socket.accessToken)
        }
      })
      .receive('error', (e: Error) => callback('SUBSCRIPTION_ERROR', e))
      .receive('timeout', () => callback('RETRYING_AFTER_TIMEOUT'))

    return this.subscription
  }
}
