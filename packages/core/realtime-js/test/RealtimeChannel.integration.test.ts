import assert from 'assert'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeChannel from '../src/RealtimeChannel'
import { CHANNEL_STATES } from '../src/lib/constants'
import {
  setupRealtimeTest,
  cleanupRealtimeTest,
  TestSetup,
  setupJoinedChannelWithSocket,
  setupJoinedChannel,
  setupDisconnectedSocket,
} from './helpers/setup'

const defaultTimeout = 1000

let channel: RealtimeChannel
let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest({
    useFakeTimers: true,
    timeout: defaultTimeout,
  })
})

afterEach(() => cleanupRealtimeTest(testSetup))

beforeEach(() => {
  channel = testSetup.socket.channel('test-integration')
})

afterEach(() => {
  channel.unsubscribe()
})

describe('Complete lifecycle integration', () => {
  test('should handle complete subscription and unsubscription cycle', async () => {
    let subscriptionStatus = ''
    let unsubscriptionResult = ''

    // Subscribe with callback
    channel.subscribe((status) => {
      subscriptionStatus = status
    })

    // Simulate successful subscription
    channel.joinPush.trigger('ok', {})
    assert.equal(subscriptionStatus, 'SUBSCRIBED')
    assert.equal(channel.state, CHANNEL_STATES.joined)

    // Unsubscribe and capture result
    const result = await channel.unsubscribe()
    unsubscriptionResult = result

    expect(['ok', 'timed out', 'error'].includes(unsubscriptionResult)).toBeTruthy()
    assert.equal(channel.state, CHANNEL_STATES.closed)
  })

  test('should handle mixed event types in single channel', () => {
    let broadcastCount = 0
    let presenceCount = 0
    let postgresCount = 0

    // Set up multiple event types
    channel.on('broadcast', { event: 'test' }, () => {
      broadcastCount++
    })
    // @ts-ignore - using simplified typing for test
    channel.on('presence', { event: 'sync' }, () => {
      presenceCount++
    })
    channel.bindings.postgres_changes = [
      {
        type: 'postgres_changes',
        filter: { event: 'INSERT' },
        callback: () => {
          postgresCount++
        },
      },
    ]

    // Trigger all event types
    channel._trigger('broadcast', { event: 'test' })
    channel._trigger('presence', { event: 'sync' })
    channel._trigger('insert', { test: 'data' })

    assert.equal(broadcastCount, 1)
    assert.equal(presenceCount, 1)
    assert.equal(postgresCount, 1)
  })
})

describe('Error recovery integration', () => {
  test('should recover from subscription errors and retry', () => {
    let statusUpdates: string[] = []

    channel.subscribe((status, error) => {
      statusUpdates.push(status)
    })

    // Simulate initial error
    channel.joinPush.trigger('error', { message: 'Initial failure' })
    expect(statusUpdates).toContain('CHANNEL_ERROR')
    assert.equal(channel.state, CHANNEL_STATES.errored)

    // Verify rejoin timer is scheduled
    expect(channel.rejoinTimer.timer).toBeTruthy()
  })
})

describe('Complex message flow integration', () => {
  test('should handle rapid message sending and receiving', () => {
    setupJoinedChannelWithSocket(channel, testSetup.socket)
    const pushSpy = vi.spyOn(channel, '_push')

    // Send multiple rapid messages
    const messages = Array.from({ length: 10 }, (_, i) => `message-${i}`)

    messages.forEach(async (message) => {
      await channel.send({
        type: 'broadcast',
        event: 'rapid-test',
        payload: { message },
      })
    })

    // Should have attempted to push all messages
    expect(pushSpy).toHaveBeenCalledTimes(10)
  })
})

describe('State consistency integration', () => {
  test('should maintain consistent state across complex operations', () => {
    // Initial state
    assert.equal(channel.state, CHANNEL_STATES.closed)
    assert.equal(channel.joinedOnce, false)

    // Subscribe
    channel.subscribe()
    assert.equal(channel.state, CHANNEL_STATES.joining)

    // Complete subscription
    channel.joinPush.trigger('ok', {})
    assert.equal(channel.state, CHANNEL_STATES.joined)
    assert.equal(channel.joinedOnce, true)

    // Add event listeners
    channel.on('broadcast', { event: 'test' }, () => {})
    expect(channel.bindings.broadcast.length).toBeGreaterThan(0)

    // Unsubscribe
    channel.unsubscribe()
    assert.equal(channel.state, CHANNEL_STATES.closed)

    // Bindings should be cleared by teardown
    if (channel.state === CHANNEL_STATES.closed) {
      expect(channel.pushBuffer.length).toBe(0)
    }
  })
})

describe('Performance and resource management', () => {
  test('should handle resource cleanup efficiently', () => {
    // Set up complex state
    setupJoinedChannel(channel)

    // Add multiple event types
    for (let i = 0; i < 5; i++) {
      channel.on('broadcast', { event: `test-${i}` }, () => {})
    }

    // Add some pushes to buffer
    setupDisconnectedSocket(testSetup.socket)
    for (let i = 0; i < 3; i++) {
      channel._push('test', { data: `test-${i}` })
    }

    // Verify setup
    expect(channel.bindings.broadcast.length).toBeGreaterThan(0)
    expect(channel.pushBuffer.length).toBeGreaterThan(0)

    // Teardown should clean everything
    channel.teardown()

    assert.equal(channel.state, 'closed')
    assert.equal(channel.pushBuffer.length, 0)
    assert.deepEqual(channel.bindings, {})
  })
})
