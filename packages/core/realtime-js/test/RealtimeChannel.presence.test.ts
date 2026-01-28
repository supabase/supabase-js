import assert from 'assert'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeChannel from '../src/RealtimeChannel'
import { setupRealtimeTest, type TestSetup } from './helpers/setup'
import { REALTIME_LISTEN_TYPES } from '../src/RealtimeChannel'
import { CHANNEL_STATES } from '../src/lib/constants'

const defaultTimeout = 1000

let channel: RealtimeChannel
let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest({
    useFakeTimers: true,
    timeout: defaultTimeout,
  })
  channel = testSetup.client.channel('test-presence')
})

afterEach(() => {
  testSetup.cleanup()
})

describe('Presence state management', () => {
  test('should initialize presence state correctly', () => {
    const presenceState = channel.presenceState()
    assert.deepEqual(presenceState, {})
  })

  test('should enable presence when presence listeners are added', () => {
    channel.on('presence', { event: 'sync' }, () => {})

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        assert.equal(channel.params.config.presence?.enabled, true)
      }
    })
  })

  test('should handle presence join events', async () => {
    let joinPayload: any = null

    channel.on('presence', { event: 'join' }, (payload) => {
      joinPayload = payload
    })

    channel.subscribe()
    await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.joined))

    // Must receive presence_state before presence_diff
    testSetup.mockServer.emit(
      'message',
      JSON.stringify({
        topic: channel.topic,
        event: 'presence_state',
        payload: {},
      })
    )

    testSetup.mockServer.emit(
      'message',
      JSON.stringify({
        topic: channel.topic,
        event: 'presence_diff',
        payload: {
          joins: {
            'user-123': {
              metas: [{ phx_ref: 'phoenix_ref', name: 'John', user_id: 'user-123' }],
            },
          },
          leaves: {},
        },
      })
    )

    await vi.waitFor(() =>
      expect(joinPayload).toEqual({
        currentPresences: [],
        event: 'join',
        key: 'user-123',
        newPresences: [{ phx_ref: 'phoenix_ref', name: 'John', user_id: 'user-123' }],
      })
    )
  })

  test('should handle presence leave events', async () => {
    let leavePayload: any = null

    channel.on('presence', { event: 'leave' }, (payload) => {
      leavePayload = payload
    })

    channel.subscribe()
    await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.joined))

    // Must receive presence_state before presence_diff
    testSetup.mockServer.emit(
      'message',
      JSON.stringify({
        topic: channel.topic,
        event: 'presence_state',
        payload: {
          'user-123': { metas: [{ phx_ref: 'phoenix_ref', name: 'John', user_id: 'user-123' }] },
        },
      })
    )

    testSetup.mockServer.emit(
      'message',
      JSON.stringify({
        topic: channel.topic,
        event: 'presence_diff',
        payload: {
          joins: {},
          leaves: {
            'user-123': {
              metas: [{ phx_ref: 'phoenix_ref', name: 'John', user_id: 'user-123' }],
            },
          },
        },
      })
    )

    await vi.waitFor(() =>
      expect(leavePayload).toEqual({
        currentPresences: [],
        event: 'leave',
        key: 'user-123',
        leftPresences: [{ phx_ref: 'phoenix_ref', name: 'John', user_id: 'user-123' }],
      })
    )
  })

  test('should handle presence sync events', async () => {
    let syncTriggered = false

    channel.on('presence', { event: 'sync' }, () => {
      syncTriggered = true
    })

    channel.subscribe()
    await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.joined))

    testSetup.mockServer.emit(
      'message',
      JSON.stringify({
        topic: channel.topic,
        event: 'presence_state',
        payload: {},
      })
    )

    await vi.waitFor(() => expect(syncTriggered).toBe(true))
  })

  test('should wait for presence_state before processing presence_diff', async () => {
    let joinPayload: any = null

    channel.on('presence', { event: 'join' }, (payload) => {
      joinPayload = payload
    })

    channel.subscribe()
    await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.joined))

    // Emit presence_diff before presence_state
    testSetup.mockServer.emit(
      'message',
      JSON.stringify({
        topic: channel.topic,
        event: 'presence_diff',
        payload: {
          joins: {
            'user-123': {
              metas: [{ phx_ref: 'phoenix_ref', name: 'John', user_id: 'user-123' }],
            },
          },
          leaves: {},
        },
      })
    )

    // Delay presence_state emission
    setTimeout(() => {
      testSetup.mockServer.emit(
        'message',
        JSON.stringify({
          topic: channel.topic,
          event: 'presence_state',
          payload: {},
        })
      )
    }, 100)

    expect(joinPayload).toBeNull()

    await vi.waitFor(() =>
      expect(joinPayload).toEqual({
        currentPresences: [],
        event: 'join',
        key: 'user-123',
        newPresences: [{ phx_ref: 'phoenix_ref', name: 'John', user_id: 'user-123' }],
      })
    )
  })
})

describe('Presence message filtering', () => {
  test('should filter presence messages by event type', async () => {
    let syncCount = 0
    let joinCount = 0

    channel.on('presence', { event: 'sync' }, () => {
      syncCount++
    })

    channel.on('presence', { event: 'join' }, () => {
      joinCount++
    })

    channel.channelAdapter.getChannel().trigger('presence', { event: 'sync' })

    await vi.waitFor(() => expect(syncCount).toBe(1))
    expect(joinCount).toBe(0)

    channel.channelAdapter.getChannel().trigger('presence', {
      event: 'join',
      topic: channel.topic,
      payload: {
        joins: {
          'user-123': {
            metas: [{ phx_ref: 'phoenix_ref' }],
          },
        },
        leaves: {},
      },
    })

    await vi.waitFor(() => expect(joinCount).toBe(1))
    expect(syncCount).toBe(1) // sync is trigger with `presence_diff`
  })

  test('should handle wildcard presence events', () => {
    let eventCount = 0

    channel.on('presence', { event: '*' }, () => {
      eventCount++
    })

    // Trigger different presence events
    channel.channelAdapter.getChannel().trigger('presence', { type: 'presence', event: 'sync' })
    channel.channelAdapter.getChannel().trigger('presence', { type: 'presence', event: 'join' })
    channel.channelAdapter.getChannel().trigger('presence', { type: 'presence', event: 'leave' })

    assert.equal(eventCount, 3)
  })
})

describe('Presence helper methods', () => {
  beforeEach(() => {
    testSetup.cleanup()
    testSetup = setupRealtimeTest({
      timeout: defaultTimeout,
      socketHandlers: {
        presence: (socket, msg) => {
          const { topic, ref } = JSON.parse(msg as string)
          socket.send(
            JSON.stringify({
              topic: topic,
              event: 'phx_reply',
              payload: { status: 'ok', response: {} },
              ref: ref,
            })
          )
        },
      },
    })
    channel = testSetup.client.channel('test-presence')
  })

  test('gets transformed presence state', () => {
    // @ts-ignore - accessing private fields for testing
    channel.presence.presenceAdapter.presence.state = { u1: { metas: [{ id: 1, phx_ref: '1' }] } }
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
    channel.subscribe()
    await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.joined))

    // @ts-ignore weird call to make test generic
    const resp = await (payload ? channel[method](payload) : channel[method]())

    const { type, event, payload: payloadValue } = expectedCall

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toHaveBeenCalledWith('realtime:test-presence', type, {
        event: event,
        type: type,
        payload: payloadValue,
      })
    )

    expect(resp).toBe('ok')
  })
})

describe('Presence configuration override', () => {
  beforeEach(() => {
    testSetup.cleanup()
    testSetup = setupRealtimeTest({
      timeout: defaultTimeout,
      socketHandlers: {
        presence: (socket, msg) => {
          const { topic, ref } = JSON.parse(msg as string)
          socket.send(
            JSON.stringify({
              topic: topic,
              event: 'phx_reply',
              payload: { status: 'ok', response: {} },
              ref: ref,
            })
          )
        },
      },
    })
  })

  test('should enable presence when config.presence.enabled is true even without bindings', () => {
    const channelWithPresenceEnabled = testSetup.client.channel('test-presence-override', {
      config: { presence: { enabled: true } },
    })
    assert.equal(
      channelWithPresenceEnabled.bindings[REALTIME_LISTEN_TYPES.PRESENCE]?.length,
      undefined
    )
    channelWithPresenceEnabled.subscribe()

    const joinPayload = channelWithPresenceEnabled.joinPush.payload()
    // @ts-ignore not typed payload
    assert.equal(joinPayload.config.presence.enabled, true)
    channelWithPresenceEnabled.unsubscribe()
  })

  test('should enable presence when both bindings exist and config.presence.enabled is true', () => {
    const channelWithBoth = testSetup.client.channel('test-presence-both', {
      config: { presence: { enabled: true } },
    })
    channelWithBoth.on('presence', { event: 'sync' }, () => {})
    channelWithBoth.subscribe()
    const joinPayload = channelWithBoth.joinPush.payload()
    // @ts-ignore not typed payload
    assert.equal(joinPayload.config.presence.enabled, true)
    channelWithBoth.unsubscribe()
  })

  test('should enable presence when only bindings exist (existing behavior)', () => {
    const channelWithBindingsOnly = testSetup.client.channel('test-presence-bindings-only')
    channelWithBindingsOnly.on('presence', { event: 'sync' }, () => {})
    channelWithBindingsOnly.subscribe()
    const joinPayload = channelWithBindingsOnly.joinPush.payload()
    // @ts-ignore not typed payload
    assert.equal(joinPayload.config.presence.enabled, true)
    channelWithBindingsOnly.unsubscribe()
  })

  test('should not enable presence when neither bindings exist nor config.presence.enabled is true', () => {
    const channelWithNeither = testSetup.client.channel('test-presence-neither')
    assert.equal(channelWithNeither.bindings[REALTIME_LISTEN_TYPES.PRESENCE]?.length, undefined)
    channelWithNeither.subscribe()
    const joinPayload = channelWithNeither.joinPush.payload()
    // @ts-ignore not typed payload
    assert.equal(joinPayload.config.presence.enabled, false)
    channelWithNeither.unsubscribe()
  })

  test('should allow using track() method when presence is enabled via config override', async () => {
    const channelWithPresenceEnabled = testSetup.client.channel('test-presence-track', {
      config: { presence: { enabled: true } },
    })

    channelWithPresenceEnabled.subscribe()
    await vi.waitFor(() => expect(channelWithPresenceEnabled.state).toBe(CHANNEL_STATES.joined))

    const resp = await channelWithPresenceEnabled.track({ id: 123, name: 'Test User' })
    expect(resp).toBe('ok')

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toHaveBeenCalledWith(
        'realtime:test-presence-track',
        'presence',
        {
          type: 'presence',
          event: 'track',
          payload: { id: 123, name: 'Test User' },
        }
      )
    )

    channelWithPresenceEnabled.unsubscribe()
  })

  test('should allow using untrack() method when presence is enabled via config override', async () => {
    const channelWithPresenceEnabled = testSetup.client.channel('test-presence-untrack', {
      config: { presence: { enabled: true } },
    })

    channelWithPresenceEnabled.subscribe()
    await vi.waitFor(() => expect(channelWithPresenceEnabled.state).toBe(CHANNEL_STATES.joined))

    const resp = await channelWithPresenceEnabled.untrack()
    expect(resp).toBe('ok')

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toHaveBeenCalledWith(
        'realtime:test-presence-untrack',
        'presence',
        {
          type: 'presence',
          event: 'untrack',
        }
      )
    )

    channelWithPresenceEnabled.unsubscribe()
  })
})
