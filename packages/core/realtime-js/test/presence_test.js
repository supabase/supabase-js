/*
  This file draws heavily from https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/assets/test/presence_test.js
  License: https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/LICENSE.md
*/

import assert from 'assert'
import cloneDeep from 'lodash.clonedeep'
import { RealtimePresence } from '../dist/main'

const fixtures = {
  joins() {
    return { u1: { metas: [{ id: 1, phx_ref: '1.2' }] } }
  },
  leaves() {
    return { u2: { metas: [{ id: 2, phx_ref: '2' }] } }
  },
  state() {
    return {
      u1: { metas: [{ id: 1, phx_ref: '1' }] },
      u2: { metas: [{ id: 2, phx_ref: '2' }] },
      u3: { metas: [{ id: 3, phx_ref: '3' }] },
    }
  },
}

const channelStub = {
  ref: 1,
  events: {},

  on(event, callback) {
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

const listByFirst = (_id, { metas: [first, ..._rest] }) => first

describe('syncState', function () {
  it('syncs empty state', function () {
    let state = {}
    const newState = { u1: { metas: [{ id: 1, phx_ref: '1' }] } }
    const stateBefore = cloneDeep(state)

    RealtimePresence.syncState(state, newState)

    assert.deepEqual(state, stateBefore)

    state = RealtimePresence.syncState(state, newState)

    assert.deepEqual(state, newState)
  })

  it("onJoins new presences and onLeave's left presences", function () {
    let state = { u4: { metas: [{ id: 4, phx_ref: '4' }] } }
    const newState = fixtures.state()
    const joined = {}
    const left = {}
    const onJoin = (key, current, newPres) => {
      joined[key] = { current, newPres }
    }
    const onLeave = (key, current, leftPres) => {
      left[key] = { current, leftPres }
    }

    state = RealtimePresence.syncState(state, newState, onJoin, onLeave)

    assert.deepEqual(state, newState)
    assert.deepEqual(joined, {
      u1: { current: null, newPres: { metas: [{ id: 1, phx_ref: '1' }] } },
      u2: { current: null, newPres: { metas: [{ id: 2, phx_ref: '2' }] } },
      u3: { current: null, newPres: { metas: [{ id: 3, phx_ref: '3' }] } },
    })
    assert.deepEqual(left, {
      u4: {
        current: { metas: [] },
        leftPres: { metas: [{ id: 4, phx_ref: '4' }] },
      },
    })
  })

  it('onJoins only newly added metas', function () {
    let state = { u3: { metas: [{ id: 3, phx_ref: '3' }] } }
    const newState = {
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
    state = RealtimePresence.syncState(state, cloneDeep(newState), onJoin, onLeave)

    assert.deepEqual(state, newState)
    assert.deepEqual(joined, [
      [
        'u3',
        {
          current: { metas: [{ id: 3, phx_ref: '3' }] },
          newPres: { metas: [{ id: 3, phx_ref: '3.new' }] },
        },
      ],
    ])
    assert.deepEqual(left, [])
  })
})

describe('syncDiff', function () {
  it('syncs empty state', function () {
    const joins = { u1: { metas: [{ id: 1, phx_ref: '1' }] } }
    const state = RealtimePresence.syncDiff(
      {},
      {
        joins,
        leaves: {},
      }
    )

    assert.deepEqual(state, joins)
  })

  it('removes presence when meta is empty and adds additional meta', function () {
    let state = fixtures.state()
    state = RealtimePresence.syncDiff(state, {
      joins: fixtures.joins(),
      leaves: fixtures.leaves(),
    })

    assert.deepEqual(state, {
      u1: {
        metas: [
          { id: 1, phx_ref: '1' },
          { id: 1, phx_ref: '1.2' },
        ],
      },
      u3: { metas: [{ id: 3, phx_ref: '3' }] },
    })
  })

  it('removes meta while leaving key if other metas exist', function () {
    let state = {
      u1: {
        metas: [
          { id: 1, phx_ref: '1' },
          { id: 1, phx_ref: '1.2' },
        ],
      },
    }
    state = RealtimePresence.syncDiff(state, {
      joins: {},
      leaves: { u1: { metas: [{ id: 1, phx_ref: '1' }] } },
    })

    assert.deepEqual(state, {
      u1: { metas: [{ id: 1, phx_ref: '1.2' }] },
    })
  })
})

describe('list', function () {
  it('lists full presence by default', function () {
    const state = fixtures.state()

    assert.deepEqual(RealtimePresence.list(state), [
      { metas: [{ id: 1, phx_ref: '1' }] },
      { metas: [{ id: 2, phx_ref: '2' }] },
      { metas: [{ id: 3, phx_ref: '3' }] },
    ])
  })

  it('lists with custom function', function () {
    const state = {
      u1: {
        metas: [
          { id: 1, phx_ref: '1.first' },
          { id: 1, phx_ref: '1.second' },
        ],
      },
    }

    const listBy = (_key, { metas: [first, ..._rest] }) => {
      return first
    }

    assert.deepEqual(RealtimePresence.list(state, listBy), [
      { id: 1, phx_ref: '1.first' },
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
      { id: 1, phx_ref: 1 },
      { id: 2, phx_ref: 2 },
    ])

    channelStub.trigger('presence_diff', { joins: {}, leaves: { u1: user1 } })

    assert.deepEqual(presence.list(listByFirst), [{ id: 2, phx_ref: 2 }])
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
        current: { metas: [] },
        leftPres: { metas: [{ id: 2, phx_ref: '2' }] },
      },
    ])
    assert.deepEqual(presence.list(listByFirst), [{ id: 1, phx_ref: '1' }])
    assert.deepEqual(presence.pendingDiffs, [])
    assert.deepEqual(onJoins, [
      {
        id: 'u1',
        current: undefined,
        newPres: { metas: [{ id: 1, phx_ref: '1' }] },
      },
      {
        id: 'u2',
        current: undefined,
        newPres: { metas: [{ id: 2, phx_ref: '2' }] },
      },
    ])

    // disconnect and reconnect
    assert.equal(presence.inPendingSyncState(), false)
    
    channelStub.simulateDisconnectAndReconnect()
    
    assert.equal(presence.inPendingSyncState(), true)

    channelStub.trigger('presence_diff', { joins: {}, leaves: { u1: user1 } })
    
    assert.deepEqual(presence.list(listByFirst), [{ id: 1, phx_ref: '1' }])

    channelStub.trigger('presence_state', { u1: user1, u3: user3 })
    
    assert.deepEqual(presence.list(listByFirst), [{ id: 3, phx_ref: '3' }])
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

    assert.deepEqual(presence.list(listByFirst), [{ id: 1, phx_ref: '1' }])

    channelStub.trigger('the_diff', { joins: {}, leaves: { user1 } })

    assert.deepEqual(presence.list(listByFirst), [])
  })

  it('updates existing meta for a presence update (leave + join)', function () {
    const presence = new RealtimePresence(channelStub)
    const onJoins = []
    const onLeaves = []

    // new connection
    const user1 = { metas: [{ id: 1, phx_ref: '1' }] }
    const user2 = { metas: [{ id: 2, name: 'chris', phx_ref: '2' }] }
    const newState = { u1: user1, u2: user2 }

    channelStub.trigger('presence_state', cloneDeep(newState))

    presence.onJoin((id, current, newPres) => {
      onJoins.push(cloneDeep({ id, current, newPres }))
    })
    presence.onLeave((id, current, leftPres) => {
      onLeaves.push(cloneDeep({ id, current, leftPres }))
    })

    assert.deepEqual(
      presence.list((_id, { metas: metas }) => metas),
      [
        [
          {
            id: 1,
            phx_ref: '1',
          },
        ],
        [
          {
            id: 2,
            name: 'chris',
            phx_ref: '2',
          },
        ],
      ]
    )

    const leaves = { u2: user2 }
    const joins = {
      u2: {
        metas: [{ id: 2, name: 'chris.2', phx_ref: '2.2', phx_ref_prev: '2' }],
      },
    }

    channelStub.trigger('presence_diff', { joins, leaves })

    assert.deepEqual(
      presence.list((_id, { metas: metas }) => metas),
      [
        [
          {
            id: 1,
            phx_ref: '1',
          },
        ],
        [
          {
            id: 2,
            name: 'chris.2',
            phx_ref: '2.2',
            phx_ref_prev: '2',
          },
        ],
      ]
    )
    assert.deepEqual(onJoins, [
      {
        current: {
          metas: [
            {
              id: 2,
              name: 'chris',
              phx_ref: '2',
            },
          ],
        },
        id: 'u2',
        newPres: {
          metas: [
            {
              id: 2,
              name: 'chris.2',
              phx_ref: '2.2',
              phx_ref_prev: '2',
            },
          ],
        },
      },
    ])
  })
})
