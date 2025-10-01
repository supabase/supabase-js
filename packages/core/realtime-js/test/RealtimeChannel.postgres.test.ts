import assert from 'assert'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeChannel from '../src/RealtimeChannel'
import { CHANNEL_STATES } from '../src/lib/constants'
import { setupRealtimeTest, cleanupRealtimeTest, TestSetup } from './helpers/setup'

const defaultTimeout = 1000

let channel: RealtimeChannel
let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest({
    useFakeTimers: true,
    timeout: defaultTimeout,
  })
  channel = testSetup.socket.channel('test-postgres-validation')
})

afterEach(() => {
  cleanupRealtimeTest(testSetup)
  vi.restoreAllMocks()
  channel.unsubscribe()
})

describe('PostgreSQL subscription validation', () => {
  test('should handle subscription when no postgres bindings exist', () => {
    // No postgres_changes bindings added

    channel.subscribe()

    // Simulate server response with no postgres changes
    const mockServerResponse = {}
    channel.joinPush._matchReceive({
      status: 'ok',
      response: mockServerResponse,
    })

    // Should successfully subscribe even without postgres bindings
    assert.equal(channel.state, CHANNEL_STATES.joined)
  })

  test('should successfully subscribe with matching postgres changes', () => {
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
    const mockServerResponse = {
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

    // Simulate successful subscription response with server IDs
    channel.joinPush._matchReceive({
      status: 'ok',
      response: mockServerResponse,
    })

    // Verify channel is subscribed and bindings are enriched with server IDs
    assert.equal(channel.state, CHANNEL_STATES.joined)
    assert.equal(channel.bindings.postgres_changes.length, 2)
    assert.equal(channel.bindings.postgres_changes[0].id, 'server-id-1')
    assert.equal(channel.bindings.postgres_changes[1].id, 'server-id-2')
  })

  test('should handle subscription errors for mismatched postgres changes', () => {
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
    const mockServerResponse = {
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

    // Simulate subscription response that should cause error due to mismatch
    channel.joinPush._matchReceive({
      status: 'ok',
      response: mockServerResponse,
    })

    // Should call error callback and set errored state
    expect(errorCallbackSpy).toHaveBeenCalledWith('CHANNEL_ERROR', expect.any(Error))
    assert.equal(channel.state, CHANNEL_STATES.errored)
  })
})

describe('PostgreSQL binding matching behavior', () => {
  test('should handle null/undefined server changes gracefully', () => {
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

    // Simulate server response with no postgres_changes
    const mockServerResponse = {}
    channel.joinPush._matchReceive({
      status: 'ok',
      response: mockServerResponse,
    })

    // Should complete successfully
    assert.equal(channel.state, CHANNEL_STATES.joined)
  })

  test('should match exact postgres changes correctly', () => {
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
    const mockServerResponse = {
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

    channel.joinPush._matchReceive({
      status: 'ok',
      response: mockServerResponse,
    })

    // Should match and enrich binding
    assert.equal(channel.state, CHANNEL_STATES.joined)
    assert.equal(channel.bindings.postgres_changes[0].id, 'server-id-1')
  })

  test('should match postgres changes when filter is undefined', () => {
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
    const mockServerResponse = {
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

    channel.joinPush._matchReceive({
      status: 'ok',
      response: mockServerResponse,
    })

    // Should match successfully
    assert.equal(channel.state, CHANNEL_STATES.joined)
    assert.equal(channel.bindings.postgres_changes[0].id, 'server-id-1')
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
  ])('$description', ({ clientFilter, serverChange }) => {
    const errorCallbackSpy = vi.fn()

    channel.on('postgres_changes', clientFilter, vi.fn())
    channel.subscribe(errorCallbackSpy)

    // Should call error callback when server change doesn't match client binding
    const mockServerResponse = { postgres_changes: [serverChange] }
    channel.joinPush._matchReceive({
      status: 'ok',
      response: mockServerResponse,
    })

    // Should trigger error callback and set errored state
    expect(errorCallbackSpy).toHaveBeenCalledWith('CHANNEL_ERROR', expect.any(Error))
    assert.equal(channel.state, CHANNEL_STATES.errored)
  })
})

describe('Subscription error handling', () => {
  test('should handle subscription errors through public API', () => {
    const errorCallbackSpy = vi.fn()

    // Subscribe with error callback
    channel.subscribe(errorCallbackSpy)

    // Simulate subscription error through joinPush
    channel.joinPush._matchReceive({
      status: 'error',
      response: 'test subscription error',
    })

    // Should trigger error callback and set error state
    expect(errorCallbackSpy).toHaveBeenCalledWith('CHANNEL_ERROR', expect.any(Error))
    assert.equal(channel.state, CHANNEL_STATES.errored)
  })

  test('should handle subscription errors without callback gracefully', () => {
    // Subscribe without error callback
    channel.subscribe()

    // Simulate subscription error
    const testError = new Error('test subscription error')

    // Should not throw when no error callback provided
    assert.doesNotThrow(() => {
      channel.joinPush._matchReceive({ status: 'error', response: testError })
    })

    assert.equal(channel.state, CHANNEL_STATES.errored)
  })
})

describe('Postgres Changes Trigger Tests', () => {
  beforeEach(() => {
    channel = testSetup.socket.channel('test-postgres-trigger')
  })

  afterEach(() => {
    channel.unsubscribe()
  })

  test('triggers when type is postgres_changes', () => {
    const spy = vi.fn()

    channel.bindings.postgres_changes = [
      {
        id: 'abc123',
        type: 'postgres_changes',
        filter: { event: 'INSERT', schema: 'public', table: 'test' },
        callback: spy,
      },
    ]

    channel._trigger(
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
      '1'
    )
  })

  test('triggers when type is insert, update, delete', () => {
    const spy = vi.fn()

    channel.bindings.postgres_changes = [
      {
        type: 'postgres_changes',
        filter: { event: 'INSERT' },
        callback: spy,
      },
      {
        type: 'postgres_changes',
        filter: { event: 'UPDATE' },
        callback: spy,
      },
      {
        type: 'postgres_changes',
        filter: { event: 'DELETE' },
        callback: spy,
      },
      { type: 'postgres_changes', filter: { event: '*' }, callback: spy },
    ]

    channel._trigger('insert', { test: '123' }, '1')
    channel._trigger('update', { test: '123' }, '2')
    channel._trigger('delete', { test: '123' }, '3')

    expect(spy).toHaveBeenCalledTimes(6)
  })

  test('should trigger postgres_changes callback when ID matches', () => {
    const callbackSpy = vi.fn()

    // Add binding with specific ID (simulating server-assigned ID)
    channel.bindings.postgres_changes = [
      {
        id: 'abc123',
        type: 'postgres_changes',
        filter: { event: 'INSERT', schema: 'public', table: 'test' },
        callback: callbackSpy,
      },
    ]

    // Trigger with matching ID
    channel._trigger(
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

    // Add binding with specific ID
    channel.bindings.postgres_changes = [
      {
        id: 'abc123',
        type: 'postgres_changes',
        filter: { event: 'INSERT', schema: 'public', table: 'test' },
        callback: callbackSpy,
      },
    ]

    // Trigger with different ID
    channel._trigger(
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

describe('PostgreSQL payload transformation', () => {
  test('should transform postgres_changes payload when triggered', () => {
    const callbackSpy = vi.fn()

    // Add postgres_changes binding
    channel.bindings.postgres_changes = [
      {
        id: 'abc123',
        type: 'postgres_changes',
        filter: { event: 'INSERT', schema: 'public', table: 'users' },
        callback: callbackSpy,
      },
    ]

    // Trigger with postgres_changes payload
    channel._trigger(
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

    assert.equal(transformedPayload.schema, 'public')
    assert.equal(transformedPayload.table, 'users')
    assert.equal(transformedPayload.eventType, 'INSERT')
    assert.equal(transformedPayload.commit_timestamp, '2023-01-01T00:00:00Z')
    assert.deepEqual(transformedPayload.new, { id: 1, name: 'test' })
    assert.deepEqual(transformedPayload.errors, [])
  })

  test('should pass through non-postgres payloads unchanged', () => {
    const callbackSpy = vi.fn()

    // Add regular binding using the internal structure
    channel.bindings.test_event = [
      {
        type: 'test_event',
        filter: {},
        callback: callbackSpy,
      },
    ]

    // Trigger with regular payload
    const originalPayload = { event: 'test', data: 'simple' }
    channel._trigger('test_event', originalPayload, '1')

    // Verify callback received original payload unchanged
    expect(callbackSpy).toHaveBeenCalledWith(originalPayload, '1')
  })

  test('should transform UPDATE/DELETE postgres changes with old_record data', () => {
    const callbackSpy = vi.fn()

    // Add postgres_changes binding
    channel.bindings.postgres_changes = [
      {
        type: 'postgres_changes',
        filter: { event: '*', schema: 'public', table: 'users' },
        callback: callbackSpy,
      },
    ]

    // Test UPDATE event with old_record
    channel._trigger(
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

    assert.equal(updatePayload.eventType, 'UPDATE')
    assert.deepEqual(updatePayload.new, { id: 1, name: 'updated' })
    assert.deepEqual(updatePayload.old, { id: 1, name: 'original' }) // This tests lines 873-877

    // Test DELETE event with old_record
    callbackSpy.mockClear()
    channel._trigger(
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

    assert.equal(deletePayload.eventType, 'DELETE')
    assert.deepEqual(deletePayload.old, { id: 2, name: 'deleted' }) // This tests lines 873-877
  })
})
