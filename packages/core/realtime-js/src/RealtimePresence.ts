/*
  This file draws heavily from https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/assets/js/phoenix/presence.js
  License: https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/LICENSE.md
*/

import cloneDeep from 'lodash.clonedeep'
import {
  PresenceOpts,
  PresenceOnJoinCallback,
  PresenceOnLeaveCallback,
} from 'phoenix'
import RealtimeSubscription from './RealtimeSubscription'

type PresenceMeta = {
  phx_ref: string
  phx_ref_prev?: string
  [key: string]: any
}

type PresenceMetaMap = Record<'metas', PresenceMeta[]>

type PresenceState = { [key: string]: PresenceMetaMap }

type PresenceDiff = {
  joins: PresenceState
  leaves: PresenceState
}

type PresenceChooser<T> = (key: string, presence: any) => T

export default class RealtimePresence {
  state: PresenceState = {}
  pendingDiffs: PresenceDiff[] = []
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
   * Initializes the Presence
   * @param channel - The RealtimeSubscription
   * @param opts - The options,
   *        for example `{events: {state: "state", diff: "diff"}}`
   */
  constructor(public channel: RealtimeSubscription, opts?: PresenceOpts) {
    const events = opts?.events || {
      state: 'presence_state',
      diff: 'presence_diff',
    }

    this.channel.on(events.state, (newState: PresenceState) => {
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

    this.channel.on(events.diff, (diff: PresenceDiff) => {
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
   * Used to sync the list of presences on the server
   * with the client's state. An optional `onJoin` and `onLeave` callback can
   * be provided to react to changes in the client's local presences across
   * disconnects and reconnects with the server.
   */
  static syncState(
    currentState: PresenceState,
    newState: PresenceState,
    onJoin: PresenceOnJoinCallback,
    onLeave: PresenceOnLeaveCallback
  ): PresenceState {
    const state = cloneDeep(currentState)
    const joins: PresenceState = {}
    const leaves: PresenceState = {}

    this.map(state, (key, presence: PresenceMetaMap) => {
      if (!newState[key]) {
        leaves[key] = presence
      }
    })

    this.map(newState, (key, newPresence: PresenceMetaMap) => {
      const currentPresence: PresenceMetaMap = state[key]

      if (currentPresence) {
        const newRefs = newPresence.metas.map((m: PresenceMeta) => m.phx_ref)
        const curRefs = currentPresence.metas.map(
          (m: PresenceMeta) => m.phx_ref
        )
        const joinedMetas: PresenceMeta[] = newPresence.metas.filter(
          (m: PresenceMeta) => curRefs.indexOf(m.phx_ref) < 0
        )
        const leftMetas: PresenceMeta[] = currentPresence.metas.filter(
          (m: PresenceMeta) => newRefs.indexOf(m.phx_ref) < 0
        )

        if (joinedMetas.length > 0) {
          joins[key] = newPresence
          joins[key].metas = joinedMetas
        }

        if (leftMetas.length > 0) {
          leaves[key] = cloneDeep(currentPresence)
          leaves[key].metas = leftMetas
        }
      } else {
        joins[key] = newPresence
      }
    })

    return this.syncDiff(state, { joins, leaves }, onJoin, onLeave)
  }

  /**
   *
   * Used to sync a diff of presence join and leave
   * events from the server, as they happen. Like `syncState`, `syncDiff`
   * accepts optional `onJoin` and `onLeave` callbacks to react to a user
   * joining or leaving from a device.
   */
  static syncDiff(
    state: PresenceState,
    diff: PresenceDiff,
    onJoin: PresenceOnJoinCallback,
    onLeave: PresenceOnLeaveCallback
  ): PresenceState {
    const { joins, leaves } = cloneDeep(diff)

    if (!onJoin) {
      onJoin = () => {}
    }

    if (!onLeave) {
      onLeave = () => {}
    }

    this.map(joins, (key, newPresence: PresenceMetaMap) => {
      const currentPresence: PresenceMetaMap = state[key]
      state[key] = cloneDeep(newPresence)

      if (currentPresence) {
        const joinedRefs = state[key].metas.map((m: PresenceMeta) => m.phx_ref)
        const curMetas: PresenceMeta[] = currentPresence.metas.filter(
          (m: PresenceMeta) => joinedRefs.indexOf(m.phx_ref) < 0
        )

        state[key].metas.unshift(...curMetas)
      }

      onJoin(key, currentPresence, newPresence)
    })

    this.map(leaves, (key, leftPresence: PresenceMetaMap) => {
      const currentPresence: PresenceMetaMap = state[key]

      if (!currentPresence) return

      const refsToRemove = leftPresence.metas.map(
        (m: PresenceMeta) => m.phx_ref
      )
      currentPresence.metas = currentPresence.metas.filter(
        (m: PresenceMeta) => refsToRemove.indexOf(m.phx_ref) < 0
      )

      onLeave(key, currentPresence, leftPresence)

      if (currentPresence.metas.length === 0) delete state[key]
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

    return this.map(presences, (key, presence: PresenceMetaMap) =>
      chooser!(key, presence)
    )
  }

  private static map<T = any>(
    obj: PresenceState,
    func: PresenceChooser<T>
  ): T[] {
    return Object.getOwnPropertyNames(obj).map((key) => func(key, obj[key]))
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
