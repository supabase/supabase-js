import { RealtimeSubscription, RealtimeClient, Transformers } from '@supabase/realtime-js'
import { SupabaseRealtimePayload } from './types'


export class SupabaseRealtimeClient {
  subscription: RealtimeSubscription

  constructor(socket: RealtimeClient, schema: string, tableName: string) {
    let topic = tableName == '*' ? `realtime:${schema}` : `realtime:${schema}:${tableName}`
    this.subscription = socket.channel(topic)
  }

  /**
   * The event you want to listen to.
   *
   * @param event The event
   * @param callback A callback function that is called whenever the event occurs.
   */
  on(event: 'INSERT' | 'UPDATE' | 'DELETE' | '*', callback: Function) {
    this.subscription.on(event, (payload: any) => {
      let enrichedPayload: SupabaseRealtimePayload<any> = {
        schema: payload.schema,
        table: payload.table,
        commit_timestamp: payload.commit_timestamp,
        eventType: payload.type,
        new: {},
        old: {},
      }

      switch (payload.type) {
        case 'INSERT':
          enrichedPayload.new = Transformers.convertChangeData(payload.columns, payload.record)
          break

        case 'UPDATE':
          enrichedPayload.new = Transformers.convertChangeData(payload.columns, payload.record)
          enrichedPayload.old = Transformers.convertChangeData(payload.columns, payload.old_record)
          break

        case 'DELETE':
          enrichedPayload.old = Transformers.convertChangeData(payload.columns, payload.old_record)
          break

        default:
          break
      }

      callback(enrichedPayload)
    })
    return this
  }

  /**
   * Enables the subscription.
   */
  subscribe(callback: Function = () => {}) {
    this.subscription.onError((e: Error) => callback('SUBSCRIPTION_ERROR', e))
    this.subscription.onClose(() => callback('CLOSED'))
    this.subscription
      .subscribe()
      .receive('ok', () => callback('SUBSCRIBED'))
      .receive('error', (e: Error) => callback('SUBSCRIPTION_ERROR', e))
      .receive('timeout', () => callback('RETRYING_AFTER_TIMEOUT'))
    return this.subscription
  }
}
