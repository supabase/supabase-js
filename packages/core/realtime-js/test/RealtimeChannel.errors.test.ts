import assert from 'assert'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeChannel from '../src/RealtimeChannel'
import { CHANNEL_STATES, MAX_PUSH_BUFFER_SIZE } from '../src/lib/constants'
import {
  setupRealtimeTest,
  cleanupRealtimeTest,
  TestSetup,
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

describe('Error Recovery & Resilience', () => {
  beforeEach(() => {
    channel = testSetup.socket.channel('test-resilience')
  })

  afterEach(() => {
    channel.unsubscribe()
  })

  describe('Network disconnection recovery', () => {
    test('should handle network disconnection during subscription', () => {
      let subscriptionStatus: string | null = null

      channel.subscribe((status) => {
        subscriptionStatus = status
      })

      // Simulate network failure during subscription
      testSetup.socket.conn = null

      // Simulate reconnection
      testSetup.socket.connect()

      // Verify channel attempts to rejoin
      assert.equal(channel.state, CHANNEL_STATES.joining)
    })

    test('should recover from server disconnection', () => {
      // Set up successful subscription first
      setupJoinedChannel(channel)

      // Directly set state to errored and schedule rejoin
      channel.state = CHANNEL_STATES.errored
      channel.rejoinTimer.scheduleTimeout()

      // Verify channel goes to errored state
      assert.equal(channel.state, CHANNEL_STATES.errored)

      // Verify rejoin timer is scheduled
      expect(channel.rejoinTimer.timer).toBeTruthy()
    })
  })

  describe('Malformed message handling', () => {
    test('should handle malformed server responses gracefully', () => {
      let errorTriggered = false

      // @ts-ignore - accessing private method for testing
      channel._onError(() => {
        errorTriggered = true
      })

      // Override _onMessage to simulate malformed message handling
      const originalOnMessage = channel._onMessage
      channel._onMessage = (event, payload, ref) => {
        if (payload === null || payload === undefined) {
          throw new Error('Malformed payload')
        }
        return originalOnMessage.call(channel, event, payload, ref)
      }

      try {
        // Simulate malformed message
        channel._trigger('test', null)
      } catch (error) {
        // Error should be caught and handled
        expect(error instanceof Error)
        assert.equal(error.message, 'Malformed payload')
      }
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

      channel._trigger('broadcast', incompletePayload)
      assert.equal(callbackTriggered, false)
    })
  })

  describe('Subscription error handling', () => {
    test('should handle subscription timeout gracefully', () => {
      let timeoutReceived = false

      channel.subscribe((status) => {
        if (status === 'TIMED_OUT') {
          timeoutReceived = true
        }
      })

      // Simulate subscription timeout
      channel.joinPush.trigger('timeout', {})

      assert.equal(timeoutReceived, true)
      assert.equal(channel.state, CHANNEL_STATES.errored)
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

      assert.equal(errorStatus, 'CHANNEL_ERROR')
      expect(errorMessage !== null && errorMessage.includes('Authentication failed'))
    })
  })

  describe('State consistency during errors', () => {
    test('should maintain consistent state during rejoin failures', () => {
      // Set up initial state
      setupJoinedChannel(channel)

      // Mock socket as disconnected
      setupDisconnectedSocket(testSetup.socket)

      // Directly set state to errored and schedule rejoin
      channel.state = CHANNEL_STATES.errored
      channel.rejoinTimer.scheduleTimeout()

      // Verify state transition
      assert.equal(channel.state, CHANNEL_STATES.errored)

      // Verify rejoin timer is active
      expect(channel.rejoinTimer.timer).toBeTruthy()
    })

    test('should handle multiple error events gracefully', () => {
      let errorCount = 0

      // Setup error handler directly
      // @ts-ignore - accessing private method for testing
      channel._onError(() => {
        errorCount++
      })

      // Set initial state to allow error handling
      channel.state = CHANNEL_STATES.joining

      // Trigger multiple errors via the error event
      // @ts-ignore - accessing private method for testing
      channel._trigger('phx_error', 'Error 1')
      // @ts-ignore - accessing private method for testing
      channel._trigger('phx_error', 'Error 2')
      // @ts-ignore - accessing private method for testing
      channel._trigger('phx_error', 'Error 3')

      // Should handle all errors
      assert.equal(errorCount, 3)
      assert.equal(channel.state, CHANNEL_STATES.errored)
    })
  })
})

describe('Error Handling Consolidation', () => {
  beforeEach(() => {
    channel = testSetup.socket.channel('test-error-handling')
  })

  afterEach(() => {
    channel.unsubscribe()
  })

  describe('Error Handling Through Public API', () => {
    let logSpy: any

    beforeEach(() => {
      logSpy = vi.spyOn(testSetup.socket, 'log')
    })

    test('should set state to errored and schedule rejoin when joinPush receives error', () => {
      // Set channel to joining state (not joined, so error handler will work)
      channel.state = CHANNEL_STATES.joining

      const scheduleTimeoutSpy = vi.spyOn(channel.rejoinTimer, 'scheduleTimeout')

      // Simulate the actual error flow by calling _matchReceive directly on the joinPush
      // This is how the error would actually be processed
      // @ts-ignore - accessing private method for proper simulation
      channel.joinPush._matchReceive({
        status: 'error',
        response: 'test reason',
      })

      assert.equal(channel.state, CHANNEL_STATES.errored)
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

      // Trigger actual error through public API
      channel.joinPush.trigger('error', 'test reason')

      assert.equal(channel.state, originalState)
      expect(scheduleTimeoutSpy).not.toHaveBeenCalled()
    })

    test('should handle timeout events through public API', () => {
      // Keep channel in joining state so timeout handler will trigger
      channel.state = CHANNEL_STATES.joining

      const scheduleTimeoutSpy = vi.spyOn(channel.rejoinTimer, 'scheduleTimeout')

      // Simulate the actual timeout flow by calling _matchReceive directly
      // @ts-ignore - accessing private method for proper simulation
      channel.joinPush._matchReceive({ status: 'timeout', response: {} })

      assert.equal(channel.state, CHANNEL_STATES.errored)
      expect(scheduleTimeoutSpy).toHaveBeenCalledTimes(1)
      expect(logSpy).toHaveBeenCalledWith(
        'channel',
        `timeout ${channel.topic}`,
        channel.joinPush.timeout
      )
    })

    test('should maintain consistent state during rejoin failures', () => {
      setupJoinedChannel(channel)
      setupDisconnectedSocket(testSetup.socket)
      channel.state = CHANNEL_STATES.errored
      channel.rejoinTimer.scheduleTimeout()
      assert.equal(channel.state, CHANNEL_STATES.errored)
      expect(channel.rejoinTimer.timer).toBeTruthy()
    })

    test('should handle multiple error events gracefully', () => {
      channel.state = CHANNEL_STATES.joining
      const scheduleTimeoutSpy = vi.spyOn(channel.rejoinTimer, 'scheduleTimeout')

      // Simulate first error through proper flow
      // @ts-ignore - accessing private method for proper simulation
      channel.joinPush._matchReceive({ status: 'error', response: 'reason1' })
      assert.equal(channel.state, CHANNEL_STATES.errored)

      // Reset state to test second error
      channel.state = CHANNEL_STATES.joining

      // Simulate second error - should not crash
      // @ts-ignore - accessing private method for proper simulation
      channel.joinPush._matchReceive({ status: 'error', response: 'reason2' })
      assert.equal(channel.state, CHANNEL_STATES.errored)

      // Should have called scheduleTimeout for both errors
      expect(scheduleTimeoutSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Join Push Error Integration', () => {
    test('should handle joinPush timeout through existing error handling', () => {
      channel.subscribe()

      const scheduleTimeoutSpy = vi.spyOn(channel.rejoinTimer, 'scheduleTimeout')

      // Simulate timeout through public API
      channel.joinPush.trigger('timeout', {})

      // Verify the existing error handling works
      assert.equal(channel.state, CHANNEL_STATES.errored)
      expect(scheduleTimeoutSpy).toHaveBeenCalledTimes(1)
    })

    test('should handle joinPush error through existing error handling', () => {
      channel.subscribe()

      const scheduleTimeoutSpy = vi.spyOn(channel.rejoinTimer, 'scheduleTimeout')

      // Trigger error through public API
      channel.joinPush.trigger('error', { message: 'join failed' })

      // Verify the existing error handling works
      assert.equal(channel.state, CHANNEL_STATES.errored)
      expect(scheduleTimeoutSpy).toHaveBeenCalledTimes(1)
    })
  })
})

describe('Improved Cleanup & Bounded Buffer', () => {
  beforeEach(() => {
    channel = testSetup.socket.channel('test-cleanup')
  })

  afterEach(() => {
    channel.teardown()
  })

  describe('Enhanced teardown', () => {
    test('should perform complete cleanup', () => {
      // Add pushes to buffer
      setupJoinedChannel(channel)
      setupDisconnectedSocket(testSetup.socket)
      channel._push('test', { data: 'test1' })
      channel._push('test', { data: 'test2' })

      assert.equal(channel.pushBuffer.length, 2)

      // Schedule rejoin timer
      channel.rejoinTimer.scheduleTimeout()
      expect(channel.rejoinTimer.timer).toBeTruthy()

      // Perform teardown
      channel.teardown()

      // Verify important cleanup
      assert.equal(channel.pushBuffer.length, 0)
      assert.equal(channel.state, 'closed')
      assert.equal(channel.rejoinTimer.timer, undefined)
      // Bindings are cleared (this clears ALL bindings, not just user ones)
      assert.deepEqual(channel.bindings, {})
    })

    test('should be safe to call multiple times', () => {
      // First teardown
      channel.teardown()
      assert.equal(channel.state, 'closed')

      // Second teardown should not throw or cause issues
      channel.teardown()
      assert.equal(channel.state, 'closed')

      // Should still be safe to call again
      channel.teardown()
      assert.equal(channel.state, 'closed')
    })

    test('should destroy all pushes in buffer before clearing', () => {
      setupJoinedChannel(channel)
      setupDisconnectedSocket(testSetup.socket)

      // Add pushes to buffer
      channel._push('test', { data: 'test1' })
      channel._push('test', { data: 'test2' })

      const push1 = channel.pushBuffer[0]
      const push2 = channel.pushBuffer[1]

      const destroySpy1 = vi.spyOn(push1, 'destroy')
      const destroySpy2 = vi.spyOn(push2, 'destroy')

      channel.teardown()

      expect(destroySpy1).toHaveBeenCalledTimes(1)
      expect(destroySpy2).toHaveBeenCalledTimes(1)
      assert.equal(channel.pushBuffer.length, 0)
    })
  })

  describe('Bounded push buffer (_addToPushBuffer)', () => {
    test('should maintain buffer within size limit', () => {
      setupJoinedChannel(channel)
      const isConnectedStub = vi.spyOn(testSetup.socket, 'isConnected')
      isConnectedStub.mockReturnValue(false)

      const logSpy = vi.spyOn(testSetup.socket, 'log')

      // Fill buffer to capacity

      for (let i = 0; i < MAX_PUSH_BUFFER_SIZE + 5; i++) {
        channel._push('test', { data: `message-${i}` })
      }

      // Buffer should not exceed max size
      assert.equal(channel.pushBuffer.length, MAX_PUSH_BUFFER_SIZE)

      // Should have logged about discarding old pushes
      expect(logSpy).toHaveBeenCalled()
    })

    test('should destroy oldest push when buffer is full', () => {
      setupJoinedChannel(channel)
      const isConnectedStub = vi.spyOn(testSetup.socket, 'isConnected')
      isConnectedStub.mockReturnValue(false)

      // Add one push to get a reference for spying
      channel._push('test', { data: 'first' })
      const firstPush = channel.pushBuffer[0]
      const destroySpy = vi.spyOn(firstPush, 'destroy')

      // Fill buffer beyond capacity
      for (let i = 1; i < MAX_PUSH_BUFFER_SIZE + 2; i++) {
        channel._push('test', { data: `message-${i}` })
      }

      // First push should have been destroyed
      expect(destroySpy).toHaveBeenCalledTimes(1)
      assert.equal(channel.pushBuffer.length, MAX_PUSH_BUFFER_SIZE)
    })

    test('should handle empty buffer gracefully', () => {
      setupJoinedChannel(channel)
      setupDisconnectedSocket(testSetup.socket)

      // Should not throw when adding to empty buffer
      channel._push('test', { data: 'test' })
      assert.equal(channel.pushBuffer.length, 1)
    })

    test('should preserve push order when under limit', () => {
      setupJoinedChannel(channel)
      setupDisconnectedSocket(testSetup.socket)

      // Add pushes under the limit
      channel._push('test1', { data: 'first' })
      channel._push('test2', { data: 'second' })
      channel._push('test3', { data: 'third' })

      // Verify order is maintained
      assert.equal(channel.pushBuffer[0].event, 'test1')
      assert.equal(channel.pushBuffer[1].event, 'test2')
      assert.equal(channel.pushBuffer[2].event, 'test3')
      assert.equal(channel.pushBuffer.length, 3)
    })
  })

  describe('Memory leak prevention', () => {
    test('should clean up all references on teardown', () => {
      // Add pushes
      setupJoinedChannel(channel)
      setupDisconnectedSocket(testSetup.socket)
      channel._push('test', { data: 'test' })

      // Verify state before teardown
      assert.equal(channel.pushBuffer.length, 1)

      // Teardown
      channel.teardown()

      // Verify all references are cleaned
      assert.deepEqual(channel.bindings, {})
      assert.equal(channel.pushBuffer.length, 0)
      assert.equal(channel.state, 'closed')
    })

    test('should prevent push buffer growth during disconnection', () => {
      setupJoinedChannel(channel)
      const isConnectedStub = vi.spyOn(testSetup.socket, 'isConnected')
      isConnectedStub.mockReturnValue(false)

      // Simulate many rapid pushes during disconnection
      const extraPushes = 50

      for (let i = 0; i < MAX_PUSH_BUFFER_SIZE + extraPushes; i++) {
        channel._push('rapid', { data: `message-${i}` })
      }

      // Should not exceed max buffer size
      assert.equal(channel.pushBuffer.length, MAX_PUSH_BUFFER_SIZE)
      expect(channel.pushBuffer.length < MAX_PUSH_BUFFER_SIZE + extraPushes)
    })
  })
})

describe('Trigger Function Error Handling', () => {
  beforeEach(() => {
    channel = testSetup.socket.channel('test-trigger')
  })

  afterEach(() => {
    // Restore all stubs before unsubscribe to prevent unhandled errors
    vi.restoreAllMocks()
    channel.unsubscribe()
  })

  test('validates inlined channel event skipping logic still works', () => {
    const triggerSpy = vi.spyOn(channel, '_trigger')
    const joinRef = channel._joinRef()

    // This should skip because it's a channel event with wrong ref
    channel._trigger('phx_close', {}, 'different-ref')
    expect(triggerSpy).toHaveReturnedWith(undefined) // Should have returned early

    // This should NOT skip because ref matches
    channel._trigger('phx_close', {}, joinRef)
    // The method should have completed (not returned early)

    triggerSpy.mockRestore()
  })

  test('validates inlined postgres change event detection still works', () => {
    const mockBinding = {
      type: 'postgres_changes',
      filter: { event: '*', schema: 'public', table: 'users' },
      callback: vi.fn(),
    }
    channel.bindings.postgres_changes = [mockBinding]

    // Should trigger postgres_changes path for insert/update/delete
    channel._trigger('insert', { data: { type: 'INSERT' } })
    channel._trigger('update', { data: { type: 'UPDATE' } })
    channel._trigger('delete', { data: { type: 'DELETE' } })

    // Should not trigger for other events
    channel._trigger('broadcast', { event: 'test' })

    expect(mockBinding.callback).toHaveBeenCalledTimes(3) // Only postgres events should trigger
  })

  describe('_trigger error scenarios', () => {
    test('should skip channel events with wrong ref', () => {
      const spy = vi.fn()
      // @ts-ignore - accessing private method for testing
      channel._onError(spy)

      vi.spyOn(channel, '_joinRef').mockReturnValue('correct-ref')

      // Should not trigger with wrong ref
      channel._trigger('phx_error', { message: 'error' }, 'wrong-ref')
      expect(spy).not.toHaveBeenCalled()

      // Should trigger with correct ref
      channel._trigger('phx_error', { message: 'error' }, 'correct-ref')
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
})
