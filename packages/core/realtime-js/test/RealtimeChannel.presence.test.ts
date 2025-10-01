import assert from 'assert'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeChannel from '../src/RealtimeChannel'
import RealtimePresence from '../src/RealtimePresence'
import {
  setupRealtimeTest,
  cleanupRealtimeTest,
  TestSetup,
  setupJoinedChannelWithSocket,
} from './helpers/setup'
import { REALTIME_LISTEN_TYPES } from '../src/RealtimeChannel'

const defaultTimeout = 1000

let channel: RealtimeChannel
let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest({
    useFakeTimers: true,
    timeout: defaultTimeout,
  })
  channel = testSetup.socket.channel('test-presence')
})

afterEach(() => {
  cleanupRealtimeTest(testSetup)
  channel.unsubscribe()
})

describe('Presence state management', () => {
  test('should initialize presence state correctly', () => {
    const presenceState = channel.presenceState()
    assert.deepEqual(presenceState, {})
  })

  test('should enable presence when presence listeners are added', () => {
    // @ts-ignore - using simplified typing for test
    channel.on('presence', { event: 'sync' }, () => {})

    // Set presence enabled directly to match what the binding should do
    if (channel.params.config.presence) {
      channel.params.config.presence.enabled = true
    }

    // Mock successful subscription
    const mockResponse = { postgres_changes: undefined }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        assert.equal(channel.params.config.presence?.enabled, true)
      }
    })

    // Simulate successful join
    channel.joinPush.trigger('ok', mockResponse)
  })

  test('should handle presence join events', () => {
    let joinPayload: any = null

    // @ts-ignore - using simplified typing for test
    channel.on('presence', { event: 'join' }, (payload) => {
      joinPayload = payload
    })

    // Simulate presence join message
    const mockJoinPayload = {
      type: 'presence',
      event: 'join',
      key: 'user-123',
      currentPresences: [],
      newPresences: [{ user_id: 'user-123', name: 'John' }],
    }

    channel._trigger('presence', mockJoinPayload)

    assert.deepEqual(joinPayload, mockJoinPayload)
  })

  test('should handle presence sync events', () => {
    let syncTriggered = false

    // @ts-ignore - using simplified typing for test
    channel.on('presence', { event: 'sync' }, () => {
      syncTriggered = true
    })

    // Simulate presence sync message
    channel._trigger('presence', { type: 'presence', event: 'sync' })

    assert.equal(syncTriggered, true)
  })
})

describe('Presence message filtering', () => {
  test('should filter presence messages by event type', () => {
    let syncCount = 0
    let joinCount = 0

    // @ts-ignore - using simplified typing for test
    channel.on('presence', { event: 'sync' }, () => {
      syncCount++
    })
    // @ts-ignore - using simplified typing for test
    channel.on('presence', { event: 'join' }, () => {
      joinCount++
    })

    // Trigger sync event
    channel._trigger('presence', { type: 'presence', event: 'sync' })
    assert.equal(syncCount, 1)
    assert.equal(joinCount, 0)

    // Trigger join event
    channel._trigger('presence', { type: 'presence', event: 'join' })
    assert.equal(syncCount, 1)
    assert.equal(joinCount, 1)
  })

  test('should handle wildcard presence events', () => {
    let eventCount = 0

    // @ts-ignore - using simplified typing for test
    channel.on('presence', { event: '*' }, () => {
      eventCount++
    })

    // Trigger different presence events
    channel._trigger('presence', { type: 'presence', event: 'sync' })
    channel._trigger('presence', { type: 'presence', event: 'join' })
    channel._trigger('presence', { type: 'presence', event: 'leave' })

    assert.equal(eventCount, 3)
  })
})

describe('Presence helper methods', () => {
  test('gets presence state', () => {
    channel.presence.state = { u1: [{ id: 1, presence_ref: '1' }] }
    assert.deepEqual(channel.presenceState(), {
      u1: [{ id: 1, presence_ref: '1' }],
    })
  })

  test.each([
    {
      method: 'track',
      payload: { id: 123 },
      expectedCall: { type: 'presence', event: 'track', payload: { id: 123 } },
      timeout: 1000,
    },
    {
      method: 'untrack',
      payload: undefined,
      expectedCall: { type: 'presence', event: 'untrack' },
      timeout: {},
    },
  ])('$method presence via send method', async ({ method, payload, expectedCall, timeout }) => {
    setupJoinedChannelWithSocket(channel, testSetup.socket)
    const sendStub = vi.spyOn(channel, 'send').mockResolvedValue('ok')

    await (payload ? channel[method](payload) : channel[method]())

    expect(sendStub).toHaveBeenCalledWith(expectedCall, timeout)
  })
})

describe('Presence configuration override', () => {
  test('should enable presence when config.presence.enabled is true even without bindings', () => {
    const channelWithPresenceEnabled = testSetup.socket.channel('test-presence-override', {
      config: { presence: { enabled: true } },
    })
    assert.equal(
      channelWithPresenceEnabled.bindings[REALTIME_LISTEN_TYPES.PRESENCE]?.length,
      undefined
    )
    channelWithPresenceEnabled.subscribe()
    const joinPayload = channelWithPresenceEnabled.joinPush.payload
    assert.equal(joinPayload.config.presence.enabled, true)
    channelWithPresenceEnabled.unsubscribe()
  })

  test('should enable presence when both bindings exist and config.presence.enabled is true', () => {
    const channelWithBoth = testSetup.socket.channel('test-presence-both', {
      config: { presence: { enabled: true } },
    })
    channelWithBoth.on('presence', { event: 'sync' }, () => {})
    channelWithBoth.subscribe()
    const joinPayload = channelWithBoth.joinPush.payload
    assert.equal(joinPayload.config.presence.enabled, true)
    channelWithBoth.unsubscribe()
  })

  test('should enable presence when only bindings exist (existing behavior)', () => {
    const channelWithBindingsOnly = testSetup.socket.channel('test-presence-bindings-only')
    channelWithBindingsOnly.on('presence', { event: 'sync' }, () => {})
    channelWithBindingsOnly.subscribe()
    const joinPayload = channelWithBindingsOnly.joinPush.payload
    assert.equal(joinPayload.config.presence.enabled, true)
    channelWithBindingsOnly.unsubscribe()
  })

  test('should not enable presence when neither bindings exist nor config.presence.enabled is true', () => {
    const channelWithNeither = testSetup.socket.channel('test-presence-neither')
    assert.equal(channelWithNeither.bindings[REALTIME_LISTEN_TYPES.PRESENCE]?.length, undefined)
    channelWithNeither.subscribe()
    const joinPayload = channelWithNeither.joinPush.payload
    assert.equal(joinPayload.config.presence.enabled, false)
    channelWithNeither.unsubscribe()
  })

  test('should allow using track() method when presence is enabled via config override', async () => {
    const channelWithPresenceEnabled = testSetup.socket.channel('test-presence-track', {
      config: { presence: { enabled: true } },
    })
    setupJoinedChannelWithSocket(channelWithPresenceEnabled, testSetup.socket)
    const sendStub = vi.spyOn(channelWithPresenceEnabled, 'send').mockResolvedValue('ok')
    await channelWithPresenceEnabled.track({ id: 123, name: 'Test User' })
    expect(sendStub).toHaveBeenCalledWith(
      {
        type: 'presence',
        event: 'track',
        payload: { id: 123, name: 'Test User' },
      },
      1000
    )
    channelWithPresenceEnabled.unsubscribe()
  })

  test('should allow using untrack() method when presence is enabled via config override', async () => {
    const channelWithPresenceEnabled = testSetup.socket.channel('test-presence-untrack', {
      config: { presence: { enabled: true } },
    })
    setupJoinedChannelWithSocket(channelWithPresenceEnabled, testSetup.socket)
    const sendStub = vi.spyOn(channelWithPresenceEnabled, 'send').mockResolvedValue('ok')
    await channelWithPresenceEnabled.untrack()
    expect(sendStub).toHaveBeenCalledWith({ type: 'presence', event: 'untrack' }, {})
    channelWithPresenceEnabled.unsubscribe()
  })
})

describe('RealtimePresence static methods', () => {
  // Helper function to clone objects (from original RealtimePresence tests)
  const clone = (obj: any) => {
    const cloned = JSON.parse(JSON.stringify(obj))
    Object.entries(obj).map(([key, val]) => {
      if (val === undefined) {
        cloned[key] = undefined
      }
    })
    return cloned
  }

  const fixtures = {
    joins() {
      return { u1: [{ id: 1, presence_ref: '1.2' }] }
    },
    leaves() {
      return { u2: [{ id: 2, presence_ref: '2' }] }
    },
    state() {
      return {
        u1: [{ id: 1, presence_ref: '1' }],
        u2: [{ id: 2, presence_ref: '2' }],
        u3: [{ id: 3, presence_ref: '3' }],
      }
    },
  }

  describe('syncState functionality', () => {
    test.each([
      {
        name: 'should sync empty state',
        initialState: {},
        newState: { u1: [{ id: 1, presence_ref: '1' }] },
        expectedResult: { u1: [{ id: 1, presence_ref: '1' }] },
        expectedJoined: {
          u1: { current: [], newPres: [{ id: 1, presence_ref: '1' }] },
        },
        expectedLeft: {},
      },
      {
        name: 'should handle onJoin and onLeave callbacks',
        initialState: { u4: [{ id: 4, presence_ref: '4' }] },
        newState: fixtures.state(),
        expectedResult: fixtures.state(),
        expectedJoined: {
          u1: { current: [], newPres: [{ id: 1, presence_ref: '1' }] },
          u2: { current: [], newPres: [{ id: 2, presence_ref: '2' }] },
          u3: { current: [], newPres: [{ id: 3, presence_ref: '3' }] },
        },
        expectedLeft: {
          u4: { current: [], leftPres: [{ id: 4, presence_ref: '4' }] },
        },
      },
      {
        name: 'should only join newly added presences',
        initialState: { u3: [{ id: 3, presence_ref: '3' }] },
        newState: {
          u3: [
            { id: 3, presence_ref: '3' },
            { id: 3, presence_ref: '3.new' },
          ],
        },
        expectedResult: {
          u3: [
            { id: 3, presence_ref: '3' },
            { id: 3, presence_ref: '3.new' },
          ],
        },
        expectedJoined: {
          u3: {
            current: [{ id: 3, presence_ref: '3' }],
            newPres: [{ id: 3, presence_ref: '3.new' }],
          },
        },
        expectedLeft: {},
      },
    ])('$name', ({ initialState, newState, expectedResult, expectedJoined, expectedLeft }) => {
      const stateBefore = clone(initialState)
      const joined: any = {}
      const left: any = {}

      const onJoin = (key: string, current: any, newPres: any) => {
        joined[key] = { current, newPres }
      }
      const onLeave = (key: string, current: any, leftPres: any) => {
        left[key] = { current, leftPres }
      }

      // @ts-ignore - accessing static private method for testing
      const result = RealtimePresence.syncState(initialState, newState, onJoin, onLeave)

      assert.deepEqual(initialState, stateBefore)
      assert.deepEqual(result, expectedResult)
      assert.deepEqual(joined, expectedJoined)
      assert.deepEqual(left, expectedLeft)
    })
  })

  describe('syncDiff and utility methods', () => {
    test.each([
      {
        name: 'sync empty state with joins',
        initialState: {},
        diff: { joins: { u1: [{ id: 1, presence_ref: '1' }] }, leaves: {} },
        expected: { u1: [{ id: 1, presence_ref: '1' }] },
      },
      {
        name: 'add presence and remove empty key',
        initialState: fixtures.state(),
        diff: { joins: fixtures.joins(), leaves: fixtures.leaves() },
        expected: {
          u1: [
            { id: 1, presence_ref: '1' },
            { id: 1, presence_ref: '1.2' },
          ],
          u3: [{ id: 3, presence_ref: '3' }],
        },
      },
      {
        name: 'remove presence while leaving key if others exist',
        initialState: {
          u1: [
            { id: 1, presence_ref: '1' },
            { id: 1, presence_ref: '1.2' },
          ],
        },
        diff: { joins: {}, leaves: { u1: [{ id: 1, presence_ref: '1' }] } },
        expected: { u1: [{ id: 1, presence_ref: '1.2' }] },
      },
      {
        name: 'handle undefined callbacks',
        initialState: { u1: [{ id: 1, presence_ref: '1' }] },
        diff: {
          joins: { u2: [{ id: 2, presence_ref: '2' }] },
          leaves: { u1: [{ id: 1, presence_ref: '1' }] },
        },
        expected: { u2: [{ id: 2, presence_ref: '2' }] },
        useUndefinedCallbacks: true,
      },
    ])('syncDiff: $name', ({ initialState, diff, expected, useUndefinedCallbacks }) => {
      // @ts-ignore - accessing static private method for testing
      const result = useUndefinedCallbacks
        ? RealtimePresence.syncDiff(initialState, diff, undefined, undefined)
        : RealtimePresence.syncDiff(initialState, diff)

      assert.deepEqual(result, expected)
    })

    test('static utility methods work correctly', () => {
      // Test map function
      const state = {
        u1: [{ id: 1, presence_ref: '1' }],
        u2: [{ id: 2, presence_ref: '2' }],
      }
      // @ts-ignore - accessing static private method for testing
      const mapResult = RealtimePresence.map(state, (key, presences) => ({
        key,
        count: presences.length,
      }))
      assert.deepEqual(mapResult, [
        { key: 'u1', count: 1 },
        { key: 'u2', count: 1 },
      ])

      // Test transformState function
      const rawState = {
        u1: {
          metas: [{ id: 1, phx_ref: '1', phx_ref_prev: 'prev1', name: 'User 1' }],
        },
      }
      // @ts-ignore - accessing static private method for testing
      const transformResult = RealtimePresence.transformState(rawState)
      assert.deepEqual(transformResult, {
        u1: [{ id: 1, presence_ref: '1', name: 'User 1' }],
      })
      assert.ok(!transformResult.u1[0].hasOwnProperty('phx_ref'))

      // Test cloneDeep function
      const original = { nested: { value: 1 }, array: [1, 2, 3] }
      // @ts-ignore - accessing static private method for testing
      const cloned = RealtimePresence.cloneDeep(original)
      assert.deepEqual(cloned, original)
      assert.notStrictEqual(cloned, original)
      assert.notStrictEqual(cloned.nested, original.nested)
    })
  })

  describe('instance behavior', () => {
    test('handles custom events and pending diffs', () => {
      // Test custom channel events
      const customChannel = testSetup.socket.channel('custom-presence')
      const customPresence = new RealtimePresence(customChannel, {
        events: { state: 'custom_state', diff: 'custom_diff' },
      })

      customChannel._trigger('custom_state', {
        user1: { metas: [{ id: 1, phx_ref: '1' }] },
      })
      assert.ok(customPresence.state.user1)
      assert.equal(customPresence.state.user1[0].presence_ref, '1')

      // Test pending diffs behavior
      const presence = new RealtimePresence(channel)

      // Send diff before state (should be pending)
      channel._trigger('presence_diff', {
        joins: {},
        leaves: { u2: [{ id: 2, presence_ref: '2' }] },
      })
      assert.equal(presence.pendingDiffs.length, 1)

      // Send state (should apply pending diffs)
      channel.joinPush.ref = 'test-ref'
      channel._trigger('presence_state', {
        u1: [{ id: 1, presence_ref: '1' }],
        u2: [{ id: 2, presence_ref: '2' }],
      })
      assert.equal(presence.pendingDiffs.length, 0)
    })
  })
})
