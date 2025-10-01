import assert from 'assert'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeClient from '../src/RealtimeClient'
import RealtimeChannel from '../src/RealtimeChannel'
import { setupRealtimeTest, cleanupRealtimeTest, TestSetup } from './helpers/setup'

const defaultRef = '1'
const defaultTimeout = 1000

let channel: RealtimeChannel
let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest({
    useFakeTimers: true,
    timeout: defaultTimeout,
  })

  vi.spyOn(testSetup.socket, 'isConnected').mockImplementation(() => true)
  vi.spyOn(testSetup.socket, 'push').mockImplementation(() => true)

  channel = testSetup.socket.channel('topic')

  joinPush = channel.joinPush

  channel.subscribe()
})

afterEach(() => {
  cleanupRealtimeTest(testSetup)
  channel.unsubscribe()
})

let joinPush: any

describe('onMessage', () => {
  beforeEach(() => {
    channel = testSetup.socket.channel('topic')
  })

  afterEach(() => {
    testSetup.socket.disconnect()
    channel.unsubscribe()
  })

  test('returns payload by default', () => {
    vi.spyOn(testSetup.socket, '_makeRef').mockImplementation(() => defaultRef)
    const payload = channel._onMessage('event', { one: 'two' }, defaultRef)

    assert.deepEqual(payload, { one: 'two' })
  })
})

describe('on', () => {
  beforeEach(() => {
    vi.spyOn(testSetup.socket, '_makeRef').mockImplementation(() => defaultRef)
    channel = testSetup.socket.channel('topic')
    vi.useRealTimers()
  })

  afterEach(() => {
    testSetup.socket.disconnect()
    channel.unsubscribe()
    testSetup.clock = vi.useFakeTimers()
  })

  test('sets up callback for broadcast', () => {
    const spy = vi.fn()

    channel._trigger('broadcast', '*', defaultRef)
    expect(spy).not.toHaveBeenCalled()
    channel.on('broadcast', { event: '*' }, spy)

    channel._trigger('broadcast', { event: '*' }, defaultRef)

    expect(spy).toHaveBeenCalled()
  })

  test('other event callbacks are ignored', () => {
    const spy = vi.fn()
    const ignoredSpy = vi.fn()

    channel._trigger('broadcast', { event: 'test' }, defaultRef)

    expect(ignoredSpy).not.toHaveBeenCalled()
    channel.on('broadcast', { event: 'test' }, spy)
    channel.on('broadcast', { event: 'ignore' }, ignoredSpy)

    channel._trigger('broadcast', { event: 'test' }, defaultRef)

    expect(ignoredSpy).not.toHaveBeenCalled()
  })

  test('"*" bind all events', () => {
    const spy = vi.fn()

    channel._trigger('realtime', { event: 'INSERT' }, defaultRef)
    expect(spy).not.toHaveBeenCalled()

    channel.on('broadcast', { event: 'INSERT' }, spy)
    channel._trigger('broadcast', { event: 'INSERT' }, defaultRef)
    expect(spy).toHaveBeenCalled()
  })

  test('when we bind a new callback on an already joined channel we resubscribe with new join payload', async () => {
    channel.on('broadcast', { event: 'test' }, vi.fn())
    channel.subscribe()
    channel.joinPush.trigger('ok', {})
    assert.deepEqual(channel.joinPush.payload, {
      config: {
        broadcast: {
          ack: false,
          self: false,
        },
        postgres_changes: [],
        presence: {
          enabled: false,
          key: '',
        },
        private: false,
      },
    })

    channel.on('presence', { event: 'join' }, vi.fn())

    await new Promise((resolve) => setTimeout(resolve, 100))

    assert.deepEqual(channel.joinPush.payload, {
      config: {
        broadcast: {
          ack: false,
          self: false,
        },
        postgres_changes: [],
        presence: {
          enabled: true,
          key: '',
        },
        private: false,
      },
    })
  })

  describe('off', () => {
    beforeEach(() => {
      vi.spyOn(testSetup.socket, '_makeRef').mockImplementation(() => defaultRef)
      channel = testSetup.socket.channel('topic')
    })

    afterEach(() => {
      channel.unsubscribe()
    })

    test('removes all callbacks for event', () => {
      const spy1 = vi.fn()
      const spy2 = vi.fn()
      const spy3 = vi.fn()

      channel.on('broadcast', { event: 'test1' }, spy1)
      channel.on('broadcast', { event: 'test2' }, spy2)
      channel.on('broadcast', { event: 'test3' }, spy3)

      channel._off('broadcast', { event: 'test1' })

      channel._trigger('broadcast', { event: 'test1' }, defaultRef)
      channel._trigger('broadcast', { event: 'test2' }, defaultRef)
      channel._trigger('broadcast', { event: 'test3' }, defaultRef)

      expect(spy1).not.toHaveBeenCalled()
      expect(spy2).toHaveBeenCalled()
      expect(spy3).toHaveBeenCalled()
    })
  })

  describe('trigger', () => {
    let spy: any

    beforeEach(() => {
      channel = testSetup.socket.channel('topic')
    })

    test('triggers when type is insert, update, delete', () => {
      spy = vi.fn()

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

    test('triggers when type is broadcast', () => {
      spy = vi.fn()

      channel.bindings.broadcast = [
        { type: 'broadcast', filter: { event: '*' }, callback: spy },
        { type: 'broadcast', filter: { event: 'test' }, callback: spy },
      ]

      channel._trigger('broadcast', { event: 'test', id: '123' }, '1')

      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenCalledWith({ event: 'test', id: '123' }, '1')
    })

    test('triggers when type is presence', () => {
      spy = vi.fn()

      channel.bindings.presence = [
        { type: 'presence', filter: { event: 'sync' }, callback: spy },
        { type: 'presence', filter: { event: 'join' }, callback: spy },
        { type: 'presence', filter: { event: 'leave' }, callback: spy },
      ]

      channel._trigger('presence', { event: 'sync' }, '1')
      channel._trigger('presence', { event: 'join' }, '2')
      channel._trigger('presence', { event: 'leave' }, '3')

      expect(spy).toHaveBeenCalledTimes(3)
    })

    test('triggers when type is postgres_changes', () => {
      spy = vi.fn()

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
  })
})

describe('send', () => {
  describe('WebSocket connection scenarios', () => {
    beforeEach(() => {
      testSetup.socket.connect()
      vi.spyOn(testSetup.socket.conn!, 'readyState', 'get').mockReturnValue(1)
    })

    test('sends message via ws conn when subscribed to channel', () => {
      const new_channel = testSetup.socket.channel('topic', {
        config: { private: true },
      })
      const pushStub = vi.spyOn(new_channel, '_push')

      // Set up channel as successfully subscribed by directly setting state
      new_channel.subscribe()
      new_channel.state = 'joined' // Mock joined state

      // Now test send functionality
      new_channel.send({ type: 'broadcast', event: 'test' })

      expect(pushStub).toHaveBeenCalledTimes(1)
      expect(pushStub).toHaveBeenCalledWith('broadcast', { type: 'broadcast', event: 'test' }, 1000)
    })

    test('cannot send via ws conn when subscription times out', () => {
      const new_channel = testSetup.socket.channel('topic', {
        config: { private: true },
      })
      const pushStub = vi.spyOn(new_channel, '_push')

      // Set up channel as not subscribed (closed state)
      new_channel.subscribe()
      new_channel.state = 'closed' // Mock failed/timeout state

      // Try to send - should fallback to HTTP or fail
      new_channel.send({ type: 'broadcast', event: 'test' })

      // Should not use _push for WebSocket when not connected/joined
      expect(pushStub).toHaveBeenCalledTimes(0)
    })
  })

  describe('HTTP fallback scenarios', () => {
    test.each([
      {
        description: 'without access token',
        accessToken: undefined,
        expectedAuth: '',
      },
      {
        description: 'with access token',
        accessToken: () => Promise.resolve('access_token_123'),
        expectedAuth: 'Bearer access_token_123',
      },
    ])(
      'sends message via HTTP when not subscribed ($description)',
      async ({ accessToken, expectedAuth }) => {
        const fetchStub = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          body: { cancel: vi.fn() },
        })

        const socket = new RealtimeClient(testSetup.url, {
          fetch: fetchStub as unknown as typeof fetch,
          timeout: defaultTimeout,
          params: { apikey: 'abc123' },
          ...(accessToken && { accessToken }),
        })

        if (accessToken) {
          await socket.setAuth()
        } else {
          socket.setAuth()
        }

        const channel = socket.channel('topic', {
          config: { private: true },
        })

        const expectedBody = {
          method: 'POST',
          headers: {
            Authorization: expectedAuth,
            apikey: 'abc123',
            'Content-Type': 'application/json',
          },
          body: '{"messages":[{"topic":"topic","event":"test","private":true}]}',
          signal: new AbortController().signal,
        }

        const expectedUrl = testSetup.url
          .replace('/socket', '')
          .replace('wss', 'https')
          .concat('/api/broadcast')

        const res = await channel.send({
          type: 'broadcast',
          event: 'test',
        })

        assert.equal(res, 'ok')
        expect(fetchStub).toHaveBeenCalledTimes(1)
        expect(fetchStub).toHaveBeenCalledWith(expectedUrl, expectedBody)
      }
    )
  })

  describe('Error handling scenarios', () => {
    test('handles HTTP request AbortError', async () => {
      const fetchStub = vi.fn().mockRejectedValue(new Error('AbortError'))
      fetchStub.mockRejectedValue(
        Object.assign(new Error('Request aborted'), { name: 'AbortError' })
      )

      const socket = new RealtimeClient(testSetup.url, {
        fetch: fetchStub as unknown as typeof fetch,
        params: { apikey: 'abc123' },
      })
      const channel = socket.channel('topic')

      const result = await channel.send({
        type: 'broadcast',
        event: 'test',
      })

      expect(result).toBe('timed out')
    })

    test('handles HTTP request general error', async () => {
      const fetchStub = vi.fn().mockRejectedValue(new Error('Network error'))

      const socket = new RealtimeClient(testSetup.url, {
        fetch: fetchStub as unknown as typeof fetch,
        params: { apikey: 'abc123' },
      })
      const channel = socket.channel('topic')

      const result = await channel.send({
        type: 'broadcast',
        event: 'test',
      })

      expect(result).toBe('error')
    })

    test('handles HTTP response not ok', async () => {
      const fetchStub = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        body: { cancel: vi.fn() },
      })

      const socket = new RealtimeClient(testSetup.url, {
        fetch: fetchStub as unknown as typeof fetch,
        params: { apikey: 'abc123' },
      })
      const channel = socket.channel('topic')

      const result = await channel.send({
        type: 'broadcast',
        event: 'test',
      })

      expect(result).toBe('error')
    })

    test('handles fetch timeout scenarios', async () => {
      // Test different timeout-related error scenarios
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'AbortError'

      const fetchStub = vi.fn().mockRejectedValue(timeoutError)

      const socket = new RealtimeClient(testSetup.url, {
        fetch: fetchStub as unknown as typeof fetch,
        params: { apikey: 'abc123' },
      })
      const channel = socket.channel('topic')

      const result = await channel.send({
        type: 'broadcast',
        event: 'test',
      })

      expect(result).toBe('timed out')
      expect(fetchStub).toHaveBeenCalled()
    })
  })
})
