/*
  This file draws heavily from https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/assets/js/phoenix/presence.js
  License: https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/LICENSE.md
*/

import type RealtimeChannel from './RealtimeChannel'
import PresenceAdapter from './phoenix/presenceAdapter'

export type Presence<T extends { [key: string]: any } = {}> = {
  presence_ref: string
} & T

export type RealtimePresenceState<T extends { [key: string]: any } = {}> = {
  [key: string]: Presence<T>[]
}

export type RealtimePresenceJoinPayload<T extends { [key: string]: any }> = {
  event: `${REALTIME_PRESENCE_LISTEN_EVENTS.JOIN}`
  key: string
  currentPresences: Presence<T>[]
  newPresences: Presence<T>[]
}

export type RealtimePresenceLeavePayload<T extends { [key: string]: any }> = {
  event: `${REALTIME_PRESENCE_LISTEN_EVENTS.LEAVE}`
  key: string
  currentPresences: Presence<T>[]
  leftPresences: Presence<T>[]
}

export enum REALTIME_PRESENCE_LISTEN_EVENTS {
  SYNC = 'sync',
  JOIN = 'join',
  LEAVE = 'leave',
}

export type RealtimePresenceOptions = {
  events?: { state: string; diff: string }
}

export default class RealtimePresence {
  get state() {
    return this.presenceAdapter.state
  }

  private presenceAdapter: PresenceAdapter

  /**
   * Creates a Presence helper that keeps the local presence state in sync with the server.
   *
   * @param channel - The realtime channel to bind to.
   * @param opts - Optional custom event names, e.g. `{ events: { state: 'state', diff: 'diff' } }`.
   *
   * @example
   * ```ts
   * const presence = new RealtimePresence(channel)
   *
   * channel.on('presence', ({ event, key }) => {
   *   console.log(`Presence ${event} on ${key}`)
   * })
   * ```
   */
  constructor(
    public channel: RealtimeChannel,
    opts?: RealtimePresenceOptions
  ) {
    this.presenceAdapter = new PresenceAdapter(this.channel.channelAdapter, opts)
  }
}
