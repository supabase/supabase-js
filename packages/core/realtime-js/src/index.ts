import RealtimeClient, {
  RealtimeClientOptions,
  RealtimeMessage,
  RealtimeRemoveChannelResponse,
  WebSocketLikeConstructor,
} from './RealtimeClient'
import RealtimeChannel, {
  RealtimeChannelOptions,
  RealtimeChannelSendResponse,
  RealtimePostgresChangesFilter,
  RealtimePostgresChangesPayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  RealtimePostgresDeletePayload,
  REALTIME_LISTEN_TYPES,
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
  REALTIME_SUBSCRIBE_STATES,
  REALTIME_CHANNEL_STATES,
} from './RealtimeChannel'
import RealtimePresence, {
  RealtimePresenceState,
  RealtimePresenceJoinPayload,
  RealtimePresenceLeavePayload,
  REALTIME_PRESENCE_LISTEN_EVENTS,
} from './RealtimePresence'
import WebSocketFactory, { WebSocketLike } from './lib/websocket-factory'

// Export classes and functions (runtime values)
export {
  RealtimePresence,
  RealtimeChannel,
  RealtimeClient,
  REALTIME_LISTEN_TYPES,
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
  REALTIME_PRESENCE_LISTEN_EVENTS,
  REALTIME_SUBSCRIBE_STATES,
  REALTIME_CHANNEL_STATES,
  WebSocketFactory,
}

// Export types only (no runtime values)
export type {
  RealtimeChannelOptions,
  RealtimeChannelSendResponse,
  RealtimeClientOptions,
  RealtimeMessage,
  RealtimePostgresChangesFilter,
  RealtimePostgresChangesPayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  RealtimePostgresDeletePayload,
  RealtimePresenceJoinPayload,
  RealtimePresenceLeavePayload,
  RealtimePresenceState,
  RealtimeRemoveChannelResponse,
  WebSocketLike,
  WebSocketLikeConstructor,
}
