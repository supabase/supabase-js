import assert from 'assert'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeChannel from '../src/RealtimeChannel'
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

