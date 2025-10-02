import assert from 'assert'
import { randomUUID } from 'crypto'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeClient from '../src/RealtimeClient'
import RealtimeChannel from '../src/RealtimeChannel'
import { WebSocket } from 'mock-socket'
import { CHANNEL_STATES } from '../src/lib/constants'
import Push from '../src/lib/push'
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
})

afterEach(() => cleanupRealtimeTest(testSetup))

describe('Channel Lifecycle Management', () => {
  describe('constructor', () => {
    test.each([
      {
        name: 'sets defaults',
        config: {},
        setup: () => {},
        expectedParams: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            private: false,
          },
        },
        expectedJoinPayload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            private: false,
          },
        },
        testChannelDefaults: true,
      },
      {
        name: 'sets up joinPush object',
        config: {},
        setup: () => {},
        expectedParams: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            private: false,
          },
        },
        expectedJoinPayload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            private: false,
          },
        },
        testChannelDefaults: false,
      },
      {
        name: 'sets up joinPush object with private defined',
        config: { private: true },
        setup: () => {},
        expectedParams: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            private: true,
          },
        },
        expectedJoinPayload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            private: true,
          },
        },
        testChannelDefaults: false,
      },
      {
        name: 'sets up joinPush object with presence disabled if no on with type presence is defined',
        config: { private: true },
        setup: (channel: RealtimeChannel) => {
          channel.subscribe()
        },
        expectedParams: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            private: true,
          },
        },
        expectedJoinPayload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            postgres_changes: [],
            private: true,
          },
        },
        testChannelDefaults: false,
      },
      {
        name: 'sets up joinPush object with presence enabled if on with type presence is defined',
        config: { private: true },
        setup: (channel: RealtimeChannel) => {
          channel.on('presence', { event: 'join' }, ({}) => {})
          channel.subscribe()
        },
        expectedParams: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            private: true,
          },
        },
        expectedJoinPayload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: true },
            postgres_changes: [],
            private: true,
          },
        },
        testChannelDefaults: false,
      },
      {
        name: 'sets up joinPush object with presence enabled when config.presence.enabled is true even without bindings',
        config: {
          private: true,
          presence: { key: '', enabled: true },
        },
        setup: (channel: RealtimeChannel) => {
          // No presence bindings added
          channel.subscribe()
        },
        expectedParams: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: true },
            private: true,
          },
        },
        expectedJoinPayload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: true },
            postgres_changes: [],
            private: true,
          },
        },
        testChannelDefaults: false,
      },
    ])('$name', ({ config, setup, expectedParams, expectedJoinPayload, testChannelDefaults }) => {
      testSetup.socket.timeout = 1234
      channel = new RealtimeChannel('topic', { config }, testSetup.socket)

      setup(channel)

      if (testChannelDefaults) {
        assert.equal(channel.state, 'closed')
        assert.equal(channel.topic, 'topic')
        assert.deepEqual(channel.socket, testSetup.socket)
        assert.equal(channel.timeout, 1234)
        assert.equal(channel.joinedOnce, false)
        expect(channel.joinPush).toBeTruthy()
        assert.deepEqual(channel.pushBuffer, [])
      }

      assert.deepEqual(channel.params, expectedParams)

      const joinPush = channel.joinPush
      assert.deepEqual(joinPush.channel, channel)
      assert.deepEqual(joinPush.payload, expectedJoinPayload)
      assert.equal(joinPush.event, 'phx_join')
      assert.equal(joinPush.timeout, 1234)
    })
  })

  describe('subscribe', () => {
    beforeEach(() => {
      channel = testSetup.socket.channel('topic')
    })

    afterEach(() => {
      channel.unsubscribe()
    })

    test('sets state to joining', () => {
      channel.subscribe()
      assert.equal(channel.state, CHANNEL_STATES.joining)
    })

    test('sets joinedOnce to true', () => {
      expect(channel.joinedOnce).toBeFalsy()
      channel.subscribe()
      expect(channel.joinedOnce).toBeTruthy()
    })

    test('if attempting to join multiple times, ignores calls', () => {
      channel.subscribe()
      while (channel.state == CHANNEL_STATES.closed) vi.advanceTimersByTime(100)
      const state = channel.state

      for (let i = 0; i < 10; i++) channel.subscribe()

      assert.equal(channel.state, state)
    })

    test('if subscription closed and then subscribe, it will rejoin', () => {
      channel.subscribe()
      while (channel.state == CHANNEL_STATES.closed) vi.advanceTimersByTime(100)

      channel.unsubscribe()
      while ((channel.state as CHANNEL_STATES) !== CHANNEL_STATES.closed) {
        vi.advanceTimersByTime(100)
      }
      channel.subscribe()

      assert.equal(channel.state, CHANNEL_STATES.joining)
    })

    test('updates join push payload access token', () => {
      testSetup.socket.accessTokenValue = 'token123'

      channel.subscribe()

      assert.deepEqual(channel.joinPush.payload, {
        access_token: 'token123',
        config: {
          broadcast: { ack: false, self: false },
          presence: { key: '', enabled: false },
          postgres_changes: [],
          private: false,
        },
      })
    })

    test('triggers setAuth when socket is not connected', async () => {
      vi.useRealTimers() // Use real timers for this test
      let callCount = 0
      const tokens = [randomUUID(), randomUUID()]
      const accessToken = async () => tokens[callCount++]
      const testSocket = new RealtimeClient(testSetup.url, {
        accessToken: accessToken,
        transport: WebSocket,
        params: { apikey: '123456789' },
      })
      const channel = testSocket.channel('topic')

      channel.subscribe()
      await new Promise((resolve) => setTimeout(resolve, 50))
      assert.equal(channel.socket.accessTokenValue, tokens[0])

      testSocket.disconnect()
      // Wait for disconnect to complete (including fallback timer)
      await new Promise((resolve) => setTimeout(resolve, 150))

      channel.subscribe()
      await new Promise((resolve) => setTimeout(resolve, 50))
      assert.equal(channel.socket.accessTokenValue, tokens[1])
    })

    describe('socket push operations', () => {
      beforeEach(() => {
        vi.spyOn(testSetup.socket, '_makeRef').mockImplementation(() => defaultRef)
      })

      test('triggers socket push with default channel params', () => {
        const spy = vi.spyOn(testSetup.socket, 'push')
        const cbSpy = vi.fn()

        channel.subscribe(cbSpy)

        const cb = channel.bindings['chan_reply_1'][0].callback
        cb({ status: 'ok', response: { postgres_changes: undefined } })

        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith({
          topic: 'realtime:topic',
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: '', enabled: false },
              postgres_changes: [],
              private: false,
            },
          },
          ref: defaultRef,
          join_ref: defaultRef,
        })
        expect(cbSpy).toHaveBeenCalledWith('SUBSCRIBED')
      })

      test('triggers socket push with postgres_changes channel params with correct server resp', () => {
        const spy = vi.spyOn(testSetup.socket, 'push')
        const cbSpy = vi.fn()
        const func = () => {}

        channel.bindings.postgres_changes = [
          {
            type: 'postgres_changes',
            filter: { event: '*', schema: '*' },
            callback: func,
          },
          {
            type: 'postgres_changes',
            filter: { event: 'INSERT', schema: 'public', table: 'test' },
            callback: func,
          },
          {
            type: 'postgres_changes',
            filter: {
              event: 'UPDATE',
              schema: 'public',
              table: 'test',
              filter: 'id=eq.1',
            },
            callback: func,
          },
        ]
        channel.subscribe(cbSpy)

        const cb = channel.bindings['chan_reply_1'][0].callback
        cb({
          status: 'ok',
          response: {
            postgres_changes: [
              { id: 'abc', event: '*', schema: '*' },
              { id: 'def', event: 'INSERT', schema: 'public', table: 'test' },
              {
                id: 'ghi',
                event: 'UPDATE',
                schema: 'public',
                table: 'test',
                filter: 'id=eq.1',
              },
            ],
          },
        })

        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith({
          topic: 'realtime:topic',
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: '', enabled: false },
              postgres_changes: [
                { event: '*', schema: '*' },
                { event: 'INSERT', schema: 'public', table: 'test' },
                {
                  event: 'UPDATE',
                  schema: 'public',
                  table: 'test',
                  filter: 'id=eq.1',
                },
              ],
              private: false,
            },
          },
          ref: defaultRef,
          join_ref: defaultRef,
        })
        expect(cbSpy).toHaveBeenCalledWith('SUBSCRIBED')
        assert.deepEqual(channel.bindings.postgres_changes, [
          {
            id: 'abc',
            type: 'postgres_changes',
            filter: { event: '*', schema: '*' },
            callback: func,
          },
          {
            id: 'def',
            type: 'postgres_changes',
            filter: { event: 'INSERT', schema: 'public', table: 'test' },
            callback: func,
          },
          {
            id: 'ghi',
            type: 'postgres_changes',
            filter: {
              event: 'UPDATE',
              schema: 'public',
              table: 'test',
              filter: 'id=eq.1',
            },
            callback: func,
          },
        ])
      })
    })

    test('unsubscribes to channel with incorrect server postgres_changes resp', () => {
      const unsubscribeSpy = vi.spyOn(channel, 'unsubscribe')
      const callbackSpy = vi.fn()
      const dummyCallback = () => {}

      channel.bindings.postgres_changes = [
        {
          type: 'postgres_changes',
          filter: { event: '*', schema: '*' },
          callback: dummyCallback,
        },
        {
          type: 'postgres_changes',
          filter: { event: 'INSERT', schema: 'public', table: 'test' },
          callback: dummyCallback,
        },
        {
          type: 'postgres_changes',
          filter: {
            event: 'UPDATE',
            schema: 'public',
            table: 'test',
            filter: 'id=eq.1',
          },
          callback: dummyCallback,
        },
      ]

      channel.subscribe(callbackSpy)
      const replyCallback = channel.bindings['chan_reply_1'][0].callback
      replyCallback({
        status: 'ok',
        response: {
          postgres_changes: [{ id: 'abc', event: '*', schema: '*' }],
        },
      })

      expect(unsubscribeSpy).toHaveBeenCalledTimes(1)
      expect(callbackSpy).toHaveBeenCalledWith(
        'CHANNEL_ERROR',
        expect.objectContaining({
          message: 'mismatch between server and client bindings for postgres changes',
        })
      )
      assert.equal(channel.state, CHANNEL_STATES.errored)
    })

    test('can set timeout on joinPush', () => {
      const newTimeout = 2000
      const joinPush = channel.joinPush

      assert.equal(joinPush.timeout, defaultTimeout)

      channel.subscribe(() => {}, newTimeout)

      assert.equal(joinPush.timeout, newTimeout)
    })

    test('updates channel joinPush payload', () => {
      const payloadStub = vi.spyOn(channel.joinPush, 'updatePayload')

      channel.updateJoinPayload({ access_token: 'token123' })

      expect(payloadStub).toHaveBeenCalledWith({ access_token: 'token123' })
    })

    describe('timeout behavior', () => {
      test('succeeds before timeout', () => {
        const spy = vi.spyOn(testSetup.socket, 'push')

        testSetup.socket.connect()
        channel.subscribe()
        expect(spy).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(defaultTimeout / 2)

        channel.joinPush.trigger('ok', {})

        assert.equal(channel.state, CHANNEL_STATES.joined)

        vi.advanceTimersByTime(defaultTimeout / 2)
        expect(spy).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('unsubscribe', () => {
    let destroySpy: any

    beforeEach(() => {
      channel = testSetup.socket.channel('topic')
      channel.subscribe()
      destroySpy = vi.spyOn(Push.prototype, 'destroy')
    })

    afterEach(() => {
      destroySpy.mockRestore()
    })

    test('cleans up leavePush on successful unsubscribe', async () => {
      await channel.unsubscribe()

      expect(destroySpy).toHaveBeenCalledTimes(2) // Once for joinPush, once for leavePush
      assert.equal(channel.state, CHANNEL_STATES.closed)
    })

    test('cleans up leavePush on timeout', async () => {
      vi.spyOn(testSetup.socket, 'push').mockImplementation(() => {
        // Simulate timeout by not responding
        vi.advanceTimersByTime(defaultTimeout + 1)
      })

      const result = await channel.unsubscribe()

      expect(destroySpy).toHaveBeenCalledTimes(2) // Once for joinPush, once for leavePush
      assert.equal(result, 'timed out')
      assert.equal(channel.state, CHANNEL_STATES.closed)
    })

    test('ensures consistent state management in unsubscribe finally block', async () => {
      // This test validates that the finally block always executes and sets state to closed
      const result = await channel.unsubscribe()

      // Verify the finally block executed - state should always be closed
      assert.equal(channel.state, CHANNEL_STATES.closed)
      expect(destroySpy).toHaveBeenCalledTimes(2) // Once for joinPush, once for leavePush
      expect(['ok', 'timed out', 'error'].includes(result)).toBeTruthy()
    })

    test('cleans up leavePush even if socket is not connected', async () => {
      vi.spyOn(testSetup.socket, 'isConnected').mockReturnValue(false)

      await channel.unsubscribe()

      expect(destroySpy).toHaveBeenCalledTimes(2) // Once for joinPush, once for leavePush
      assert.equal(channel.state, CHANNEL_STATES.closed)
    })

    test('_rejoin does nothing when channel state is leaving', () => {
      // Set up channel to be in 'leaving' state
      channel.state = CHANNEL_STATES.leaving

      // Spy on socket methods to verify no actions are taken
      const leaveOpenTopicSpy = vi.spyOn(testSetup.socket, '_leaveOpenTopic')
      const resendSpy = vi.spyOn(channel.joinPush, 'resend')

      // Call _rejoin - should return early due to leaving state
      channel._rejoin()

      // Verify no actions were taken
      expect(leaveOpenTopicSpy).not.toHaveBeenCalled()
      expect(resendSpy).not.toHaveBeenCalled()
      // State should remain 'leaving'
      assert.equal(channel.state, CHANNEL_STATES.leaving)
    })
  })
})
