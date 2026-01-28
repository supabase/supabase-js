import assert from 'assert'
import { describe, test, beforeEach, afterEach, vi, expect } from 'vitest'
import type RealtimeChannel from '../src/RealtimeChannel'
import { DEFAULT_API_KEY, setupRealtimeTest, type TestSetup } from './helpers/setup'
import { VSN_2_0_0 } from '../src/lib/constants'
let testSetup: TestSetup

describe('on', () => {
  let channel: RealtimeChannel

  beforeEach(() => {
    testSetup = setupRealtimeTest()
    channel = testSetup.client.channel('some-channel')
  })

  afterEach(() => {
    channel.unsubscribe()
    testSetup.cleanup()
  })

  describe('Broadcast event filtering', () => {
    test('sets up callback for broadcast', () => {
      const spy = vi.fn()

      channel.channelAdapter.getChannel().trigger('broadcast', '*')
      expect(spy).not.toHaveBeenCalled()
      channel.on('broadcast', { event: '*' }, spy)

      channel.channelAdapter.getChannel().trigger('broadcast', '*')

      expect(spy).toHaveBeenCalled()
    })

    test('should filter broadcast events by exact event name', () => {
      let testEventCount = 0
      let otherEventCount = 0
      let wildcardEventCount = 0

      channel.on('broadcast', { event: 'test-event' }, () => {
        testEventCount++
      })

      channel.on('broadcast', { event: 'other-event' }, () => {
        otherEventCount++
      })

      channel.on('broadcast', { event: '*' }, () => {
        wildcardEventCount++
      })

      // Trigger exact match
      channel.channelAdapter.getChannel().trigger('broadcast', {
        type: 'broadcast',
        event: 'test-event',
        payload: { data: 'test' },
      })

      // Trigger non-match
      channel.channelAdapter.getChannel().trigger('broadcast', {
        type: 'broadcast',
        event: 'other-event',
        payload: { data: 'test' },
      })

      assert.equal(testEventCount, 1)
      assert.equal(otherEventCount, 1)
      assert.equal(wildcardEventCount, 2)
    })

    test('should handle wildcard broadcast events', () => {
      let wildcardEventCount = 0

      channel.on('broadcast', { event: '*' }, () => {
        wildcardEventCount++
      })

      // Trigger various broadcast events
      channel.channelAdapter.getChannel().trigger('broadcast', {
        type: 'broadcast',
        event: 'event-1',
        payload: { data: 'test' },
      })

      channel.channelAdapter.getChannel().trigger('broadcast', {
        type: 'broadcast',
        event: 'event-2',
        payload: { data: 'test' },
      })

      assert.equal(wildcardEventCount, 2)
    })

    test('should handle multiple listeners for same event', () => {
      let listener1Count = 0
      let listener2Count = 0

      channel.on('broadcast', { event: 'shared-event' }, () => {
        listener1Count++
      })

      channel.on('broadcast', { event: 'shared-event' }, () => {
        listener2Count++
      })

      channel.channelAdapter.getChannel().trigger('broadcast', {
        type: 'broadcast',
        event: 'shared-event',
        payload: { data: 'test' },
      })

      assert.equal(listener1Count, 1)
      assert.equal(listener2Count, 1)
    })

    test('other event callbacks are ignored', () => {
      const spy = vi.fn()
      const ignoredSpy = vi.fn()

      channel.channelAdapter.getChannel().trigger('broadcast', { event: 'test' })

      expect(ignoredSpy).not.toHaveBeenCalled()
      channel.on('broadcast', { event: 'test' }, spy)
      channel.on('broadcast', { event: 'ignore' }, ignoredSpy)

      channel.channelAdapter.getChannel().trigger('broadcast', { event: 'test' })

      expect(ignoredSpy).not.toHaveBeenCalled()
    })
  })

  describe('System event filtering', () => {
    test('should handle system events', () => {
      let systemEventCount = 0

      channel.on('system', {}, (payload) => {
        systemEventCount++
        expect(payload)
      })

      channel.channelAdapter.getChannel().trigger('system', {
        type: 'system',
        event: 'status',
        payload: { status: 'connected' },
      })

      assert.equal(systemEventCount, 1)
    })
  })
})

describe('trigger', () => {
  let channel: RealtimeChannel

  beforeEach(() => {
    testSetup = setupRealtimeTest()
    channel = testSetup.client.channel('some-channel')
  })

  afterEach(() => {
    channel.unsubscribe()
    testSetup.cleanup()
  })

  test('triggers when type is broadcast', () => {
    const spy = vi.fn()

    channel.on('broadcast', { event: '*' }, spy)
    channel.on('broadcast', { event: 'test' }, spy)

    channel.channelAdapter.getChannel().trigger('broadcast', { event: 'test', id: '123' }, '1')

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenCalledWith({ event: 'test', id: '123' }, '1', undefined)
  })

  test('triggers when type is presence', () => {
    const spy = vi.fn()

    channel.on('presence', { event: 'sync' }, spy)
    channel.on('presence', { event: 'join' }, spy)
    channel.on('presence', { event: 'leave' }, spy)

    channel.channelAdapter.getChannel().trigger('presence', { event: 'sync' }, '1')
    channel.channelAdapter.getChannel().trigger('presence', { event: 'join' }, '2')
    channel.channelAdapter.getChannel().trigger('presence', { event: 'leave' }, '3')

    expect(spy).toHaveBeenCalledTimes(3)
  })
})

describe('send', () => {
  describe('WebSocket connection scenarios', () => {
    beforeEach(async () => {
      testSetup = setupRealtimeTest()
      testSetup.connect()
      await vi.waitFor(() => expect(testSetup.emitters.connected).toHaveBeenCalled())
    })

    afterEach(() => {
      testSetup.cleanup()
    })

    test('sends message via ws conn when subscribed to channel', () => {
      const new_channel = testSetup.client.channel('topic', {
        config: { private: true },
      })
      const pushStub = vi.spyOn(new_channel.channelAdapter.getChannel(), 'push')

      // Set up channel as successfully subscribed by directly setting state
      new_channel.subscribe()
      new_channel.state = 'joined' // Mock joined state

      // Now test send functionality
      new_channel.send({ type: 'broadcast', event: 'test' })

      expect(pushStub).toHaveBeenCalledTimes(1)
      expect(pushStub).toHaveBeenCalledWith(
        'broadcast',
        { type: 'broadcast', event: 'test' },
        10000
      )
    })

    test('cannot send via ws conn when subscription times out', () => {
      const new_channel = testSetup.client.channel('topic', {
        config: { private: true },
      })
      const pushStub = vi.spyOn(new_channel.channelAdapter.getChannel(), 'push')

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
        expectedAuth: undefined,
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

        testSetup = setupRealtimeTest({
          fetch: fetchStub as unknown as typeof fetch,
          ...(accessToken && { accessToken }),
        })

        await testSetup.client.setAuth()

        const channel = testSetup.client.channel('topic', {
          config: { private: true },
        })

        const expectedHeaders: Record<string, string> = {
          apikey: DEFAULT_API_KEY,
          'Content-Type': 'application/json',
        }
        if (expectedAuth) {
          expectedHeaders['Authorization'] = expectedAuth
        }

        const expectedBody = {
          method: 'POST',
          headers: expectedHeaders,
          body: '{"messages":[{"topic":"topic","event":"test","private":true}]}',
          signal: new AbortController().signal,
        }

        const expectedUrl = testSetup.realtimeUrl
          .replace('wss', 'https')
          .concat(`/api/broadcast?apikey=${expectedHeaders.apikey}&vsn=${VSN_2_0_0}`)

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

      testSetup = setupRealtimeTest({
        fetch: fetchStub as unknown as typeof fetch,
        params: { apikey: 'abc123' },
      })
      const channel = testSetup.client.channel('topic')

      const result = await channel.send({
        type: 'broadcast',
        event: 'test',
      })

      expect(result).toBe('timed out')
    })

    test('handles HTTP request general error', async () => {
      const fetchStub = vi.fn().mockRejectedValue(new Error('Network error'))

      testSetup = setupRealtimeTest({
        fetch: fetchStub as unknown as typeof fetch,
        params: { apikey: 'abc123' },
      })
      const channel = testSetup.client.channel('topic')

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

      testSetup = setupRealtimeTest({
        fetch: fetchStub as unknown as typeof fetch,
        params: { apikey: 'abc123' },
      })
      const channel = testSetup.client.channel('topic')

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

      testSetup = setupRealtimeTest({
        fetch: fetchStub as unknown as typeof fetch,
        params: { apikey: 'abc123' },
      })
      const channel = testSetup.client.channel('topic')

      const result = await channel.send({
        type: 'broadcast',
        event: 'test',
      })

      expect(result).toBe('timed out')
      expect(fetchStub).toHaveBeenCalled()
    })
  })
})

describe('httpSend', () => {
  const createMockResponse = (status: number, statusText?: string, body?: any) => ({
    status,
    statusText: statusText || 'OK',
    headers: new Headers(),
    body: null,
    json: vi.fn().mockResolvedValue(body || {}),
  })

  const createSocket = (hasToken = false, fetchMock?: any) => {
    const config: any = {
      fetch: fetchMock,
      params: { apikey: '123456789' },
    }
    if (hasToken) {
      config.accessToken = () => Promise.resolve('token123')
    }
    return setupRealtimeTest(config)
  }

  const testCases = [
    {
      name: 'without access token',
      hasToken: false,
      expectedAuth: undefined as string | undefined,
    },
    {
      name: 'with access token',
      hasToken: true,
      expectedAuth: 'Bearer token123' as string | undefined,
    },
  ]

  testCases.forEach(({ name, hasToken, expectedAuth }) => {
    describe(name, () => {
      test('sends with correct Authorization header', async () => {
        const mockResponse = createMockResponse(202)
        const fetchStub = vi.fn().mockResolvedValue(mockResponse)

        const testSetup = createSocket(hasToken, fetchStub)

        if (hasToken) await testSetup.client.setAuth()
        const channel = testSetup.client.channel('topic')

        const result = await channel.httpSend('test', { data: 'test' })

        expect(result).toEqual({ success: true })
        expect(fetchStub).toHaveBeenCalledTimes(1)
        const [, options] = fetchStub.mock.calls[0]
        expect(options.headers.Authorization).toBe(expectedAuth)
        expect(options.headers.apikey).toBe(DEFAULT_API_KEY)
      })

      test('rejects when payload is not provided', async () => {
        const testSetup = createSocket(hasToken)
        if (hasToken) await testSetup.client.setAuth()
        const channel = testSetup.client.channel('topic')

        await expect(channel.httpSend('test', undefined as any)).rejects.toBe(
          'Payload is required for httpSend()'
        )
      })

      test('rejects when payload is null', async () => {
        const testSetup = createSocket(hasToken)
        if (hasToken) await testSetup.client.setAuth()
        const channel = testSetup.client.channel('topic')

        await expect(channel.httpSend('test', null as any)).rejects.toBe(
          'Payload is required for httpSend()'
        )
      })

      test('handles timeout error', async () => {
        const timeoutError = new Error('Request timeout')
        timeoutError.name = 'AbortError'
        const fetchStub = vi.fn().mockRejectedValue(timeoutError)
        const testSetup = createSocket(hasToken, fetchStub)

        if (hasToken) await testSetup.client.setAuth()
        const channel = testSetup.client.channel('topic')

        await expect(channel.httpSend('test', { data: 'test' })).rejects.toThrow('Request timeout')
      })

      test('handles non-202 status', async () => {
        const mockResponse = createMockResponse(500, 'Internal Server Error', {
          error: 'Server error',
        })
        const fetchStub = vi.fn().mockResolvedValue(mockResponse)
        const testSetup = createSocket(hasToken, fetchStub)
        if (hasToken) await testSetup.client.setAuth()
        const channel = testSetup.client.channel('topic')

        await expect(channel.httpSend('test', { data: 'test' })).rejects.toThrow('Server error')
      })

      test('respects custom timeout option', async () => {
        const mockResponse = createMockResponse(202)
        const fetchStub = vi.fn().mockResolvedValue(mockResponse)
        const testSetup = createSocket(hasToken, fetchStub)
        if (hasToken) await testSetup.client.setAuth()
        const channel = testSetup.client.channel('topic')

        const result = await channel.httpSend('test', { data: 'test' }, { timeout: 3000 })

        expect(result).toEqual({ success: true })
        expect(fetchStub).toHaveBeenCalledTimes(1)
        const [, options] = fetchStub.mock.calls[0]
        expect(options.headers.Authorization).toBe(expectedAuth)
      })

      test('sends correct payload', async () => {
        const mockResponse = createMockResponse(202)
        const fetchStub = vi.fn().mockResolvedValue(mockResponse)
        const testSetup = createSocket(hasToken, fetchStub)
        if (hasToken) await testSetup.client.setAuth()
        const channel = testSetup.client.channel('topic')

        const result = await channel.httpSend('test-payload', { data: 'value' })

        expect(result).toEqual({ success: true })
        expect(fetchStub).toHaveBeenCalledTimes(1)
        const [, options] = fetchStub.mock.calls[0]
        expect(options.headers.Authorization).toBe(expectedAuth)
        expect(options.body).toBe(
          '{"messages":[{"topic":"topic","event":"test-payload","payload":{"data":"value"},"private":false}]}'
        )
      })
    })
  })

  describe('with access token - additional scenarios', () => {
    test('returns success true on 202 status with private channel', async () => {
      const mockResponse = createMockResponse(202, 'Accepted')
      const fetchStub = vi.fn().mockResolvedValue(mockResponse)
      const testSetup = createSocket(true, fetchStub)
      await testSetup.client.setAuth()
      const channel = testSetup.client.channel('topic', { config: { private: true } })

      const result = await channel.httpSend('test-explicit', { data: 'explicit' })
      const expectedApiKey = '123456789'

      expect(result).toEqual({ success: true })
      const expectedUrl = testSetup.wssUrl
        .replace('/websocket', '')
        .replace('wss', 'https')
        .concat(`/api/broadcast?apikey=${expectedApiKey}&vsn=${VSN_2_0_0}`)

      expect(fetchStub).toHaveBeenCalledTimes(1)
      const [url, options] = fetchStub.mock.calls[0]
      expect(url).toBe(expectedUrl)
      expect(options.method).toBe('POST')
      expect(options.headers.Authorization).toBe('Bearer token123')
      expect(options.headers.apikey).toBe(expectedApiKey)
      expect(options.body).toBe(
        '{"messages":[{"topic":"topic","event":"test-explicit","payload":{"data":"explicit"},"private":true}]}'
      )
    })

    test('uses default timeout when not specified', async () => {
      const mockResponse = createMockResponse(202)
      const fetchStub = vi.fn().mockResolvedValue(mockResponse)
      const testSetup = setupRealtimeTest({
        fetch: fetchStub,
        timeout: 5000,
        params: { apikey: 'abc123' },
        accessToken: () => Promise.resolve('token123'),
      })
      await testSetup.client.setAuth()
      const channel = testSetup.client.channel('topic')

      const result = await channel.httpSend('test', { data: 'test' })

      expect(result).toEqual({ success: true })
      expect(fetchStub).toHaveBeenCalledTimes(1)
      const [, options] = fetchStub.mock.calls[0]
      expect(options.signal).toBeDefined()
    })

    test('uses statusText when error body has no error field', async () => {
      const mockResponse = {
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers(),
        body: null,
        json: vi.fn().mockResolvedValue({ message: 'Invalid request' }),
      }
      const fetchStub = vi.fn().mockResolvedValue(mockResponse)
      const testSetup = createSocket(true, fetchStub)
      await testSetup.client.setAuth()
      const channel = testSetup.client.channel('topic')

      await expect(channel.httpSend('test', { data: 'test' })).rejects.toThrow('Invalid request')
    })

    test('falls back to statusText when json parsing fails', async () => {
      const mockResponse = {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers(),
        body: null,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      }
      const fetchStub = vi.fn().mockResolvedValue(mockResponse)
      const testSetup = createSocket(true, fetchStub)
      await testSetup.client.setAuth()
      const channel = testSetup.client.channel('topic')

      await expect(channel.httpSend('test', { data: 'test' })).rejects.toThrow(
        'Service Unavailable'
      )
    })
  })
})
