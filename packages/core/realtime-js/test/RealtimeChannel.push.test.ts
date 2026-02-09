import assert from 'assert'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeClient from '../src/RealtimeClient'
import RealtimeChannel from '../src/RealtimeChannel'
import { CHANNEL_STATES, VSN_1_0_0 } from '../src/lib/constants'
import {
  phxJoinReply,
  phxReply,
  setupRealtimeTest,
  TestSetup,
  waitForChannelSubscribed,
} from './helpers/setup'

const defaultTimeout = 1000

let channel: RealtimeChannel
let testSetup: TestSetup

describe('push', () => {
  const pushParams = ['realtime:topic', 'event', { foo: 'bar' }]

  beforeEach(() => {
    testSetup = setupRealtimeTest({
      useFakeTimers: true,
      timeout: defaultTimeout,
      socketHandlers: {
        phx_join: () => {},
      },
    })
  })

  afterEach(() => testSetup.cleanup())

  beforeEach(async () => {
    testSetup.connect()
    await testSetup.socketConnected()

    channel = testSetup.client.channel('topic')
  })

  afterEach(() => {
    channel.unsubscribe()
    testSetup.cleanup()
  })

  test('sends push event when successfully joined', async () => {
    channel.subscribe()
    testSetup.mockServer.emit('message', phxJoinReply(channel, {}))
    await waitForChannelSubscribed(channel)

    testSetup.emitters.message.mockClear()

    channel.channelAdapter.push('event', { foo: 'bar' })

    await vi.waitFor(() => expect(testSetup.emitters.message).toHaveBeenCalledWith(...pushParams))
  })

  test('enqueues push event to be sent once join has succeeded', async () => {
    channel.subscribe()
    channel.channelAdapter.push('event', { foo: 'bar' })

    vi.advanceTimersByTime(channel.timeout / 2)

    expect(testSetup.emitters.message).toHaveBeenCalledTimes(1) // phx_join

    expect(testSetup.emitters.message).not.toHaveBeenCalledWith(...pushParams)

    testSetup.mockServer.emit('message', phxJoinReply(channel, {}))

    await vi.waitFor(() => expect(testSetup.emitters.message).toHaveBeenCalledWith(...pushParams))
  })

  test('does not push if channel join times out', async () => {
    channel.subscribe()
    channel.channelAdapter.push('event', { foo: 'bar' })

    vi.advanceTimersByTime(channel.timeout * 2)

    expect(testSetup.emitters.message).toHaveBeenCalledTimes(2) // phx_join and phx_leave

    testSetup.mockServer.emit('message', phxJoinReply(channel, {}))

    await waitForChannelSubscribed(channel)

    expect(testSetup.emitters.message).not.toHaveBeenCalledWith(...pushParams)
    expect(testSetup.emitters.message).toHaveBeenCalledTimes(3) // 2 phx_join and 1 phx_leave
  })

  test('uses channel timeout by default', async () => {
    const timeoutSpy = vi.fn()

    channel.subscribe()
    testSetup.mockServer.emit('message', phxJoinReply(channel, {}))
    await waitForChannelSubscribed(channel)

    channel.channelAdapter.push('event', { foo: 'bar' }).receive('timeout', timeoutSpy)

    vi.advanceTimersByTime(channel.timeout / 2)
    expect(timeoutSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(channel.timeout)
    expect(timeoutSpy).toHaveBeenCalled()
  })

  test('accepts timeout arg', async () => {
    const timeoutSpy = vi.fn()

    channel.subscribe()
    testSetup.mockServer.emit('message', phxJoinReply(channel, {}))
    await waitForChannelSubscribed(channel)

    channel.channelAdapter
      .push('event', { foo: 'bar' }, channel.timeout * 2)
      .receive('timeout', timeoutSpy)

    vi.advanceTimersByTime(channel.timeout / 2)
    expect(timeoutSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(channel.timeout * 2)
    expect(timeoutSpy).toHaveBeenCalled()
  })

  test("does not time out after receiving 'ok'", async () => {
    channel.subscribe()
    testSetup.mockServer.emit('message', phxJoinReply(channel, {}))
    await waitForChannelSubscribed(channel)

    const timeoutSpy = vi.fn()

    const push = channel.channelAdapter.push('event', { foo: 'bar' })
    push.receive('timeout', timeoutSpy)

    vi.advanceTimersByTime(push.timeout / 2)
    expect(timeoutSpy).not.toHaveBeenCalled()

    testSetup.mockServer.emit(
      'message',
      JSON.stringify({
        topic: channel.topic,
        event: 'phx_reply',
        ref: push.ref,
        payload: { status: 'ok', response: {} },
      })
    )

    vi.advanceTimersByTime(push.timeout)
    expect(timeoutSpy).not.toHaveBeenCalled()
  })

  test('throws if channel has not been joined', () => {
    assert.throws(() => channel.channelAdapter.push('event', {}), /tried to push.*before joining/)
  })
})

describe('leave', () => {
  beforeEach(async () => {
    testSetup = setupRealtimeTest({
      useFakeTimers: true,
      timeout: defaultTimeout,
      socketHandlers: {
        phx_leave: (socket, message) => {
          socket.send(phxReply(message, { status: 'ok', response: {} }))
        },
      },
    })
    channel = testSetup.client.channel('topic')
    channel.subscribe()
    testSetup.mockServer.emit('message', phxJoinReply(channel, {}))
    await waitForChannelSubscribed(channel)
  })

  afterEach(() => testSetup.cleanup())

  test('unsubscribes from server events', async () => {
    const result = await channel.unsubscribe()

    expect(result).toBe('ok')

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toHaveBeenCalledWith('realtime:topic', 'phx_leave', {})
    )

    expect(channel.state).toBe(CHANNEL_STATES.closed)
    expect(channel.channelAdapter.getChannel().pushBuffer).toStrictEqual([])
  })

  test("closes channel on 'ok' from server", async () => {
    testSetup.cleanup()

    const anotherChannel = testSetup.client.channel('another')
    assert.equal(testSetup.client.getChannels().length, 2)

    channel.unsubscribe()

    await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.closed))

    assert.equal(testSetup.client.getChannels().length, 1)
    assert.deepEqual(testSetup.client.getChannels()[0], anotherChannel)
  })

  test("sets state to closed on 'ok' event", async () => {
    assert.notEqual(channel.state, 'closed')

    channel.unsubscribe()

    await vi.waitFor(() => expect(channel.state).toBe(CHANNEL_STATES.closed))
  })

  // TODO - the following tests are skipped until Channel.leave
  // behavior can be fixed; currently, 'ok' is triggered immediately
  // within Channel.leave so timeout callbacks are never reached
  test.skip('sets state to leaving initially', () => {
    assert.notEqual(channel.state, 'leaving')

    channel.unsubscribe()

    assert.equal(channel.state, 'leaving')
  })

  test("closes channel on 'timeout'", () => {
    channel.unsubscribe()
    vi.advanceTimersByTime(channel.timeout)
    assert.equal(channel.state, 'closed')
  })

  // TODO - this tests needs a better approach as the current approach does not test the Push event timeout
  // This might be better to be an integration test or a test in the Push class
  test('accepts timeout arg', () => {
    channel.unsubscribe(10000)
    vi.advanceTimersByTime(channel.timeout)
    assert.equal(channel.state, 'closed')
  })
})

describe('joinPush', () => {
  let joinPush: any, response: any

  const helpers = {
    receiveOk() {
      vi.advanceTimersByTime(joinPush.timeout / 2) // before timeout
      joinPush.trigger('ok', response)
    },

    receiveTimeout() {
      vi.advanceTimersByTime(joinPush.timeout * 2) // after timeout
    },

    receiveError() {
      vi.advanceTimersByTime(joinPush.timeout / 2) // before timeout
      joinPush.trigger('error', response)
    },

    getBindings(type: string) {
      return channel.bindings[type].filter((bind: any) => bind.type === type)
    },
  }

  beforeEach(async () => {
    testSetup = setupRealtimeTest({
      useFakeTimers: true,
      timeout: defaultTimeout,
      socketHandlers: {
        phx_join: () => {},
      },
    })
    channel = testSetup.client.channel('topic')
    joinPush = channel.joinPush

    channel.subscribe()
  })

  afterEach(() => {
    channel.unsubscribe()
    testSetup.cleanup()
  })

  describe("receives 'ok'", () => {
    beforeEach(() => {
      response = { chan: 'reply' }
    })

    test('sets channel state to joined', () => {
      assert.notEqual(channel.state, CHANNEL_STATES.joined)
      helpers.receiveOk()
      assert.equal(channel.state, CHANNEL_STATES.joined)
    })

    test("triggers receive('ok') callback after ok response", () => {
      const spyOk = vi.fn()
      joinPush.receive('ok', spyOk)
      helpers.receiveOk()
      expect(spyOk).toHaveBeenCalledTimes(1)
    })

    test("triggers receive('ok') callback if ok response already received", () => {
      const spyOk = vi.fn()
      helpers.receiveOk()
      joinPush.receive('ok', spyOk)
      expect(spyOk).toHaveBeenCalledTimes(1)
    })

    test('does not trigger other receive callbacks after ok response', () => {
      const spyError = vi.fn()
      const spyTimeout = vi.fn()

      joinPush.receive('error', spyError).receive('timeout', spyTimeout)

      helpers.receiveOk()
      vi.advanceTimersByTime(channel.timeout * 2) // attempt timeout

      expect(spyError).not.toHaveBeenCalled()
      expect(spyTimeout).not.toHaveBeenCalled()
    })

    test('clears timeoutTimer', () => {
      expect(joinPush.timeoutTimer).toBeTruthy()

      helpers.receiveOk()

      assert.equal(joinPush.timeoutTimer, null)
    })

    test('sets receivedResp', () => {
      assert.equal(joinPush.receivedResp, null)

      helpers.receiveOk()

      assert.deepEqual(joinPush.receivedResp, { status: 'ok', response })
    })
  })

  describe("receives 'timeout'", () => {
    test('sets channel state to errored', async () => {
      assert.notEqual(channel.state, CHANNEL_STATES.errored)
      helpers.receiveTimeout()
      await vi.waitFor(() => assert.equal(channel.state, CHANNEL_STATES.errored))
    })

    test("triggers receive('timeout') callback", () => {
      const spyTimeout = vi.fn()
      joinPush.receive('timeout', spyTimeout)
      helpers.receiveTimeout()
      expect(spyTimeout).toHaveBeenCalledTimes(1)
    })
  })

  describe("receives 'error'", () => {
    beforeEach(() => {
      response = { error: 'something went wrong' }
    })

    test('sets channel state to errored', () => {
      assert.notEqual(channel.state, CHANNEL_STATES.errored)
      helpers.receiveError()
      assert.equal(channel.state, CHANNEL_STATES.errored)
    })

    test("triggers receive('error') callback", () => {
      const spyError = vi.fn()
      joinPush.receive('error', spyError)
      helpers.receiveError()
      expect(spyError).toHaveBeenCalledTimes(1)
    })
  })
})

describe('canPush', () => {
  beforeEach(() => {
    testSetup = setupRealtimeTest()
    channel = testSetup.client.channel('topic')
  })

  afterEach(() => {
    testSetup.client.disconnect()
    channel.unsubscribe()
  })

  test('returns true when socket connected and channel joined', async () => {
    channel.subscribe()
    testSetup.mockServer.emit('message', phxJoinReply(channel, {}))
    await testSetup.socketConnected()
    await waitForChannelSubscribed(channel)

    expect(channel.channelAdapter.canPush()).toBeTruthy()
  })

  test('otherwise returns false', () => {
    const isConnectedStub = vi.spyOn(testSetup.client, 'isConnected')

    isConnectedStub.mockReturnValue(false)
    channel.state = CHANNEL_STATES.joined
    expect(channel.channelAdapter.canPush()).toBeFalsy()

    isConnectedStub.mockReturnValue(true)
    channel.state = CHANNEL_STATES.joining
    expect(channel.channelAdapter.canPush()).toBeFalsy()

    isConnectedStub.mockReturnValue(false)
    channel.state = CHANNEL_STATES.joining
    expect(channel.channelAdapter.canPush()).toBeFalsy()
  })
})
