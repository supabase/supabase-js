import assert from 'assert'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import RealtimeClient from '../src/RealtimeClient'
import RealtimeChannel from '../src/RealtimeChannel'
import { CHANNEL_STATES } from '../src/lib/constants'
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

describe('push', () => {
  let socketSpy: any

  const pushParams = {
    topic: 'realtime:topic',
    event: 'event',
    payload: { foo: 'bar' },
    ref: defaultRef,
    join_ref: defaultRef,
  }

  beforeEach(() => {
    vi.spyOn(testSetup.socket, '_makeRef').mockImplementation(() => defaultRef)
    vi.spyOn(testSetup.socket, 'isConnected').mockImplementation(() => true)
    socketSpy = vi.spyOn(testSetup.socket, 'push')

    channel = testSetup.socket.channel('topic')
  })

  afterEach(() => {
    channel.unsubscribe()
  })

  test('sends push event when successfully joined', () => {
    channel.subscribe()
    channel.joinPush.trigger('ok', {})
    channel._push('event', { foo: 'bar' })

    expect(socketSpy).toHaveBeenCalledWith(pushParams)
  })

  test('enqueues push event to be sent once join has succeeded', () => {
    channel.subscribe()
    channel._push('event', { foo: 'bar' })

    expect(socketSpy).not.toHaveBeenCalledWith(pushParams)

    vi.advanceTimersByTime(channel.timeout / 2)
    channel.joinPush.trigger('ok', {})

    expect(socketSpy).toHaveBeenCalledWith(pushParams)
  })

  test('does not push if channel join times out', () => {
    channel.subscribe()
    channel._push('event', { foo: 'bar' })

    expect(socketSpy).not.toHaveBeenCalledWith(pushParams)

    vi.advanceTimersByTime(channel.timeout * 2)
    channel.joinPush.trigger('ok', {})

    expect(socketSpy).not.toHaveBeenCalledWith(pushParams)
  })

  test('uses channel timeout by default', () => {
    const timeoutSpy = vi.fn()
    channel.subscribe()
    channel.joinPush.trigger('ok', {})

    channel._push('event', { foo: 'bar' }).receive('timeout', timeoutSpy)

    vi.advanceTimersByTime(channel.timeout / 2)
    expect(timeoutSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(channel.timeout)
    expect(timeoutSpy).toHaveBeenCalled()
  })

  test('accepts timeout arg', () => {
    const timeoutSpy = vi.fn()
    channel.subscribe()
    channel.joinPush.trigger('ok', {})

    channel._push('event', { foo: 'bar' }, channel.timeout * 2).receive('timeout', timeoutSpy)

    vi.advanceTimersByTime(channel.timeout / 2)
    expect(timeoutSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(channel.timeout * 2)
    expect(timeoutSpy).toHaveBeenCalled()
  })

  test("does not time out after receiving 'ok'", () => {
    channel.subscribe()
    channel.joinPush.trigger('ok', {})
    const timeoutSpy = vi.fn()
    const push = channel._push('event', { foo: 'bar' })
    push.receive('timeout', timeoutSpy)

    vi.advanceTimersByTime(push.timeout / 2)
    expect(timeoutSpy).not.toHaveBeenCalled()

    push.trigger('ok', {})

    vi.advanceTimersByTime(push.timeout)
    expect(timeoutSpy).not.toHaveBeenCalled()
  })

  test('throws if channel has not been joined', () => {
    assert.throws(() => channel._push('event', {}), /tried to push.*before joining/)
  })
})

describe('leave', () => {
  let socketSpy: any

  beforeEach(() => {
    testSetup.socket.disconnect()
    channel.unsubscribe()
    // Use testSetup.socket instead of creating new socket
    vi.spyOn(testSetup.socket, 'isConnected').mockImplementation(() => true)
    socketSpy = vi.spyOn(testSetup.socket, 'push')

    channel = testSetup.socket.channel('topic')
    channel.subscribe()
    channel.joinPush.trigger('ok', {})
  })

  test('unsubscribes from server events', () => {
    vi.spyOn(testSetup.socket, '_makeRef').mockImplementation(() => defaultRef)

    channel.unsubscribe()

    expect(socketSpy).toHaveBeenCalledWith({
      topic: 'realtime:topic',
      event: 'phx_leave',
      payload: {},
      ref: defaultRef,
      join_ref: defaultRef,
    })

    assert.equal(channel.state, CHANNEL_STATES.closed)
    assert.deepEqual(channel.pushBuffer, [])
  })

  test("closes channel on 'ok' from server", () => {
    const anotherChannel = testSetup.socket.channel('another')
    assert.equal(testSetup.socket.getChannels().length, 2)

    channel.unsubscribe()
    channel.joinPush.trigger('ok', {})

    assert.equal(testSetup.socket.getChannels().length, 1)
    assert.deepEqual(testSetup.socket.getChannels()[0], anotherChannel)
  })

  test("sets state to closed on 'ok' event", () => {
    assert.notEqual(channel.state, 'closed')

    channel.unsubscribe()
    channel.joinPush.trigger('ok', {})

    assert.equal(channel.state, 'closed')
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

  beforeEach(() => {
    testSetup.socket.disconnect()
    channel.unsubscribe()

    channel = testSetup.socket.channel('topic')
    joinPush = channel.joinPush

    channel.subscribe()
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
    test('sets channel state to errored', () => {
      assert.notEqual(channel.state, CHANNEL_STATES.errored)
      helpers.receiveTimeout()
      assert.equal(channel.state, CHANNEL_STATES.errored)
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
  let socket: RealtimeClient

  beforeEach(() => {
    socket = new RealtimeClient('ws://example.com/socket', {
      params: { apikey: '123456789' },
    })

    channel = testSetup.socket.channel('topic')
  })

  afterEach(() => {
    testSetup.socket.disconnect()
    channel.unsubscribe()
  })

  test('returns true when socket connected and channel joined', () => {
    vi.spyOn(testSetup.socket, 'isConnected').mockReturnValue(true)
    channel.state = CHANNEL_STATES.joined
    // Note: Testing private method - should be refactored in future
    expect((channel as any)._canPush()).toBeTruthy()
  })

  test('otherwise returns false', () => {
    const isConnectedStub = vi.spyOn(testSetup.socket, 'isConnected')

    isConnectedStub.mockReturnValue(false)
    channel.state = CHANNEL_STATES.joined
    expect((channel as any)._canPush()).toBeFalsy()

    isConnectedStub.mockReturnValue(true)
    channel.state = CHANNEL_STATES.joining
    expect((channel as any)._canPush()).toBeFalsy()

    isConnectedStub.mockReturnValue(false)
    channel.state = CHANNEL_STATES.joining
    expect((channel as any)._canPush()).toBeFalsy()
  })
})
