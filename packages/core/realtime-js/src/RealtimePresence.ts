/*
  This file draws heavily from https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/assets/js/phoenix/presence.js
  License: https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/LICENSE.md
*/

import {
  PresenceOpts,
  PresenceOnJoinCallback,
  PresenceOnLeaveCallback,
} from 'phoenix'
import RealtimeChannel from './RealtimeChannel'

type Presence = {
  presence_id: string
  [key: string]: any
}

type PresenceState = { [key: string]: Presence[] }

type PresenceDiff = {
  joins: PresenceState
  leaves: PresenceState
}

type RawPresenceState = {
  [key: string]: Record<
    'metas',
    {
      phx_ref?: string
      phx_ref_prev?: string
      [key: string]: any
    }[]
  >
}

type RawPresenceDiff = {
  joins: RawPresenceState
  leaves: RawPresenceState
}

type PresenceChooser<T> = (key: string, presences: any) => T

export default class RealtimePresence {
  state: PresenceState = {}
  pendingDiffs: RawPresenceDiff[] = []
  joinRef: string | null = null
  caller: {
    onJoin: PresenceOnJoinCallback
    onLeave: PresenceOnLeaveCallback
    onSync: () => void
  } = {
    onJoin: () => {},
    onLeave: () => {},
    onSync: () => {},
  }

  /**
   * Initializes the Presence.
   *
   * @param channel - The RealtimeSubscription
   * @param opts - The options,
   *        for example `{events: {state: 'state', diff: 'diff'}}`
   */
  constructor(public channel: RealtimeChannel, opts?: PresenceOpts) {
    const events = opts?.events || {
      state: 'presence_state',
      diff: 'presence_diff',
    }

    this.channel.on(events.state, {}, (newState: RawPresenceState) => {
      const { onJoin, onLeave, onSync } = this.caller

      this.joinRef = this.channel.joinRef()

      this.state = RealtimePresence.syncState(
        this.state,
        newState,
        onJoin,
        onLeave
      )

      this.pendingDiffs.forEach((diff) => {
        this.state = RealtimePresence.syncDiff(
          this.state,
          diff,
          onJoin,
          onLeave
        )
      })

      this.pendingDiffs = []

      onSync()
    })

    this.channel.on(events.diff, {}, (diff: RawPresenceDiff) => {
      const { onJoin, onLeave, onSync } = this.caller

      if (this.inPendingSyncState()) {
        this.pendingDiffs.push(diff)
      } else {
        this.state = RealtimePresence.syncDiff(
          this.state,
          diff,
          onJoin,
          onLeave
        )

        onSync()
      }
    })
  }

  /**
   * Used to sync the list of presences on the server with the
   * client's state.
   *
   * An optional `onJoin` and `onLeave` callback can be provided to
   * react to changes in the client's local presences across
   * disconnects and reconnects with the server.
   */
  static syncState(
    currentState: PresenceState,
    newState: RawPresenceState | PresenceState,
    onJoin: PresenceOnJoinCallback,
    onLeave: PresenceOnLeaveCallback
  ): PresenceState {
    const state = this.cloneDeep(currentState)
    const transformedState = this.transformState(newState)
    const joins: PresenceState = {}
    const leaves: PresenceState = {}

    this.map(state, (key: string, presences: Presence[]) => {
      if (!transformedState[key]) {
        leaves[key] = presences
      }
    })

    this.map(transformedState, (key, newPresences: Presence[]) => {
      const currentPresences: Presence[] = state[key]

      if (currentPresences) {
        const newPresenceIds = newPresences.map((m: Presence) => m.presence_id)
        const curPresenceIds = currentPresences.map(
          (m: Presence) => m.presence_id
        )
        const joinedPresences: Presence[] = newPresences.filter(
          (m: Presence) => curPresenceIds.indexOf(m.presence_id) < 0
        )
        const leftPresences: Presence[] = currentPresences.filter(
          (m: Presence) => newPresenceIds.indexOf(m.presence_id) < 0
        )

        if (joinedPresences.length > 0) {
          joins[key] = joinedPresences
        }

        if (leftPresences.length > 0) {
          leaves[key] = leftPresences
        }
      } else {
        joins[key] = newPresences
      }
    })

    return this.syncDiff(state, { joins, leaves }, onJoin, onLeave)
  }

  /**
   * Used to sync a diff of presence join and leave events from the
   * server, as they happen.
   *
   * Like `syncState`, `syncDiff` accepts optional `onJoin` and
   * `onLeave` callbacks to react to a user joining or leaving from a
   * device.
   */
  static syncDiff(
    state: PresenceState,
    diff: RawPresenceDiff | PresenceDiff,
    onJoin: PresenceOnJoinCallback,
    onLeave: PresenceOnLeaveCallback
  ): PresenceState {
    const { joins, leaves } = {
      joins: this.transformState(diff.joins),
      leaves: this.transformState(diff.leaves),
    }

    if (!onJoin) {
      onJoin = () => {}
    }

    if (!onLeave) {
      onLeave = () => {}
    }

    this.map(joins, (key, newPresences: Presence[]) => {
      const currentPresences: Presence[] = state[key]
      state[key] = this.cloneDeep(newPresences)

      if (currentPresences) {
        const joinedPresenceIds = state[key].map((m: Presence) => m.presence_id)
        const curPresences: Presence[] = currentPresences.filter(
          (m: Presence) => joinedPresenceIds.indexOf(m.presence_id) < 0
        )

        state[key].unshift(...curPresences)
      }

      onJoin(key, currentPresences, newPresences)
    })

    this.map(leaves, (key, leftPresences: Presence[]) => {
      let currentPresences: Presence[] = state[key]

      if (!currentPresences) return

      const presenceIdsToRemove = leftPresences.map(
        (m: Presence) => m.presence_id
      )
      currentPresences = currentPresences.filter(
        (m: Presence) => presenceIdsToRemove.indexOf(m.presence_id) < 0
      )

      state[key] = currentPresences

      onLeave(key, currentPresences, leftPresences)

      if (currentPresences.length === 0) delete state[key]
    })

    return state
  }

  /**
   * Returns the array of presences, with selected metadata.
   */
  static list<T = any>(
    presences: PresenceState,
    chooser: PresenceChooser<T> | undefined
  ): T[] {
    if (!chooser) {
      chooser = (_key, pres) => pres
    }

    return this.map(presences, (key, presences: Presence[]) =>
      chooser!(key, presences)
    )
  }

  private static map<T = any>(
    obj: PresenceState,
    func: PresenceChooser<T>
  ): T[] {
    return Object.getOwnPropertyNames(obj).map((key) => func(key, obj[key]))
  }

  /**
   * Remove 'metas' key
   * Change 'phx_ref' to 'presence_id'
   * Remove 'phx_ref' and 'phx_ref_prev'
   *
   * @example
   * // returns {
   *  abc123: [
   *    { presence_id: '2', user_id: 1 },
   *    { presence_id: '3', user_id: 2 }
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
   */
  private static transformState(
    state: RawPresenceState | PresenceState
  ): PresenceState {
    state = this.cloneDeep(state)

    return Object.getOwnPropertyNames(state).reduce((newState, key) => {
      const presences = state[key]

      if ('metas' in presences) {
        newState[key] = presences.metas.map((presence) => {
          presence['presence_id'] = presence['phx_ref']

          delete presence['phx_ref']
          delete presence['phx_ref_prev']

          return presence
        }) as Presence[]
      } else {
        newState[key] = presences
      }

      return newState
    }, {} as PresenceState)
  }

  private static cloneDeep(obj: object) {
    return JSON.parse(JSON.stringify(obj))
  }

  onJoin(callback: PresenceOnJoinCallback): void {
    this.caller.onJoin = callback
  }

  onLeave(callback: PresenceOnLeaveCallback): void {
    this.caller.onLeave = callback
  }

  onSync(callback: () => void): void {
    this.caller.onSync = callback
  }

  list<T = any>(by?: PresenceChooser<T>): T[] {
    return RealtimePresence.list<T>(this.state, by)
  }

  private inPendingSyncState(): boolean {
    return !this.joinRef || this.joinRef !== this.channel.joinRef()
  }
}
