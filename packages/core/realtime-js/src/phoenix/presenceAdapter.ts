import { Presence } from 'phoenix'
import type { PresenceState, PresenceStates } from './types'
import type {
  RealtimePresenceOptions,
  RealtimePresenceState,
  Presence as RealtimePresenceType,
} from '../RealtimePresence'
import ChannelAdapter from './channelAdapter'

export default class PresenceAdapter {
  get state() {
    return PresenceAdapter.transformState(this.presence.state)
  }

  private presence: Presence

  constructor(channel: ChannelAdapter, opts?: RealtimePresenceOptions) {
    const phoenixOptions = phoenixPresenceOptions(opts)
    this.presence = new Presence(channel.getChannel(), phoenixOptions)

    this.presence.onJoin((key, currentPresence, newPresence) => {
      const currentPresences = parseCurrentPresences(currentPresence)
      const newPresences = newPresence['metas']
      channel.getChannel().trigger('presence', {
        event: 'join',
        key,
        currentPresences,
        newPresences,
      })
    })

    this.presence.onLeave((key, currentPresence, leftPresence) => {
      const currentPresences = parseCurrentPresences(currentPresence)
      const leftPresences = leftPresence['metas']
      channel.getChannel().trigger('presence', {
        event: 'leave',
        key,
        currentPresences,
        leftPresences,
      })
    })

    this.presence.onSync(() => {
      channel.getChannel().trigger('presence', { event: 'sync' })
    })
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
