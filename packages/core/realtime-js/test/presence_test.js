/*
  This file draws heavily from https://github.com/phoenixframework/phoenix/blob/e8a12ce00ea91e3817e8187fbbd71c18c249238e/assets/test/presence_test.js
  License: https://github.com/phoenixframework/phoenix/blob/e8a12ce00ea91e3817e8187fbbd71c18c249238e/README.md
*/

import assert from "assert"
import { RealtimePresence } from '../dist/main'

const clone = (obj) => {
  const cloned = JSON.parse(JSON.stringify(obj))
  Object.entries(obj).map(([key, val]) => {
    if(val === undefined){ cloned[key] = undefined }
  })
  return cloned
}

const fixtures = {
  joins(){
    return {u1: [{id: 1, presence_ref: "1.2"}]}
  },
  leaves(){
    return {u2: [{id: 2, presence_ref: "2"}]}
  },
  state(){
    return {
      u1: [{id: 1, presence_ref: "1"}],
      u2: [{id: 2, presence_ref: "2"}],
      u3: [{id: 3, presence_ref: "3"}]
    }
  }
}

const channelStub = {
  ref: 1,
  bindings: {},

  _on(type, filter, callback){
    this.bindings[type] = { callback, filter, type }
  },

  _trigger(type, data){
    const bind = this.bindings[type]
    bind && bind.callback(data)
  },

  _joinRef(){ return `${this.ref}` },

  simulateDisconnectAndReconnect() {
    this.ref++
  }
}

const listByFirst = (id, [first, ..._rest]) => first

describe("syncState", function(){
  it("syncs empty state", function(){
    let state = {}
    const newState = {u1: [{id: 1, presence_ref: "1"}]}
    const stateBefore = clone(state)
    RealtimePresence.syncState(state, newState)
    assert.deepEqual(state, stateBefore)

    state = RealtimePresence.syncState(state, newState)
    assert.deepEqual(state, newState)
  })

  it("onJoins new presences and onLeave's left presences", function(){
    let state = {u4: [{id: 4, presence_ref: "4"}]}
    const newState = fixtures.state()
    const joined = {}
    const left = {}
    const onJoin = (key, current, newPres) => {
      joined[key] = {current: current, newPres: newPres}
    }
    const onLeave = (key, current, leftPres) => {
      left[key] = {current: current, leftPres: leftPres}
    }

    state = RealtimePresence.syncState(state, newState, onJoin, onLeave)
    assert.deepEqual(state, newState)
    assert.deepEqual(joined, {
      u1: {current: [], newPres: [{id: 1, presence_ref: "1"}]},
      u2: {current: [], newPres: [{id: 2, presence_ref: "2"}]},
      u3: {current: [], newPres: [{id: 3, presence_ref: "3"}]}
    })
    assert.deepEqual(left, {
      u4: {current: [], leftPres: [{id: 4, presence_ref: "4"}]}
    })
  })

  it("onJoins only newly added presences", function(){
    let state = {u3: [{id: 3, presence_ref: "3"}]}
    const newState = {u3: [{id: 3, presence_ref: "3"}, {id: 3, presence_ref: "3.new"}]}
    const joined = []
    const left = []
    const onJoin = (key, current, newPres) => {
      joined.push([key, clone({current: current, newPres: newPres})])
    }
    const onLeave = (key, current, leftPres) => {
      left.push([key, clone({current: current, leftPres: leftPres})])
    }
    state = RealtimePresence.syncState(state, clone(newState), onJoin, onLeave)
    assert.deepEqual(state, newState)
    assert.deepEqual(joined, [
      ["u3", {current: [{id: 3, presence_ref: "3"}],
        newPres: [{id: 3, presence_ref: "3.new"}]}]
    ])
    assert.deepEqual(left, [])
  })
})

describe("syncDiff", function(){
  it("syncs empty state", function(){
    const joins = {u1: [{id: 1, presence_ref: "1"}]}
    const state = RealtimePresence.syncDiff({}, {
      joins: joins,
      leaves: {}
    })
    assert.deepEqual(state, joins)
  })

  it("removes presence when presences is empty and adds additional presence", function(){
    let state = fixtures.state()
    state = RealtimePresence.syncDiff(state, {joins: fixtures.joins(), leaves: fixtures.leaves()})

    assert.deepEqual(state, {
      u1: [{id: 1, presence_ref: "1"}, {id: 1, presence_ref: "1.2"}],
      u3: [{id: 3, presence_ref: "3"}]
    })
  })

  it("removes presence while leaving key if other presences exist", function(){
    let state = {
      u1: [{id: 1, presence_ref: "1"}, {id: 1, presence_ref: "1.2"}]
    }
    state = RealtimePresence.syncDiff(state, {joins: {}, leaves: {u1: [{id: 1, presence_ref: "1"}]}})

    assert.deepEqual(state, {
      u1: [{id: 1, presence_ref: "1.2"}],
    })
  })
})

describe("instance", function(){
  it("syncs state and diffs", function(){
    const presence = new RealtimePresence(channelStub)
    const user1 = [{id: 1, presence_ref: "1"}]
    const user2 = [{id: 2, presence_ref: "2"}]
    const newState = {u1: user1, u2: user2}

    channelStub._trigger("presence_state", newState)
    assert.deepEqual(RealtimePresence.map(presence.state, listByFirst), [{id: 1, presence_ref: "1"},
      {id: 2, presence_ref: "2"}])

    channelStub._trigger("presence_diff", {joins: {}, leaves: {u1: user1}})
    assert.deepEqual(RealtimePresence.map(presence.state, listByFirst), [{id: 2, presence_ref: "2"}])
  })

  it("applies pending diff if state is not yet synced", function(){
    const presence = new RealtimePresence(channelStub)
    const onJoins = []
    const onLeaves = []

    presence.onJoin((id, current, newPres) => {
      onJoins.push(clone({id, current, newPres}))
    })
    presence.onLeave((id, current, leftPres) => {
      onLeaves.push(clone({id, current, leftPres}))
    })

    // new connection
    const user1 = [{id: 1, presence_ref: "1"}]
    const user2 = [{id: 2, presence_ref: "2"}]
    const user3 = [{id: 3, presence_ref: "3"}]
    const newState = {u1: user1, u2: user2}
    const leaves = {u2: user2}

    channelStub._trigger("presence_diff", {joins: {}, leaves: leaves})

    assert.deepEqual(RealtimePresence.map(presence.state, listByFirst), [])
    assert.deepEqual(presence.pendingDiffs, [{joins: {}, leaves: leaves}])

    channelStub._trigger("presence_state", newState)
    assert.deepEqual(onLeaves, [
      {id: "u2", current: [], leftPres: [{id: 2, presence_ref: "2"}]}
    ])

    assert.deepEqual(RealtimePresence.map(presence.state, listByFirst), [{id: 1, presence_ref: "1"}])
    assert.deepEqual(presence.pendingDiffs, [])
    assert.deepEqual(onJoins, [
      {id: "u1", current: [], newPres: [{id: 1, presence_ref: "1"}]},
      {id: "u2", current: [], newPres: [{id: 2, presence_ref: "2"}]}
    ])

    // disconnect and reconnect
    assert.equal(presence.inPendingSyncState(), false)
    channelStub.simulateDisconnectAndReconnect()
    assert.equal(presence.inPendingSyncState(), true)

    channelStub._trigger("presence_diff", {joins: {}, leaves: {u1: user1}})
    assert.deepEqual(RealtimePresence.map(presence.state, listByFirst), [{id: 1, presence_ref: "1"}])

    channelStub._trigger("presence_state", {u1: user1, u3: user3})
    assert.deepEqual(RealtimePresence.map(presence.state, listByFirst), [{id: 3, presence_ref: "3"}])
  })

  it("allows custom channel events", function(){
    const presence = new RealtimePresence(channelStub, {events: {
      state: "the_state",
      diff: "the_diff"
    }})

    const user1 = [{id: 1, presence_ref: "1"}]
    channelStub._trigger("the_state", {user1: user1})
    assert.deepEqual(RealtimePresence.map(presence.state, listByFirst), [{id: 1, presence_ref: "1"}])
    channelStub._trigger("the_diff", {joins: {}, leaves: {user1: user1}})
    assert.deepEqual(RealtimePresence.map(presence.state, listByFirst), [])
  })

  it("updates existing presences for a presence update (leave + join)", function(){
    const presence = new RealtimePresence(channelStub)
    const onJoins = []
    const onLeaves = []

    // new connection
    const user1 = [{id: 1, presence_ref: "1"}]
    const user2 = [{id: 2, name: "bo", presence_ref: "2"}]
    const newState = {u1: user1, u2: user2}

    channelStub._trigger("presence_state", clone(newState))

    presence.onJoin((id, current, newPres) => {
      onJoins.push(clone({id, current, newPres}))
    })
    presence.onLeave((id, current, leftPres) => {
      onLeaves.push(clone({id, current, leftPres}))
    })

    assert.deepEqual(RealtimePresence.map(presence.state, (_id, presences) => presences),
      [
        [
          {
            "id": 1,
            "presence_ref": "1"
          }
        ],
        [
          {
            "id": 2,
            "name": "bo",
            "presence_ref": "2"
          }
        ]
      ]
    )

    const leaves = {u2: user2}
    const joins = {u2: [{id: 2, name: "bo.2", presence_ref: "2.2"}]}
    channelStub._trigger("presence_diff", {joins: joins, leaves: leaves})

    assert.deepEqual(RealtimePresence.map(presence.state, (_id, presences) => presences),
      [
        [
          {
            id: 1,
            presence_ref: '1'
          }
        ],
        [
          {
            id: 2,
            name: 'bo.2',
            presence_ref: '2.2'
          }
        ]
      ]
    )

    assert.deepEqual(onJoins,
      [
        {
          "current":
            [
              {
                "id": 2,
                "name": "bo",
                "presence_ref": "2"
              }
            ],
          "id": "u2",
          "newPres": [
              {
                "id": 2,
                "name": "bo.2",
                "presence_ref": "2.2"
              }
            ]
        }
      ]
    )
  })
})
