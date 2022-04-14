/*
  This file draws heavily from https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/assets/test/presence_test.js
  License: https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/LICENSE.md
*/

import assert from 'assert'
import { RealtimePresence } from '../dist/main'

const cloneDeep = (obj) => {
  const cloned = JSON.parse(JSON.stringify(obj))
  Object.entries(obj).map(([key, val]) => {
    if(val === undefined){ cloned[key] = undefined }
  })
  return cloned
}

const fixtures = {
  joins() {
    return { u1: { metas: [{ id: 1, phx_ref: '1.2' }] } }
  },
  leaves() {
    return { u2: { metas: [{ id: 2, phx_ref: '2' }] } }
  },
  rawState() {
    return {
      u1: { metas: [{ id: 1, phx_ref: '1' }] },
      u2: { metas: [{ id: 2, phx_ref: '2' }] },
      u3: { metas: [{ id: 3, phx_ref: '3' }] },
    }
  },
  transformedState() {
    return {
      u1: [{ id: 1, presence_id: '1' }],
      u2: [{ id: 2, presence_id: '2' }],
      u3: [{ id: 3, presence_id: '3' }],
    }
  },
}

const channelStub = {
  ref: 1,
  events: {},

  on(event, _filter, callback) {
    this.events[event] = callback
  },

  trigger(event, data) {
    this.events[event](data)
  },

  joinRef() {
    return `${this.ref}`
  },

  simulateDisconnectAndReconnect() {
    this.ref++
  },
}

const listByFirst = (_id, [first, ..._rest]) => first

describe('syncState', function () {
  it('syncs empty state', function () {
    let state = {}
    const newState = { u1: [{ id: 1, presence_id: '1' }] }
    const stateBefore = cloneDeep(state)

    RealtimePresence.syncState(state, newState)

    assert.deepEqual(state, stateBefore)

    state = RealtimePresence.syncState(state, newState)

    assert.deepEqual(state, newState)
  })

  it("onJoins new presences and onLeave's left presences", function () {
    let state = { u4: [{ id: 4, presence_id: '4' }] }
    const rawState = fixtures.rawState()
    const joined = {}
    const left = {}
    const onJoin = (key, current, newPres) => {
      joined[key] = { current, newPres }
    }
    const onLeave = (key, current, leftPres) => {
      left[key] = { current, leftPres }
    }

    state = RealtimePresence.syncState(state, rawState, onJoin, onLeave)

    assert.deepEqual(state, fixtures.transformedState())
    assert.deepEqual(joined, {
      u1: { current: null, newPres: [{ id: 1, presence_id: '1' }] },
      u2: { current: null, newPres: [{ id: 2, presence_id: '2' }] },
      u3: { current: null, newPres: [{ id: 3, presence_id: '3' }] },
    })
    assert.deepEqual(left, {
      u4: {
        current: [],
        leftPres: [{ id: 4, presence_id: '4' }],
      },
    })
  })

  it('onJoins only newly added presences', function () {
    let state = { u3: [{ id: 3, presence_id: '3' }] }
    const rawState = {
      u3: {
        metas: [
          { id: 3, phx_ref: '3' },
          { id: 3, phx_ref: '3.new' },
        ],
      },
    }
    const joined = []
    const left = []
    const onJoin = (key, current, newPres) => {
      joined.push([key, cloneDeep({ current, newPres })])
    }
    const onLeave = (key, current, leftPres) => {
      left.push([key, cloneDeep({ current, leftPres })])
    }
    state = RealtimePresence.syncState(
      state,
      cloneDeep(rawState),
      onJoin,
      onLeave
    )

    assert.deepEqual(state, {
      u3: [
        { id: 3, presence_id: '3' },
        { id: 3, presence_id: '3.new' },
      ],
    })
    assert.deepEqual(joined, [
      [
        'u3',
        {
          current: [{ id: 3, presence_id: '3' }],
          newPres: [{ id: 3, presence_id: '3.new' }],
        },
      ],
    ])
    assert.deepEqual(left, [])
  })
})

describe('syncDiff', function () {
  it('syncs empty state', function () {
    const joins = { u1: [{ id: 1, phx_ref: '1' }] }
    const state = RealtimePresence.syncDiff(
      {},
      {
        joins,
        leaves: {},
      }
    )

    assert.deepEqual(state, joins)
  })

  it('removes presences when empty and adds additional presences', function () {
    let state = fixtures.transformedState()
    state = RealtimePresence.syncDiff(state, {
      joins: fixtures.joins(),
      leaves: fixtures.leaves(),
    })

    assert.deepEqual(state, {
      u1: [
        { id: 1, presence_id: '1' },
        { id: 1, presence_id: '1.2' },
      ],
      u3: [{ id: 3, presence_id: '3' }],
    })
  })

  it('removes presence while leaving key if other presences exist', function () {
    let state = {
      u1: [
        { id: 1, presence_id: '1' },
        { id: 1, presence_id: '1.2' },
      ],
    }
    state = RealtimePresence.syncDiff(state, {
      joins: {},
      leaves: { u1: { metas: [{ id: 1, phx_ref: '1' }] } },
    })

    assert.deepEqual(state, {
      u1: [{ id: 1, presence_id: '1.2' }],
    })
  })
})

describe('list', function () {
  it('lists full presence by default', function () {
    const state = fixtures.transformedState()

    assert.deepEqual(RealtimePresence.list(state), [
      [{ id: 1, presence_id: '1' }],
      [{ id: 2, presence_id: '2' }],
      [{ id: 3, presence_id: '3' }],
    ])
  })

  it('lists with custom function', function () {
    const state = {
      u1: [
        { id: 1, presence_id: '1.first' },
        { id: 1, presence_id: '1.second' },
      ],
    }

    const listBy = (_key, [first, ..._rest]) => {
      return first
    }

    assert.deepEqual(RealtimePresence.list(state, listBy), [
      { id: 1, presence_id: '1.first' },
    ])
  })
})

describe('instance', function () {
  it('syncs state and diffs', function () {
    const presence = new RealtimePresence(channelStub)
    const user1 = { metas: [{ id: 1, phx_ref: '1' }] }
    const user2 = { metas: [{ id: 2, phx_ref: '2' }] }
    const newState = { u1: user1, u2: user2 }

    channelStub.trigger('presence_state', newState)

    assert.deepEqual(presence.list(listByFirst), [
      { id: 1, presence_id: '1' },
      { id: 2, presence_id: '2' },
    ])

    channelStub.trigger('presence_diff', { joins: {}, leaves: { u1: user1 } })

    assert.deepEqual(presence.list(listByFirst), [{ id: 2, presence_id: '2' }])
  })

  it('applies pending diff if state is not yet synced', function () {
    const presence = new RealtimePresence(channelStub)
    const onJoins = []
    const onLeaves = []

    presence.onJoin((id, current, newPres) => {
      onJoins.push(cloneDeep({ id, current, newPres }))
    })
    presence.onLeave((id, current, leftPres) => {
      onLeaves.push(cloneDeep({ id, current, leftPres }))
    })

    // new connection
    const user1 = { metas: [{ id: 1, phx_ref: '1' }] }
    const user2 = { metas: [{ id: 2, phx_ref: '2' }] }
    const user3 = { metas: [{ id: 3, phx_ref: '3' }] }
    const newState = { u1: user1, u2: user2 }
    const leaves = { u2: user2 }

    channelStub.trigger('presence_diff', { joins: {}, leaves })

    assert.deepEqual(presence.list(listByFirst), [])
    assert.deepEqual(presence.pendingDiffs, [{ joins: {}, leaves }])

    channelStub.trigger('presence_state', newState)

    assert.deepEqual(onLeaves, [
      {
        id: 'u2',
        current: [],
        leftPres: [{ id: 2, presence_id: '2' }],
      },
    ])
    assert.deepEqual(presence.list(listByFirst), [{ id: 1, presence_id: '1' }])
    assert.deepEqual(presence.pendingDiffs, [])
    assert.deepEqual(onJoins, [
      {
        id: 'u1',
        current: undefined,
        newPres: [{ id: 1, presence_id: '1' }],
      },
      {
        id: 'u2',
        current: undefined,
        newPres: [{ id: 2, presence_id: '2' }],
      },
    ])

    // disconnect and reconnect
    assert.equal(presence.inPendingSyncState(), false)

    channelStub.simulateDisconnectAndReconnect()

    assert.equal(presence.inPendingSyncState(), true)

    channelStub.trigger('presence_diff', { joins: {}, leaves: { u1: user1 } })

    assert.deepEqual(presence.list(listByFirst), [{ id: 1, presence_id: '1' }])

    channelStub.trigger('presence_state', { u1: user1, u3: user3 })

    assert.deepEqual(presence.list(listByFirst), [{ id: 3, presence_id: '3' }])
  })

  it('allows custom channel events', function () {
    const presence = new RealtimePresence(channelStub, {
      events: {
        state: 'the_state',
        diff: 'the_diff',
      },
    })
    const user1 = { metas: [{ id: 1, phx_ref: '1' }] }

    channelStub.trigger('the_state', { user1 })

    assert.deepEqual(presence.list(listByFirst), [{ id: 1, presence_id: '1' }])

    channelStub.trigger('the_diff', { joins: {}, leaves: { user1 } })

    assert.deepEqual(presence.list(listByFirst), [])
  })

  it('updates existing presences for a presence update (leave + join)', function () {
    const presence = new RealtimePresence(channelStub)
    const onJoins = []
    const onLeaves = []

    // new connection
    const user1 = { metas: [{ id: 1, phx_ref: '1' }] }
    const user2 = { metas: [{ id: 2, name: 'bo', phx_ref: '2' }] }
    const newState = { u1: user1, u2: user2 }

    channelStub.trigger('presence_state', cloneDeep(newState))

    presence.onJoin((id, current, newPres) => {
      onJoins.push(cloneDeep({ id, current, newPres }))
    })
    presence.onLeave((id, current, leftPres) => {
      onLeaves.push(cloneDeep({ id, current, leftPres }))
    })

    assert.deepEqual(
      presence.list((_id, presences) => presences),
      [
        [
          {
            id: 1,
            presence_id: '1',
          },
        ],
        [
          {
            id: 2,
            name: 'bo',
            presence_id: '2',
          },
        ],
      ]
    )

    const leaves = { u2: user2 }
    const joins = {
      u2: {
        metas: [{ id: 2, name: 'bo.2', phx_ref: '2.2', phx_ref_prev: '2' }],
      },
    }

    channelStub.trigger('presence_diff', { joins, leaves })

    assert.deepEqual(
      presence.list((_id, presences) => presences),
      [
        [
          {
            id: 1,
            presence_id: '1',
          },
        ],
        [
          {
            id: 2,
            name: 'bo.2',
            presence_id: '2.2',
          },
        ],
      ]
    )
    assert.deepEqual(onJoins, [
      {
        current: [
          {
            id: 2,
            name: 'bo',
            presence_id: '2',
          },
        ],
        id: 'u2',
        newPres: [
          {
            id: 2,
            name: 'bo.2',
            presence_id: '2.2',
          },
        ],
      },
    ])
  })
})
