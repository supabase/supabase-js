import { Presence } from '@supabase/phoenix'
import type { PresenceState, PresenceStates } from './types'
import type {
  RealtimePresenceOptions,
  RealtimePresenceState,
  Presence as RealtimePresenceType,
} from '../RealtimePresence'
import ChannelAdapter from './channelAdapter'

export default class PresenceAdapter {
  private presence: Presence

  constructor(channel: ChannelAdapter, opts?: RealtimePresenceOptions) {
    const phoenixOptions = phoenixPresenceOptions(opts)
    this.presence = new Presence(channel.getChannel(), phoenixOptions)

    this.presence.onJoin((key, currentPresence, newPresence) => {
      const onJoinPayload = PresenceAdapter.onJoinPayload(key, currentPresence, newPresence)
      channel.getChannel().trigger('presence', onJoinPayload)
    })

    this.presence.onLeave((key, currentPresence, leftPresence) => {
      const onLeavePayload = PresenceAdapter.onLeavePayload(key, currentPresence, leftPresence)
      channel.getChannel().trigger('presence', onLeavePayload)
    })

    this.presence.onSync(() => {
      channel.getChannel().trigger('presence', { event: 'sync' })
    })
  }

  get state() {
    return PresenceAdapter.transformState(this.presence.state)
  }

  /**
   * @private
   * Remove 'metas' key
   * Change 'phx_ref' to 'presence_ref'
   * Remove 'phx_ref' and 'phx_ref_prev'
   *
   * @example
   * // returns {
   *  abc123: [
   *    { presence_ref: '2', user_id: 1 },
   *    { presence_ref: '3', user_id: 2 }
   *  ]
   * }
   * RealtimePresence.transformState({
   *  abc123: {
   *    metas: [
   *      { phx_ref: '2', phx_ref_prev: '1' user_id: 1 },
   *      { phx_ref: '3', user_id: 2 }
   *    ]
   *  }
   * })
   *
   */
  static transformState(state: PresenceStates): RealtimePresenceState {
    state = cloneState(state)

    return Object.getOwnPropertyNames(state).reduce((newState, key) => {
      const presences = state[key]

      newState[key] = presences.metas.map((presence) => {
        presence['presence_ref'] = presence['phx_ref']

        delete presence['phx_ref']
        delete presence['phx_ref_prev']

        return presence
      }) as RealtimePresenceType[]

      return newState
    }, {} as RealtimePresenceState)
  }

  static onJoinPayload(key: string, currentPresence: PresenceState, newPresence: PresenceState) {
    const currentPresences = parseCurrentPresences(currentPresence)
    const newPresences = newPresence['metas']

    return {
      event: 'join',
      key,
      currentPresences,
      newPresences,
    }
  }

  static onLeavePayload(key: string, currentPresence: PresenceState, leftPresence: PresenceState) {
    const currentPresences = parseCurrentPresences(currentPresence)
    const leftPresences = leftPresence['metas']

    return {
      event: 'leave',
      key,
      currentPresences,
      leftPresences,
    }
  }
}

function cloneState(state: PresenceStates): PresenceStates {
  return JSON.parse(JSON.stringify(state))
}

function phoenixPresenceOptions(opts?: RealtimePresenceOptions) {
  return opts?.events && { events: opts.events }
}

function parseCurrentPresences(currentPresences?: PresenceState) {
  return currentPresences?.metas || []
}
