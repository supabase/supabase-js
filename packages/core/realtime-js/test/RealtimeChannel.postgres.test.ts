import assert from 'assert'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeChannel from '../src/RealtimeChannel'
import { CHANNEL_STATES } from '../src/lib/constants'
import {
  phxJoinReply,
  setupRealtimeTest,
  TestSetup,
  waitForChannelSubscribed,
} from './helpers/setup'

const defaultTimeout = 1000

let channel: RealtimeChannel
let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest({
    useFakeTimers: true,
    timeout: defaultTimeout,
    socketHandlers: {
      phx_join: () => {},
    },
  })
  channel = testSetup.client.channel('test-postgres-validation')
})

afterEach(() => {
  testSetup.cleanup()
  vi.restoreAllMocks()
  channel.unsubscribe()
})

describe('PostgreSQL subscription validation', () => {
  test('should handle subscription when no postgres bindings exist', async () => {
    // No postgres_changes bindings added

    channel.subscribe()

    testSetup.mockServer.emit('message', phxJoinReply(channel, {}))

    await waitForChannelSubscribed(channel)
  })

  test('should successfully subscribe with matching postgres changes', async () => {
    const callbackSpy1 = vi.fn()
    const callbackSpy2 = vi.fn()

    // Subscribe with multiple postgres_changes bindings
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'users',
        filter: 'id=eq.1',
      },
      callbackSpy1
    )

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'posts',
      },
      callbackSpy2
    )

    // Simulate server response during subscription
    const serverResponse = {
      postgres_changes: [
        {
          event: 'INSERT',
          schema: 'public',
          table: 'users',
          filter: 'id=eq.1',
          id: 'server-id-1',
        },
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
          filter: undefined,
          id: 'server-id-2',
        },
      ],
    }

    channel.subscribe()

    testSetup.mockServer.emit('message', phxJoinReply(channel, serverResponse))

    await waitForChannelSubscribed(channel)
    // Verify channel is subscribed and bindings are enriched with server IDs
    expect(channel.bindings.postgres_changes.length).toBe(2)
    expect(channel.bindings.postgres_changes[0].id).toBe('server-id-1')
    expect(channel.bindings.postgres_changes[1].id).toBe('server-id-2')
  })

  test('should handle subscription errors for mismatched postgres changes', async () => {
    const errorCallbackSpy = vi.fn()

    // Subscribe with postgres_changes binding
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'users',
      },
      vi.fn()
    )

    // Simulate server response with mismatched changes
    const serverResponse = {
      postgres_changes: [
        {
          event: 'UPDATE', // Different event from client binding
          schema: 'public',
          table: 'users',
          id: 'server-id-1',
        },
      ],
    }

    channel.subscribe(errorCallbackSpy)

    testSetup.mockServer.emit('message', phxJoinReply(channel, serverResponse))

    // Should call error callback and set errored state

    expect(errorCallbackSpy).toHaveBeenCalledWith('CHANNEL_ERROR', expect.any(Error))
    expect(channel.state).toBe(CHANNEL_STATES.errored)
  })
})

describe('PostgreSQL binding matching behavior', () => {
  test('should handle null/undefined server changes gracefully', async () => {
    const callbackSpy = vi.fn()

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'users',
      },
      callbackSpy
    )

    channel.subscribe()

    testSetup.mockServer.emit('message', phxJoinReply(channel, {}))

    // Should complete successfully
    await waitForChannelSubscribed(channel)
  })

  test('should match exact postgres changes correctly', async () => {
    const callbackSpy = vi.fn()

    // Subscribe with specific filter
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'users',
        filter: 'id=eq.1',
      },
      callbackSpy
    )

    channel.subscribe()

    // Simulate server response with matching change
    const serverResponse = {
      postgres_changes: [
        {
          event: 'INSERT',
          schema: 'public',
          table: 'users',
          filter: 'id=eq.1',
          id: 'server-id-1',
        },
      ],
    }

    testSetup.mockServer.emit('message', phxJoinReply(channel, serverResponse))

    // Should match and enrich binding
    await waitForChannelSubscribed(channel)
    expect(channel.bindings.postgres_changes[0].id).toBe('server-id-1')
  })

  test('should match postgres changes when filter is undefined', async () => {
    const callbackSpy = vi.fn()

    // Subscribe without specific filter
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'users',
      },
      callbackSpy
    )

    channel.subscribe()

    // Simulate server response with matching change (no filter)
    const serverResponse = {
      postgres_changes: [
        {
          event: 'INSERT',
          schema: 'public',
          table: 'users',
          filter: undefined,
          id: 'server-id-1',
        },
      ],
    }

    testSetup.mockServer.emit('message', phxJoinReply(channel, serverResponse))

    // Should match successfully
    await waitForChannelSubscribed(channel)
    expect(channel.bindings.postgres_changes[0].id).toBe('server-id-1')
  })

  test('should match postgres changes when server returns null for optional fields', async () => {
    const callbackSpy = vi.fn()

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      },
      callbackSpy
    )

    channel.subscribe()

    const serverResponse = {
      postgres_changes: [
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: null,
          id: 'server-id-1',
        },
      ],
    }

    testSetup.mockServer.emit('message', phxJoinReply(channel, serverResponse))

    // Should match successfully
    await waitForChannelSubscribed(channel)
    expect(channel.bindings.postgres_changes[0].id).toBe('server-id-1')
  })

  test('should match postgres changes when server omits optional filter field', async () => {
    const callbackSpy = vi.fn()

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
      },
      callbackSpy
    )

    channel.subscribe()

    const serverResponse = {
      postgres_changes: [
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          id: 'server-id-1',
        },
      ],
    }

    testSetup.mockServer.emit('message', phxJoinReply(channel, serverResponse))

    await waitForChannelSubscribed(channel)
    expect(channel.bindings.postgres_changes[0].id).toBe('server-id-1')
  })

  test.each([
    {
      description: 'should fail when event differs',
      clientFilter: { event: 'INSERT', schema: 'public', table: 'users' },
      serverChange: {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        id: 'server-id',
      },
    },
    {
      description: 'should fail when schema differs',
      clientFilter: { event: 'INSERT', schema: 'public', table: 'users' },
      serverChange: {
        event: 'INSERT',
        schema: 'private',
        table: 'users',
        id: 'server-id',
      },
    },
    {
      description: 'should fail when table differs',
      clientFilter: { event: 'INSERT', schema: 'public', table: 'users' },
      serverChange: {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
        id: 'server-id',
      },
    },
    {
      description: 'should fail when filter differs',
      clientFilter: {
        event: 'INSERT',
        schema: 'public',
        table: 'users',
        filter: 'id=eq.1',
      },
      serverChange: {
        event: 'INSERT',
        schema: 'public',
        table: 'users',
        filter: 'id=eq.2',
        id: 'server-id',
      },
    },
  ])('$description', async ({ clientFilter, serverChange }) => {
    const errorCallbackSpy = vi.fn()

    // @ts-ignore simplified callback
    channel.on('postgres_changes', clientFilter, vi.fn())
    channel.subscribe(errorCallbackSpy)

    // Should call error callback when server change doesn't match client binding
    const serverResponse = { postgres_changes: [serverChange] }

    testSetup.mockServer.emit('message', phxJoinReply(channel, serverResponse))

    // Should trigger error callback and set errored state
    expect(errorCallbackSpy).toHaveBeenCalledWith('CHANNEL_ERROR', expect.any(Error))
    expect(channel.state).toBe(CHANNEL_STATES.errored)
  })
})

describe('Subscription error handling', () => {
  test('should handle subscription errors through public API', () => {
    const errorCallbackSpy = vi.fn()

    // Subscribe with error callback
    channel.subscribe(errorCallbackSpy)

    testSetup.mockServer.emit('message', phxJoinReply(channel, 'test subscription error', 'error'))

    // Should trigger error callback and set error state
    expect(errorCallbackSpy).toHaveBeenCalledWith('CHANNEL_ERROR', expect.any(Error))
    expect(channel.state).toBe(CHANNEL_STATES.errored)
  })

  test('should handle subscription errors without callback gracefully', () => {
    // Subscribe without error callback
    channel.subscribe()

    // Simulate subscription error
    const testError = new Error('test subscription error')

    // Should not throw when no error callback provided
    assert.doesNotThrow(() => {
      // @ts-ignore calling private method
      channel.joinPush.matchReceive({ status: 'error', response: testError })
    })

    expect(channel.state).toBe(CHANNEL_STATES.errored)
  })
})

describe('Postgres Changes Trigger Tests', () => {
  beforeEach(() => {
    channel = testSetup.client.channel('test-postgres-trigger')
  })

  afterEach(() => {
    channel.unsubscribe()
  })

  test('triggers when type is postgres_changes', () => {
    const spy = vi.fn()

    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'test' }, spy)
    channel.bindings.postgres_changes[0].id = 'abc123'

    channel.channelAdapter.getChannel().trigger(
      'postgres_changes',
      {
        ids: ['abc123'],
        data: {
          type: 'INSERT',
          table: 'test',
          record: { id: 1 },
          schema: 'public',
          columns: [{ name: 'id', type: 'int4' }],
          commit_timestamp: '2000-01-01T00:01:01Z',
          errors: [],
        },
      },
      '1'
    )

    expect(spy).toHaveBeenCalledWith(
      {
        schema: 'public',
        table: 'test',
        commit_timestamp: '2000-01-01T00:01:01Z',
        eventType: 'INSERT',
        new: { id: 1 },
        old: {},
        errors: [],
      },
      '1',
      undefined // joinRef is undefined
    )
  })

  test('should trigger postgres_changes callback when ID matches', () => {
    const callbackSpy = vi.fn()

    // Add binding with specific ID (simulating server-assigned ID)
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'test' },
      callbackSpy
    )
    channel.bindings.postgres_changes[0].id = 'abc123'

    // Trigger with matching ID
    channel.channelAdapter.getChannel().trigger(
      'postgres_changes',
      {
        ids: ['abc123'],
        data: {
          type: 'INSERT',
          table: 'test',
          record: { id: 1 },
          schema: 'public',
          columns: [{ name: 'id', type: 'int4' }],
          commit_timestamp: '2000-01-01T00:01:01Z',
          errors: [],
        },
      },
      '1'
    )

    // Should trigger callback
    expect(callbackSpy).toHaveBeenCalledTimes(1)
  })

  test('should not trigger postgres_changes callback when ID does not match', () => {
    const callbackSpy = vi.fn()

    // Add binding with specific ID (simulating server-assigned ID)
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'test' },
      callbackSpy
    )
    channel.bindings.postgres_changes[0].id = 'abc123'

    // Trigger with different ID
    channel.channelAdapter.getChannel().trigger(
      'postgres_changes',
      {
        ids: ['different-id'],
        data: {
          type: 'INSERT',
          table: 'test',
          record: { id: 1 },
          schema: 'public',
          columns: [{ name: 'id', type: 'int4' }],
          commit_timestamp: '2000-01-01T00:01:01Z',
          errors: [],
        },
      },
      '1'
    )

    // Should not trigger callback
    expect(callbackSpy).toHaveBeenCalledTimes(0)
  })
})

describe('Generic event type overload', () => {
  test('should accept generic event type parameter without type errors', () => {
    const event: '*' | 'INSERT' | 'UPDATE' | 'DELETE' = 'INSERT'

    channel.on(
      'postgres_changes',
      {
        event,
        schema: 'public',
        table: 'users',
      },
      () => {}
    )

    expect(channel.bindings.postgres_changes.length).toBe(1)
    expect(channel.bindings.postgres_changes[0].filter.event).toBe('INSERT')
  })
})

describe('PostgreSQL payload transformation', () => {
  test('should transform postgres_changes payload when triggered', () => {
    const callbackSpy = vi.fn()

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'users' },
      callbackSpy
    )
    channel.bindings.postgres_changes[0].id = 'abc123'

    // Trigger with postgres_changes payload
    channel.channelAdapter.getChannel().trigger(
      'postgres_changes',
      {
        ids: ['abc123'],
        data: {
          type: 'INSERT',
          schema: 'public',
          table: 'users',
          commit_timestamp: '2023-01-01T00:00:00Z',
          errors: [],
          columns: [{ name: 'id', type: 'int4' }],
          record: { id: 1, name: 'test' },
        },
      },
      '1'
    )

    // Verify callback received transformed payload
    expect(callbackSpy).toHaveBeenCalledTimes(1)
    const transformedPayload = callbackSpy.mock.calls[0][0]

    expect(transformedPayload.schema).toBe('public')
    expect(transformedPayload.table).toBe('users')
    expect(transformedPayload.eventType).toBe('INSERT')
    expect(transformedPayload.commit_timestamp).toBe('2023-01-01T00:00:00Z')
    expect(transformedPayload.new).toStrictEqual({ id: 1, name: 'test' })
    expect(transformedPayload.errors).toStrictEqual([])
  })

  test('should pass through non-postgres payloads unchanged', () => {
    const callbackSpy = vi.fn()

    // @ts-ignore type of event not supported
    channel.on('test_event', {}, callbackSpy)

    // Trigger with regular payload
    const originalPayload = { event: 'test', data: 'simple' }
    channel.channelAdapter.getChannel().trigger('test_event', originalPayload, '2', '1')

    // Verify callback received original payload unchanged
    expect(callbackSpy).toHaveBeenCalledWith(originalPayload, '2', '1')
  })

  test('should transform UPDATE/DELETE postgres changes with old_record data', () => {
    const callbackSpy = vi.fn()

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, callbackSpy)

    // Test UPDATE event with old_record
    channel.channelAdapter.getChannel().trigger(
      'postgres_changes',
      {
        ids: ['update123'],
        data: {
          type: 'UPDATE',
          schema: 'public',
          table: 'users',
          commit_timestamp: '2023-01-01T00:00:00Z',
          errors: [],
          columns: [
            { name: 'id', type: 'int4' },
            { name: 'name', type: 'text' },
          ],
          record: { id: 1, name: 'updated' },
          old_record: { id: 1, name: 'original' },
        },
      },
      '1'
    )

    // Verify callback received transformed payload with old data
    expect(callbackSpy).toHaveBeenCalledTimes(1)
    const updatePayload = callbackSpy.mock.calls[0][0]

    expect(updatePayload.eventType).toBe('UPDATE')
    expect(updatePayload.new).toStrictEqual({ id: 1, name: 'updated' })
    expect(updatePayload.old).toStrictEqual({ id: 1, name: 'original' })

    // Test DELETE event with old_record
    callbackSpy.mockClear()
    channel.channelAdapter.getChannel().trigger(
      'postgres_changes',
      {
        ids: ['delete123'],
        data: {
          type: 'DELETE',
          schema: 'public',
          table: 'users',
          commit_timestamp: '2023-01-01T00:00:00Z',
          errors: [],
          columns: [
            { name: 'id', type: 'int4' },
            { name: 'name', type: 'text' },
          ],
          old_record: { id: 2, name: 'deleted' },
        },
      },
      '1'
    )

    // Verify callback received transformed payload with old data
    expect(callbackSpy).toHaveBeenCalledTimes(1)
    const deletePayload = callbackSpy.mock.calls[0][0]

    expect(deletePayload.eventType).toBe('DELETE')
    expect(deletePayload.old).toStrictEqual({ id: 2, name: 'deleted' })
  })
})
