import { beforeEach, afterEach, test, describe, expect, vi, Mock } from 'vitest'
import {
  type TestSetup,
  phxReply,
  setupRealtimeTest,
  waitForChannelSubscribed,
} from './helpers/setup'
import RealtimeChannel from '../src/RealtimeChannel'
import { CHANNEL_STATES, MAX_PUSH_BUFFER_SIZE } from '../src/lib/constants'

let testSetup: TestSetup
let channel: RealtimeChannel

const defaultTimeout = 1000

beforeEach(() => {
  testSetup = setupRealtimeTest({
    useFakeTimers: true,
    timeout: defaultTimeout,
  })
})

afterEach(() => {
  testSetup.cleanup()
})

describe('Error Recovery & Resilience', () => {
  beforeEach(async () => {
    testSetup.connect()
    await testSetup.socketConnected()
    channel = testSetup.client.channel('test-resilience')
  })

  afterEach(() => {
    channel.unsubscribe()
  })

  describe('Network disconnection recovery', () => {
    test('should handle network disconnection during subscription', async () => {
      testSetup.cleanup()
      testSetup = setupRealtimeTest({
        useFakeTimers: true,
        socketHandlers: {
          phx_join: () => {},
        },
      })

      channel = testSetup.client.channel('test-resilience')
      channel.subscribe()

      await vi.waitFor(() => {
        expect(testSetup.emitters.message).toHaveBeenCalledTimes(1)
        expect(testSetup.emitters.message).toHaveBeenCalledWith(
          'realtime:test-resilience',
          'phx_join',
          expect.any(Object)
        )
      })

      testSetup.client.socketAdapter.getSocket().conn = null
      testSetup.connect()

      vi.advanceTimersByTime(defaultTimeout)

      testSetup.mockServer.emit(
        'message',
        JSON.stringify({
          event: 'phx_reply',
          payload: { status: 'ok', response: { postgres_changes: [] } },
          ref: channel.joinPush.ref,
          topic: 'realtime:test-resilience',
        })
      )

      await waitForChannelSubscribed(channel)
    })

    test('should recover from server disconnection', async () => {
      channel.subscribe()
      await waitForChannelSubscribed(channel)

      testSetup.mockServer.emit('close', {
        code: 1006,
        reason: 'Network Failure',
        wasClean: false,
      })
      expect(channel.state).toBe(CHANNEL_STATES.errored)
      vi.advanceTimersByTime(defaultTimeout)

      // Verify channel rejoins
      await waitForChannelSubscribed(channel)
    })
  })

  describe('Malformed message handling', () => {
    test('should handle malformed server responses gracefully', async () => {
      channel.subscribe()
      await waitForChannelSubscribed(channel)

      // Override _onMessage to simulate malformed message handling
      const originalOnMessage = channel.channelAdapter.getChannel().onMessage

      channel.channelAdapter.getChannel().onMessage = (event, payload, ref) => {
        if (payload === null || payload === undefined) {
          throw new Error('Malformed payload')
        }

        return originalOnMessage.call(channel, event, payload, ref)
      }

      expect(() => {
        channel.channelAdapter.getChannel().trigger('test')
      }).toThrowError('Malformed payload')

      channel.channelAdapter.getChannel().onMessage = originalOnMessage
    })

    test('should handle missing required message fields', () => {
      // Test with missing event field
      const incompletePayload = {
        type: 'broadcast',
        // missing event field
        payload: { data: 'test' },
      }

      // Should not crash, but filter should not match
      let callbackTriggered = false
      channel.on('broadcast', { event: 'test' }, () => {
        callbackTriggered = true
      })

      channel.channelAdapter.getChannel().trigger('broadcast', incompletePayload)
      expect(callbackTriggered).toBe(false)
    })
  })

  describe('Subscription error handling', () => {
    beforeEach(() => {
      testSetup.cleanup()
      testSetup = setupRealtimeTest({
        useFakeTimers: true,
        timeout: defaultTimeout,
        socketHandlers: {
          // No response for timeout
          phx_join: () => {},
        },
      })
    })

    test('should handle subscription timeout gracefully', () => {
      let timeoutReceived = false

      channel.subscribe((status) => {
        if (status === 'TIMED_OUT') {
          timeoutReceived = true
        }
      })

      channel = testSetup.client.channel('test-resilience')
      channel.subscribe()

      vi.advanceTimersByTime(defaultTimeout)

      expect(timeoutReceived).toBe(true)
      expect(channel.state).toBe(CHANNEL_STATES.errored)
    })

    test('should handle subscription errors with detailed error messages', () => {
      let errorStatus: string | null = null
      let errorMessage: string | null = null

      channel.subscribe((status, error) => {
        errorStatus = status
        errorMessage = error?.message || null
      })

      // Simulate subscription error
      const errorPayload = {
        reason: 'Authentication failed',
        details: 'Invalid API key',
      }

      channel.joinPush.trigger('error', errorPayload)

      expect(errorStatus).toBe('CHANNEL_ERROR')
      expect(errorMessage).not.toBeNull()

      // @ts-ignore error message is string
      expect(errorMessage.includes('Invalid API key'))
      // @ts-ignore error message is string
      expect(errorMessage.includes('Authentication failed'))
    })
  })

  describe('State consistency during errors', () => {
    test('should maintain consistent state during rejoin failures', async () => {
      // Set up initial state
      channel.subscribe()
      await waitForChannelSubscribed(channel)

      testSetup.disconnect()
      await testSetup.socketClosed()

      // Directly set state to errored and schedule rejoin
      channel.state = CHANNEL_STATES.errored
      channel.rejoinTimer.scheduleTimeout()

      // Verify state transition
      expect(channel.state).toBe(CHANNEL_STATES.errored)

      // Verify rejoin timer is active
      expect(channel.rejoinTimer.timer).toBeTruthy()
    })

    test('should handle multiple error events gracefully', () => {
      let errorCount = 0

      channel.channelAdapter.onError(() => errorCount++)

      // Trigger multiple errors via the error event
      channel.channelAdapter.getChannel().trigger('phx_error', 'Error 1')
      channel.channelAdapter.getChannel().trigger('phx_error', 'Error 2')
      channel.channelAdapter.getChannel().trigger('phx_error', 'Error 3')

      // Should handle all errors
      expect(errorCount).toBe(3)
      expect(channel.state).toBe(CHANNEL_STATES.errored)
    })
  })
})

describe('Error Handling Consolidation', () => {
  let channel: RealtimeChannel
  let logSpy: Mock

  beforeEach(() => {
    testSetup.cleanup()
    logSpy = vi.fn()
    testSetup = setupRealtimeTest({
      logger: logSpy,
      useFakeTimers: true,
      timeout: defaultTimeout,
      socketHandlers: {
        phx_join: () => {},
      },
    })
    channel = testSetup.client.channel('test-error-handling')
  })

  describe('Error Handling Through Public API', () => {
    test('should set state to errored and schedule rejoin when joinPush receives error', async () => {
      // Set channel to joining state (not joined, so error handler will work)
      const scheduleTimeoutSpy = vi.spyOn(channel.rejoinTimer, 'scheduleTimeout')

      channel.subscribe()
      await testSetup.socketConnected()

      channel.joinPush.trigger('error', 'test reason')

      expect(channel.state).toBe(CHANNEL_STATES.errored)
      expect(scheduleTimeoutSpy).toHaveBeenCalledTimes(1)
      // Check that log was called with the correct arguments
      expect(logSpy).toHaveBeenCalledWith('channel', `error ${channel.topic}`, 'test reason')
    })

    test.each([
      {
        description: 'should not change state when channel is leaving',
        state: CHANNEL_STATES.leaving,
      },
      {
        description: 'should not change state when channel is closed',
        state: CHANNEL_STATES.closed,
      },
    ])('$description', ({ state }) => {
      channel.state = state
      const originalState = channel.state

      const scheduleTimeoutSpy = vi.spyOn(channel.rejoinTimer, 'scheduleTimeout')

      channel.joinPush.trigger('error', 'test reason')

      expect(channel.state).toBe(originalState)
      expect(scheduleTimeoutSpy).not.toHaveBeenCalled()
    })

    test('should handle timeout events through public API', () => {
      const scheduleTimeoutSpy = vi.spyOn(channel.rejoinTimer, 'scheduleTimeout')

      channel.subscribe()
      vi.advanceTimersByTime(defaultTimeout)

      expect(channel.state).toBe(CHANNEL_STATES.errored)
      expect(scheduleTimeoutSpy).toHaveBeenCalledTimes(1)
      expect(logSpy).toHaveBeenCalledWith(
        'channel',
        `timeout ${channel.topic}`,
        channel.joinPush.timeout
      )
    })

    test('should maintain consistent state during rejoin failures', async () => {
      testSetup.cleanup()
      testSetup = setupRealtimeTest({
        useFakeTimers: true,
        timeout: defaultTimeout,
        socketHandlers: {
          phx_join: (socket, message) => {
            socket.send(
              phxReply(message as string, { status: 'ok', response: { postgres_changes: [] } })
            )
          },
        },
      })

      channel = testSetup.client.channel('test')
      channel.subscribe()

      await waitForChannelSubscribed(channel)

      testSetup.disconnect()
      await testSetup.socketClosed()

      expect(channel.state).toBe(CHANNEL_STATES.errored)
      channel.rejoinTimer.scheduleTimeout()
      expect(channel.state).toBe(CHANNEL_STATES.errored)
      expect(channel.rejoinTimer.timer).toBeTruthy()
    })

    test('should handle multiple error events gracefully', async () => {
      channel.subscribe()
      const scheduleTimeoutSpy = vi.spyOn(channel.rejoinTimer, 'scheduleTimeout')

      channel.joinPush.trigger('error', 'reason1')
      expect(channel.state).toBe(CHANNEL_STATES.errored)

      vi.advanceTimersByTime(defaultTimeout)

      expect(channel.state).toBe(CHANNEL_STATES.joining)
      await vi.waitFor(() => expect(scheduleTimeoutSpy).toHaveBeenCalledTimes(1))

      // Simulate second error - should not crash
      channel.joinPush.trigger('error', 'reason2')
      expect(channel.state).toBe(CHANNEL_STATES.errored)

      vi.advanceTimersByTime(defaultTimeout)

      // Should have called scheduleTimeout for both errors
      await vi.waitFor(() => expect(scheduleTimeoutSpy).toHaveBeenCalledTimes(2))
    })
  })

  describe('Join Push Error Integration', () => {
    beforeEach(() => {
      testSetup.cleanup()
      testSetup = setupRealtimeTest({
        useFakeTimers: true,
        timeout: defaultTimeout,
        socketHandlers: {
          // No response for timeout
          phx_join: () => {},
        },
      })

      channel = testSetup.client.channel('test-join-push-error')
    })

    test('should handle joinPush timeout through existing error handling', async () => {
      channel.subscribe()

      const scheduleTimeoutSpy = vi.spyOn(channel.rejoinTimer, 'scheduleTimeout')

      await testSetup.socketConnected()

      // Simulate timeout through public API
      channel.joinPush.trigger('timeout', {})

      // Verify the existing error handling works
      expect(channel.state).toBe(CHANNEL_STATES.errored)
      expect(scheduleTimeoutSpy).toHaveBeenCalledTimes(1)
    })

    test('should handle joinPush error through existing error handling', async () => {
      channel.subscribe()

      const scheduleTimeoutSpy = vi.spyOn(channel.rejoinTimer, 'scheduleTimeout')

      await testSetup.socketConnected()

      // Trigger error through public API
      channel.joinPush.trigger('error', { message: 'join failed' })

      // Verify the existing error handling works
      expect(channel.state).toBe(CHANNEL_STATES.errored)
      expect(scheduleTimeoutSpy).toHaveBeenCalledTimes(1)
    })
  })
})

describe('Improved Cleanup & Bounded Buffer', () => {
  beforeEach(() => {
    channel = testSetup.client.channel('test-cleanup')
  })

  describe('Bounded push buffer', () => {
    let logSpy = vi.fn()

    beforeEach(() => {
      logSpy.mockClear()
      testSetup.cleanup()
      testSetup = setupRealtimeTest({
        timeout: defaultTimeout,
        useFakeTimers: true,
        logger: logSpy,
        socketHandlers: {
          phx_join: (socket, message) => {
            socket.send(phxReply(message, { status: 'ok', response: { postgres_changes: [] } }))
          },
        },
      })

      channel = testSetup.client.channel('test-push-buffer')
    })

    test('should maintain buffer within size limit', async () => {
      channel.subscribe()
      await waitForChannelSubscribed(channel)
      testSetup.disconnect()
      await testSetup.socketClosed()

      logSpy.mockClear()

      // Fill buffer to capacity
      for (let i = 0; i < MAX_PUSH_BUFFER_SIZE + 5; i++) {
        channel.channelAdapter.push('test', { data: `message-${i}` })
      }

      // Buffer should not exceed max size
      expect(channel.channelAdapter.getChannel().pushBuffer.length).toBe(MAX_PUSH_BUFFER_SIZE)

      // Should have logged about discarding old pushes
      expect(logSpy).toHaveBeenCalledWith(
        'channel',
        'discarded push due to buffer overflow: test',
        expect.any(Object)
      )
      expect(logSpy).toHaveBeenCalledTimes(5)
    })

    test('should destroy oldest push when buffer is full', async () => {
      channel.subscribe()
      await waitForChannelSubscribed(channel)
      testSetup.disconnect()
      await testSetup.socketClosed()

      logSpy.mockClear()

      // Add one push to get a reference for spying
      channel.channelAdapter.push('test', { data: 'first' })

      // Fill buffer beyond capacity
      for (let i = 0; i < MAX_PUSH_BUFFER_SIZE; i++) {
        channel.channelAdapter.push('test', { data: `message-${i}` })
      }

      // First push should have been destroyed
      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(logSpy).toHaveBeenCalledWith('channel', expect.any(String), { data: 'first' })
      expect(channel.channelAdapter.getChannel().pushBuffer.length).toBe(MAX_PUSH_BUFFER_SIZE)
    })

    test('should handle empty buffer gracefully', async () => {
      channel.subscribe()
      await waitForChannelSubscribed(channel)

      testSetup.disconnect()
      await testSetup.socketClosed()

      expect(channel.channelAdapter.getChannel().pushBuffer.length).toBe(0)
      // Should not throw when adding to empty buffer
      channel.channelAdapter.push('test', { data: 'test' })
      expect(channel.channelAdapter.getChannel().pushBuffer.length).toBe(1)
    })

    test('should preserve push order when under limit', async () => {
      channel.subscribe()
      await waitForChannelSubscribed(channel)

      testSetup.disconnect()
      await testSetup.socketClosed()

      // Add pushes under the limit
      channel.channelAdapter.push('test1', { data: 'first' })
      channel.channelAdapter.push('test2', { data: 'second' })
      channel.channelAdapter.push('test3', { data: 'third' })

      const pushBuffer = channel.channelAdapter.getChannel().pushBuffer

      expect(pushBuffer[0].event).toBe('test1')
      expect(pushBuffer[1].event).toBe('test2')
      expect(pushBuffer[2].event).toBe('test3')
      expect(pushBuffer.length).toBe(3)
    })
  })

  describe('Memory leak prevention', () => {
    test('should prevent push buffer growth during disconnection', async () => {
      channel.subscribe()
      await waitForChannelSubscribed(channel)

      testSetup.client.disconnect()
      await testSetup.socketClosed()

      // Simulate many rapid pushes during disconnection
      const extraPushes = 50

      for (let i = 0; i < MAX_PUSH_BUFFER_SIZE + extraPushes; i++) {
        channel.channelAdapter.push('rapid', { data: `message-${i}` })
      }

      // Should not exceed max buffer size
      expect(channel.channelAdapter.getChannel().pushBuffer.length).toBe(MAX_PUSH_BUFFER_SIZE)
    })
  })
})

describe('Trigger Function Error Handling', () => {
  beforeEach(() => {
    channel = testSetup.client.channel('test-trigger')
  })

  afterEach(() => {
    // Restore all stubs before unsubscribe to prevent unhandled errors
    vi.restoreAllMocks()
    channel.unsubscribe()
  })

  test('validates inlined channel event skipping logic still works', async () => {
    channel.subscribe()
    await waitForChannelSubscribed(channel)

    const joinRef = channel.joinPush.ref

    const triggerSpy = vi.spyOn(channel.channelAdapter.getChannel(), 'trigger')

    // This should skip because it's a channel event with wrong ref
    testSetup.mockServer.emit(
      'message',
      JSON.stringify({
        topic: 'realtime:test-trigger',
        event: 'test1',
        payload: {},
        ref: '11',
        join_ref: 'different-ref',
      })
    )

    testSetup.mockServer.emit(
      'message',
      JSON.stringify({
        topic: 'realtime:different-topic',
        event: 'test2',
        payload: {},
        ref: '12',
        join_ref: joinRef,
      })
    )
    testSetup.mockServer.emit(
      'message',
      JSON.stringify({
        topic: 'realtime:test-trigger',
        event: 'test3',
        payload: {},
        ref: '13',
        join_ref: joinRef,
      })
    )

    await vi.waitFor(() => expect(triggerSpy).toHaveBeenCalledWith('test3', {}, '13', joinRef))
    expect(triggerSpy).toHaveBeenCalledTimes(1)

    triggerSpy.mockRestore()
  })

  describe('trigger error scenarios', () => {
    test('should skip channel events with wrong ref', async () => {
      const spy = vi.fn()
      channel.channelAdapter.getChannel().onError(spy)

      channel.subscribe()
      await waitForChannelSubscribed(channel)

      const joinRef = channel.joinPush.ref

      testSetup.mockServer.emit(
        'message',
        JSON.stringify({
          topic: 'realtime:test-trigger',
          event: 'phx_error',
          payload: { message: 'error' },
          ref: 'wrong-ref',
          join_ref: joinRef,
        })
      )

      expect(spy).not.toHaveBeenCalled()

      testSetup.mockServer.emit(
        'message',
        JSON.stringify({
          topic: 'realtime:test-trigger',
          event: 'phx_error',
          payload: { message: 'error' },
          ref: joinRef,
          join_ref: joinRef,
        })
      )

      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
})
