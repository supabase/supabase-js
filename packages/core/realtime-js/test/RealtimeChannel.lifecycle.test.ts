import assert from 'assert'
import { randomUUID } from 'crypto'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeClient from '../src/RealtimeClient'
import RealtimeChannel from '../src/RealtimeChannel'
import { WebSocket } from 'mock-socket'
import { CHANNEL_STATES, CONNECTION_STATE } from '../src/lib/constants'
import { DEFAULT_API_KEY, setupRealtimeTest, TestSetup } from './helpers/setup'

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

afterEach(() => testSetup.cleanup())

describe('Channel Lifecycle Management', () => {
  describe('constructor', () => {
    test('sets defaults', () => {
      channel = new RealtimeChannel('topic', { config: {} }, testSetup.client)

      const expectedParams = {
        config: {
          broadcast: { ack: false, self: false },
          presence: { key: '', enabled: false },
          private: false,
        },
      }

      const expectedJoinPayload = {
        config: {
          broadcast: { ack: false, self: false },
          presence: { key: '', enabled: false },
          private: false,
        },
      }

      assert.equal(channel.state, 'closed')
      assert.equal(channel.topic, 'topic')
      assert.deepEqual(channel.socket, testSetup.client)
      assert.equal(channel.timeout, defaultTimeout)
      assert.equal(channel.joinedOnce, false)
      expect(channel.joinPush).toBeTruthy()

      assert.deepEqual(channel.params, expectedParams)

      const joinPush = channel.joinPush
      assert.deepEqual(joinPush.channel, channel.channelAdapter.getChannel())
      assert.deepEqual(joinPush.payload(), expectedJoinPayload)
      assert.equal(joinPush.event, 'phx_join')
      assert.equal(joinPush.timeout, defaultTimeout)
    })

    test.each([
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
      },
    ])('$name', ({ config, setup, expectedParams, expectedJoinPayload }) => {
      channel = new RealtimeChannel('topic', { config }, testSetup.client)

      setup(channel)

      expect(channel.params).toStrictEqual(expectedParams)

      const joinPush = channel.joinPush
      expect(joinPush.channel).toBe(channel.channelAdapter.getChannel())
      expect(joinPush.payload()).toStrictEqual(expectedJoinPayload)
      expect(joinPush.event).toStrictEqual('phx_join')
      expect(joinPush.timeout).toStrictEqual(defaultTimeout)
    })
  })

  describe('subscribe', () => {
    beforeEach(() => {
      channel = testSetup.client.channel('topic')
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

    test('if attempting to join multiple times, ignores calls', async () => {
      channel.subscribe()
      await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.joined))

      for (let i = 0; i < 10; ++i) channel.subscribe()

      await vi.waitFor(() =>
        expect(testSetup.emitters.message).toHaveBeenCalledWith(
          'realtime:topic',
          'phx_join',
          expect.any(Object)
        )
      )

      expect(testSetup.emitters.message).toBeCalledTimes(1) // only one join

      assert.equal(channel.state, CHANNEL_STATES.joined)
    })

    test('if subscription closed and then subscribe, it will throw error', async () => {
      const subscribeSpy = vi.fn()

      channel.subscribe(subscribeSpy)
      await vi.waitFor(() => expect(subscribeSpy).toBeCalledWith('SUBSCRIBED'))
      await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.joined))
      channel.unsubscribe()
      await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.closed))
      expect(() => channel.subscribe()).toThrowError()
    })

    test('updates join push payload access token', async () => {
      testSetup.client.accessTokenValue = 'token123'

      channel.subscribe()

      await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.joined))

      expect(channel.joinPush.payload()).toStrictEqual({
        access_token: 'token123',
        config: expect.any(Object),
      })
    })

    test('triggers setAuth when socket is disconnected', async () => {
      vi.useRealTimers() // Use real timers for this test
      const tokens = [randomUUID(), randomUUID(), randomUUID()]
      let callCount = 0
      const accessToken = async () => tokens[callCount++]

      const testSocket = new RealtimeClient(testSetup.realtimeUrl, {
        accessToken: accessToken,
        transport: WebSocket,
        params: { apikey: DEFAULT_API_KEY },
      })

      testSocket.connect()

      await vi.waitFor(() => expect(testSocket.connectionState()).toBe(CONNECTION_STATE.open))
      expect(testSocket.accessTokenValue).toStrictEqual(tokens[0])

      const channel = testSocket.channel('topic')

      testSocket.disconnect()
      // Wait for disconnect to complete (including fallback timer)
      await vi.waitFor(() => expect(testSocket.connectionState()).toBe(CONNECTION_STATE.closed))

      channel.subscribe()
      await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.joined))
      expect(channel.socket.accessTokenValue).toStrictEqual(tokens[2]) // Token set during connect and during subscribe
    })

    describe('socket push operations', () => {
      test('triggers socket push with default channel params', async () => {
        const joinSpy = vi.fn()
        testSetup.cleanup()
        testSetup = setupRealtimeTest({
          useFakeTimers: true,
          timeout: defaultTimeout,
          socketHandlers: {
            phx_join: (socket, message) => {
              const msg = JSON.parse(message)
              joinSpy(msg.topic, msg.event, msg.payload, msg.ref, msg.join_ref)
              socket.send(
                JSON.stringify({
                  topic: msg.topic,
                  event: 'phx_reply',
                  payload: { status: 'ok', response: {} },
                  ref: msg.ref,
                })
              )
            },
          },
        })

        vi.spyOn(testSetup.client.socketAdapter.getSocket(), 'makeRef').mockImplementation(
          () => defaultRef
        )

        channel = testSetup.client.channel('topic')
        const cbSpy = vi.fn()
        channel.subscribe(cbSpy)

        await vi.waitFor(() => {
          expect(joinSpy).toHaveBeenCalledTimes(1)
          expect(joinSpy).toHaveBeenCalledWith(
            'realtime:topic',
            'phx_join',
            {
              config: {
                broadcast: { ack: false, self: false },
                presence: { key: '', enabled: false },
                postgres_changes: [],
                private: false,
              },
            },
            defaultRef,
            defaultRef
          )
        })

        expect(cbSpy).toHaveBeenCalledWith('SUBSCRIBED')
      })

      test('triggers socket push with postgres_changes channel params with correct server resp', async () => {
        const joinSpy = vi.fn()
        testSetup.cleanup()
        testSetup = setupRealtimeTest({
          useFakeTimers: true,
          timeout: defaultTimeout,
          socketHandlers: {
            phx_join: (socket, message) => {
              const msg = JSON.parse(message)
              joinSpy(msg.topic, msg.event, msg.payload, msg.ref, msg.join_ref)
              socket.send(
                JSON.stringify({
                  topic: msg.topic,
                  event: 'phx_reply',
                  payload: {
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
                  },
                  ref: msg.ref,
                })
              )
            },
          },
        })

        vi.spyOn(testSetup.client.socketAdapter.getSocket(), 'makeRef').mockImplementation(
          () => defaultRef
        )

        channel = testSetup.client.channel('topic')
        const cbSpy = vi.fn()
        const func = () => {}

        channel.on('postgres_changes', { event: '*', schema: '*' }, func)
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'test' }, func)
        channel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'test',
            filter: 'id=eq.1',
          },
          func
        )

        channel.subscribe(cbSpy)

        await vi.waitFor(() => {
          expect(joinSpy).toHaveBeenCalledTimes(1)
          expect(joinSpy).toHaveBeenCalledWith(
            'realtime:topic',
            'phx_join',
            {
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
            defaultRef,
            defaultRef
          )
        })
        expect(cbSpy).toHaveBeenCalledWith('SUBSCRIBED')

        expect(channel.bindings.postgres_changes).toStrictEqual([
          {
            id: 'abc',
            type: 'postgres_changes',
            filter: { event: '*', schema: '*' },
            ref: expect.any(Number),
            callback: func,
          },
          {
            id: 'def',
            type: 'postgres_changes',
            filter: { event: 'INSERT', schema: 'public', table: 'test' },
            ref: expect.any(Number),
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
            ref: expect.any(Number),
            callback: func,
          },
        ])
      })
    })

    test('unsubscribes to channel with incorrect server postgres_changes resp', async () => {
      testSetup.cleanup()
      testSetup = setupRealtimeTest({
        useFakeTimers: true,
        timeout: defaultTimeout,
        socketHandlers: {
          phx_join: (socket, message) => {
            const msg = JSON.parse(message)
            socket.send(
              JSON.stringify({
                topic: msg.topic,
                event: 'phx_reply',
                payload: {
                  status: 'ok',
                  response: {
                    postgres_changes: [{ id: 'abc', event: '*', schema: '*' }],
                  },
                },
                ref: msg.ref,
              })
            )
          },
        },
      })

      channel = testSetup.client.channel('topic')
      const dummyCallback = () => {}

      channel.on('postgres_changes', { event: '*', schema: '*' }, dummyCallback)
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'test' },
        dummyCallback
      )
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'test',
          filter: 'id=eq.1',
        },
        dummyCallback
      )

      const callbackSpy = vi.fn()

      channel.subscribe(callbackSpy)

      await vi.waitFor(() => {
        expect(callbackSpy).toHaveBeenCalledTimes(2)
        expect(callbackSpy).toHaveBeenCalledWith('CLOSED')
        expect(callbackSpy).toHaveBeenCalledWith(
          'CHANNEL_ERROR',
          expect.objectContaining({
            message: 'mismatch between server and client bindings for postgres changes',
          })
        )
      })

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
      const payload = channel.joinPush.payload()

      channel.updateJoinPayload({ access_token: 'token123' })

      const newPayload = channel.joinPush.payload()

      expect(newPayload).toEqual({ access_token: 'token123' })
      expect(payload).not.toEqual(newPayload)
    })

    test('timeout behavior succeeds before timeout', async () => {
      testSetup.client.connect()
      channel.subscribe()

      await vi.waitFor(() =>
        expect(testSetup.emitters.message).toBeCalledWith(
          'realtime:topic',
          'phx_join',
          expect.any(Object)
        )
      )

      testSetup.emitters.message.mockClear()

      vi.advanceTimersByTime(defaultTimeout / 2)

      assert.equal(channel.state, CHANNEL_STATES.joined)

      vi.advanceTimersByTime(defaultTimeout / 2)

      expect(testSetup.emitters.message).toBeCalledTimes(0)
    })
  })

  describe('unsubscribe', () => {
    test('returns a promise that resolves when server acknowledges leave', async () => {
      testSetup.cleanup()
      testSetup = setupRealtimeTest({
        useFakeTimers: true,
        timeout: defaultTimeout,
        socketHandlers: {
          phx_leave: (socket, message) => {
            const msg = JSON.parse(message)
            socket.send(
              JSON.stringify({
                topic: msg.topic,
                event: 'phx_reply',
                payload: { status: 'ok', response: {} },
                ref: msg.ref,
              })
            )
          },
        },
      })
      channel = testSetup.client.channel('topic')
      channel.subscribe()

      await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.joined))

      const result = await channel.unsubscribe()

      expect(result).toBe('ok')

      expect(channel.state).toBe(CHANNEL_STATES.closed)
    })
  })
})
