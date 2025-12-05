import { Presence } from 'phoenix'
import type { OnJoin, OnLeave, OnSync, State } from 'phoenix'
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
  }

  get state(): RealtimePresenceState {
    return transformState(this.presence.state)
  }

  onJoin(callback: OnJoin): void {
    this.presence.onJoin(callback)
  }

  onLeave(callback: OnLeave): void {
    this.presence.onLeave(callback)
  }

  onSync(callback: OnSync): void {
    this.presence.onSync(callback)
  }
}

/**
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
function transformState(state: State): RealtimePresenceState {
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

function cloneState(state: State): State {
  return JSON.parse(JSON.stringify(state))
}

function phoenixPresenceOptions(opts?: RealtimePresenceOptions) {
  if (!opts?.events) return undefined
  return { events: opts.events }
}
