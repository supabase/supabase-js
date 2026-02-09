import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest'
import { setupRealtimeTest, waitForChannelSubscribed, type TestSetup } from './helpers/setup'
import type RealtimeChannel from '../src/RealtimeChannel'
import { CHANNEL_STATES } from '../src/lib/constants'

let testSetup: TestSetup
let channel: RealtimeChannel

beforeEach(async () => {
  testSetup = setupRealtimeTest({
    useFakeTimers: true,
  })
  testSetup.connect()
  await testSetup.socketConnected()

  channel = testSetup.client.channel('test-integration')
})

afterEach(() => {
  channel.unsubscribe()
  testSetup.cleanup()
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
    expect(subscriptionStatus).toBe('SUBSCRIBED')
    expect(channel.state).toBe(CHANNEL_STATES.joined)

    // Unsubscribe and capture result
    const result = await channel.unsubscribe()
    unsubscriptionResult = result

    expect(unsubscriptionResult).toBe('ok')
    expect(channel.state).toBe(CHANNEL_STATES.closed)
  })

  test('should handle mixed event types in single channel', () => {
    const broadcastSpy = vi.fn()
    const presenceSpy = vi.fn()
    const postgresSpy = vi.fn()

    // Set up multiple event types
    channel.on('broadcast', { event: 'test' }, broadcastSpy)
    channel.on('presence', { event: 'sync' }, presenceSpy)
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public' }, postgresSpy)

    // Trigger all event types
    channel.channelAdapter.getChannel().trigger('broadcast', { event: 'test' })
    channel.channelAdapter.getChannel().trigger('presence', { event: 'sync' })
    channel.channelAdapter
      .getChannel()
      .trigger('postgres_changes', { event: 'insert', test: 'data' })

    expect(broadcastSpy).toHaveBeenCalledTimes(1)
    expect(presenceSpy).toHaveBeenCalledTimes(1)
    expect(postgresSpy).toHaveBeenCalledTimes(1)
  })
})

describe('Error recovery integration', () => {
  test('should recover from subscription errors and retry', () => {
    let statusUpdates: string[] = []

    channel.subscribe((status) => {
      statusUpdates.push(status)
    })

    // Simulate initial error
    channel.joinPush.trigger('error', { message: 'Initial failure' })
    expect(statusUpdates).toContain('CHANNEL_ERROR')
    expect(channel.state).toBe(CHANNEL_STATES.errored)

    // Verify rejoin timer is scheduled
    expect(channel.rejoinTimer.timer).toBeTruthy()
  })
})

describe('Complex message flow integration', () => {
  test('should handle rapid message sending and receiving', async () => {
    channel.subscribe()
    await waitForChannelSubscribed(channel)

    const pushSpy = vi.spyOn(channel.channelAdapter.getChannel(), 'push')

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
    expect(channel.state).toBe(CHANNEL_STATES.closed)
    expect(channel.joinedOnce).toBe(false)

    // Subscribe
    channel.subscribe()
    expect(channel.state).toBe(CHANNEL_STATES.joining)

    // Complete subscription
    channel.joinPush.trigger('ok', {})
    expect(channel.state).toBe(CHANNEL_STATES.joined)
    expect(channel.joinedOnce).toBe(true)

    // Add event listeners
    channel.on('broadcast', { event: 'test' }, () => {})
    expect(channel.bindings.broadcast.length).toBeGreaterThan(0)

    // Unsubscribe
    channel.unsubscribe()
    expect(channel.state).toBe(CHANNEL_STATES.closed)

    expect(channel.channelAdapter.getChannel().pushBuffer.length).toBe(0)
  })
})
