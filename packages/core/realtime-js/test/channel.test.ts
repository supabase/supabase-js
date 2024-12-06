import assert from 'assert'
import sinon from 'sinon'
import crypto from 'crypto'
import {
  describe,
  beforeEach,
  afterEach,
  test,
  beforeAll,
  afterAll,
  vi,
} from 'vitest'

import RealtimeClient from '../src/RealtimeClient'
import RealtimeChannel from '../src/RealtimeChannel'
import { Response } from '@supabase/node-fetch'
import Worker from 'web-worker'
import { Server, WebSocket } from 'mock-socket'

const defaultRef = '1'
const defaultTimeout = 1000

let channel: RealtimeChannel
let socket: RealtimeClient
let randomProjectRef = () => crypto.randomUUID()
let mockServer: Server
let projectRef: string
let url: string
let clock: sinon.SinonFakeTimers

beforeEach(() => {
  clock = sinon.useFakeTimers()

  projectRef = randomProjectRef()
  url = `wss://${projectRef}/socket`
  mockServer = new Server(url)
  socket = new RealtimeClient(url, {
    transport: WebSocket,
    timeout: defaultTimeout,
  })
})

afterEach(() => {
  vi.resetAllMocks()
  mockServer.stop()
  clock.restore()
})

describe('constructor', () => {
  test('sets defaults', () => {
    const socket = new RealtimeClient(url, {
      transport: WebSocket,
      timeout: 1234,
    })
    channel = new RealtimeChannel('topic', { config: {} }, socket)

    assert.equal(channel.state, 'closed')
    assert.equal(channel.topic, 'topic')
    assert.deepEqual(channel.params, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '' },
        private: false,
      },
    })
    assert.deepEqual(channel.socket, socket)
    assert.equal(channel.timeout, 1234)
    assert.equal(channel.joinedOnce, false)
    assert.ok(channel.joinPush)
    assert.deepEqual(channel.pushBuffer, [])
  })

  test('sets up joinPush object', () => {
    const socket = new RealtimeClient(url, {
      transport: WebSocket,
      timeout: 1234,
    })

    channel = new RealtimeChannel('topic', { config: {} }, socket)
    const joinPush = channel.joinPush

    assert.deepEqual(joinPush.channel, channel)
    assert.deepEqual(joinPush.payload, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '' },
        private: false,
      },
    })
    assert.equal(joinPush.event, 'phx_join')
    assert.equal(joinPush.timeout, 1234)
  })
  test('sets up joinPush object with private defined', () => {
    const socket = new RealtimeClient(url, {
      transport: WebSocket,
      timeout: 1234,
    })
    channel = new RealtimeChannel(
      'topic',
      { config: { private: true } },
      socket
    )
    const joinPush = channel.joinPush

    assert.deepEqual(joinPush.channel, channel)
    assert.deepEqual(joinPush.payload, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '' },
        private: true,
      },
    })
    assert.equal(joinPush.event, 'phx_join')
    assert.equal(joinPush.timeout, 1234)
  })
})

describe('subscribe', () => {
  beforeEach(() => {
    channel = socket.channel('topic', { one: 'two' })
  })

  afterEach(() => {
    channel.unsubscribe()
  })

  test('sets state to joining', () => {
    channel.subscribe()
    assert.equal(channel.state, 'joining')
  })

  test('sets joinedOnce to true', () => {
    assert.ok(!channel.joinedOnce)
    channel.subscribe()
    assert.ok(channel.joinedOnce)
  })

  test('throws if attempting to join multiple times', () => {
    channel.subscribe()

    assert.throws(
      () => channel.subscribe(),
      /tried to subscribe multiple times/
    )
  })

  test('updates join push payload access token', () => {
    socket.accessTokenValue = 'token123'

    channel.subscribe()

    assert.deepEqual(channel.joinPush.payload, {
      access_token: 'token123',
      config: {
        broadcast: {
          ack: false,
          self: false,
        },
        presence: {
          key: '',
        },
        postgres_changes: [],
        private: false,
      },
      one: 'two',
    })
  })

  test('triggers socket push with default channel params', () => {
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)
    const spy = sinon.spy(socket, 'push')
    const cbSpy = sinon.spy()

    channel.subscribe(cbSpy)

    const cb = channel.bindings['chan_reply_1'][0].callback
    cb({ status: 'ok', response: { postgres_changes: undefined } })

    assert.ok(spy.calledOnce)
    assert.ok(
      spy.calledWith({
        topic: 'realtime:topic',
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '' },
            postgres_changes: [],
            private: false,
          },
          one: 'two',
        },
        ref: defaultRef,
        join_ref: defaultRef,
      })
    )
    assert.ok(cbSpy.calledWith('SUBSCRIBED'))
  })

  test('triggers socket push with postgres_changes channel params with correct server resp', () => {
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)
    const spy = sinon.spy(socket, 'push')
    const cbSpy = sinon.spy()
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

    assert.ok(spy.calledOnce)
    assert.ok(
      spy.calledWith({
        topic: 'realtime:topic',
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '' },
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
          one: 'two',
        },
        ref: defaultRef,
        join_ref: defaultRef,
      })
    )
    assert.ok(cbSpy.calledWith('SUBSCRIBED'))
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

  test('unsubscribes to channel with incorrect server postgres_changes resp', () => {
    const unsubscribeSpy = sinon.spy(channel, 'unsubscribe')
    const cbSpy = sinon.spy()
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
      response: { postgres_changes: [{ id: 'abc', event: '*', schema: '*' }] },
    })

    assert.ok(unsubscribeSpy.calledOnce)
    assert.ok(
      cbSpy.calledWith(
        'CHANNEL_ERROR',
        sinon.match({
          message:
            'mismatch between server and client bindings for postgres changes',
        })
      )
    )
  })

  test('can set timeout on joinPush', () => {
    const newTimeout = 2000
    const joinPush = channel.joinPush

    assert.equal(joinPush.timeout, defaultTimeout)

    channel.subscribe(() => {}, newTimeout)

    assert.equal(joinPush.timeout, newTimeout)
  })

  test('updates channel joinPush payload', () => {
    const payloadStub = sinon.stub(channel.joinPush, 'updatePayload')

    channel.updateJoinPayload({ access_token: 'token123' })

    assert.ok(payloadStub.calledWith({ access_token: 'token123' }))
  })

  describe('timeout behavior', () => {
    test('succeeds before timeout', () => {
      const spy = sinon.spy(socket, 'push')

      socket.connect()
      channel.subscribe()
      assert.equal(spy.callCount, 1)

      clock.tick(defaultTimeout / 2)

      channel.joinPush.trigger('ok', {})

      assert.equal(channel.state, 'joined')

      clock.tick(defaultTimeout / 2)
      assert.equal(spy.callCount, 1)
    })
  })
})

describe('joinPush', () => {
  let joinPush, response

  const helpers = {
    receiveOk() {
      clock.tick(joinPush.timeout / 2) // before timeout
      joinPush.trigger('ok', response)
    },

    receiveTimeout() {
      clock.tick(joinPush.timeout * 2) // after timeout
    },

    receiveError() {
      clock.tick(joinPush.timeout / 2) // before timeout
      joinPush.trigger('error', response)
    },

    getBindings(type) {
      return channel.bindings[type].filter((bind) => bind.type === type)
    },
  }

  beforeEach(() => {
    channel = socket.channel('topic', { one: 'two' })
    joinPush = channel.joinPush

    channel.subscribe()
  })

  afterEach(() => {
    socket.disconnect()
    channel.unsubscribe()
  })

  describe("receives 'ok'", () => {
    beforeEach(() => {
      response = { chan: 'reply' }
    })

    test('sets channel state to joined', () => {
      assert.notEqual(channel.state, 'joined')
      helpers.receiveOk()
      assert.equal(channel.state, 'joined')
    })

    test("triggers receive('ok') callback after ok response", () => {
      const spyOk = sinon.spy()
      joinPush.receive('ok', spyOk)
      helpers.receiveOk()
      assert.ok(spyOk.calledOnce)
    })

    test("triggers receive('ok') callback if ok response already received", () => {
      const spyOk = sinon.spy()
      helpers.receiveOk()
      joinPush.receive('ok', spyOk)
      assert.ok(spyOk.calledOnce)
    })

    test('does not trigger other receive callbacks after ok response', () => {
      const spyError = sinon.spy()
      const spyTimeout = sinon.spy()

      joinPush.receive('error', spyError).receive('timeout', spyTimeout)

      helpers.receiveOk()
      clock.tick(channel.timeout * 2) // attempt timeout

      assert.ok(!spyError.called)
      assert.ok(!spyTimeout.called)
    })

    test('clears timeoutTimer', () => {
      assert.ok(joinPush.timeoutTimer)

      helpers.receiveOk()

      assert.equal(joinPush.timeoutTimer, null)
    })

    test('sets receivedResp', () => {
      assert.equal(joinPush.receivedResp, null)

      helpers.receiveOk()

      assert.deepEqual(joinPush.receivedResp, { status: 'ok', response })
    })

    test('removes channel bindings', () => {
      let bindings = helpers.getBindings('chan_reply_1')
      assert.equal(bindings.length, 1)

      helpers.receiveOk()

      bindings = helpers.getBindings('chan_reply_1')
      assert.equal(bindings.length, 0)
    })

    test('sets channel state to joined', () => {
      helpers.receiveOk()
      assert.equal(channel.state, 'joined')
    })

    test('resets channel rejoinTimer', () => {
      assert.ok(channel.rejoinTimer)
      const spy = sinon.spy(channel.rejoinTimer, 'reset')
      helpers.receiveOk()
      assert.ok(spy.calledOnce)
    })

    test("sends and empties channel's buffered pushEvents", () => {
      const pushEvent: any = { send() {} }
      const spy = sinon.spy(pushEvent, 'send')
      channel.pushBuffer.push(pushEvent)
      helpers.receiveOk()
      assert.equal(channel.state, 'joined')
      assert.ok(spy.calledOnce)
      assert.equal(channel.pushBuffer.length, 0)
    })
  })

  describe("receives 'timeout'", () => {
    test('sets channel state to errored', () => {
      helpers.receiveTimeout()

      assert.equal(channel.state, 'errored')
    })

    test("triggers receive('timeout') callback after ok response", () => {
      const spyTimeout = sinon.spy()

      joinPush.receive('timeout', spyTimeout)

      helpers.receiveTimeout()

      assert.ok(spyTimeout.calledOnce)
    })

    test("triggers receive('timeout') callback if already timed out", () => {
      const spyTimeout = sinon.spy()

      helpers.receiveTimeout()

      joinPush.receive('timeout', spyTimeout)

      assert.ok(spyTimeout.calledOnce)
    })

    test('does not trigger other receive callbacks after timeout response', () => {
      const spyOk = sinon.spy()
      const spyError = sinon.spy()

      joinPush.receive('ok', spyOk).receive('error', spyError)

      helpers.receiveTimeout()
      helpers.receiveOk()

      assert.ok(!spyOk.called)
      assert.ok(!spyError.called)
    })

    test('schedules rejoinTimer timeout', () => {
      assert.ok(channel.rejoinTimer)

      const spy = sinon.spy(channel.rejoinTimer, 'scheduleTimeout')

      helpers.receiveTimeout()

      assert.ok(spy.called) // TODO why called multiple times?
    })

    test('cannot send after timeout', () => {
      const spy = sinon.spy(socket, 'push')

      helpers.receiveTimeout()

      joinPush.send()

      assert.ok(!spy.called)
    })

    test('sets receivedResp', () => {
      assert.equal(joinPush.receivedResp, null)

      helpers.receiveTimeout()

      assert.deepEqual(joinPush.receivedResp, {
        status: 'timeout',
        response: {},
      })
    })
  })

  describe("receives 'error'", () => {
    beforeEach(() => {
      response = { chan: 'fail' }
    })

    test("triggers receive('error') callback after error response", () => {
      const spyError = sinon.spy()

      joinPush.receive('error', spyError)

      helpers.receiveError()

      assert.ok(spyError.calledOnce)
    })

    test("triggers receive('error') callback if error response already received", () => {
      const spyError = sinon.spy()

      helpers.receiveError()

      joinPush.receive('error', spyError)

      assert.ok(spyError.calledOnce)
    })

    test('does not trigger other receive callbacks after ok response', () => {
      const spyOk = sinon.spy()
      const spyTimeout = sinon.spy()

      joinPush.receive('ok', spyOk).receive('timeout', spyTimeout)

      helpers.receiveError()
      clock.tick(channel.timeout * 2) // attempt timeout

      assert.ok(!spyOk.called)
      assert.ok(!spyTimeout.called)
    })

    test('clears timeoutTimer', () => {
      assert.ok(joinPush.timeoutTimer)

      helpers.receiveError()

      assert.equal(joinPush.timeoutTimer, null)
    })

    test('sets receivedResp', () => {
      assert.equal(joinPush.receivedResp, null)

      helpers.receiveError()

      assert.deepEqual(joinPush.receivedResp, { status: 'error', response })
    })

    test('removes channel bindings', () => {
      let bindings = helpers.getBindings('chan_reply_1')
      assert.equal(bindings.length, 1)

      helpers.receiveError()

      bindings = helpers.getBindings('chan_reply_1')
      assert.equal(bindings.length, 0)
    })

    test('does not set channel state to joined', () => {
      helpers.receiveError()
      assert.equal(channel.state, 'errored')
    })

    test("does not trigger channel's buffered pushEvents", () => {
      const pushEvent = { send: () => {} }
      const spy = sinon.spy(pushEvent, 'send')

      channel.pushBuffer.push(pushEvent)

      helpers.receiveError()

      assert.ok(!spy.called)
      assert.equal(channel.pushBuffer.length, 1)
    })
  })
})

describe('onError', () => {
  let joinPush

  beforeEach(() => {
    socket = new RealtimeClient('ws://example.com/socket', {
      timeout: defaultTimeout,
    })
    sinon.stub(socket, 'isConnected').callsFake(() => true)
    sinon.stub(socket, 'push').callsFake(() => true)

    channel = socket.channel('topic', { one: 'two' })

    joinPush = channel.joinPush

    channel.subscribe()
  })

  afterEach(() => {
    socket.disconnect()
    channel.unsubscribe()
  })

  test("sets state to 'errored'", () => {
    assert.notEqual(channel.state, 'errored')

    channel._trigger('phx_error')

    assert.equal(channel.state, 'errored')
  })

  test('tries to rejoin with backoff', () => {
    const leaveTopicSpy = sinon.stub(socket, '_leaveOpenTopic')
    const spy = sinon.stub(joinPush, 'send')

    assert.equal(spy.callCount, 0)

    channel._trigger('phx_error')

    clock.tick(1000)
    assert.equal(spy.callCount, 1)

    clock.tick(2000)
    assert.equal(spy.callCount, 2)

    clock.tick(5000)
    assert.equal(spy.callCount, 3)

    clock.tick(10000)
    assert.equal(spy.callCount, 4)

    assert.equal(leaveTopicSpy.callCount, 4)
  })

  test('does not rejoin if channel leaving', () => {
    channel.state = 'leaving'

    const spy = sinon.stub(joinPush, 'send')

    channel._trigger('phx_error')

    clock.tick(1000)
    assert.equal(spy.callCount, 0)

    clock.tick(2000)
    assert.equal(spy.callCount, 0)

    assert.equal(channel.state, 'leaving')
  })

  test('does not rejoin if channel closed', () => {
    channel.state = 'closed'

    const spy = sinon.stub(joinPush, 'send')

    channel._trigger('phx_error')

    clock.tick(1000)
    assert.equal(spy.callCount, 0)

    clock.tick(2000)
    assert.equal(spy.callCount, 0)

    assert.equal(channel.state, 'closed')
  })

  test('triggers additional callbacks', () => {
    const spy = sinon.spy()
    channel._onError(spy)

    assert.equal(spy.callCount, 0)

    channel._trigger('phx_error')

    assert.equal(spy.callCount, 1)
  })
})

describe('onClose', () => {
  let joinPush

  beforeEach(() => {
    socket = new RealtimeClient('ws://example.com/socket', {
      timeout: defaultTimeout,
    })
    sinon.stub(socket, 'isConnected').callsFake(() => true)
    sinon.stub(socket, 'push').callsFake(() => true)

    channel = socket.channel('topic', { one: 'two' })

    joinPush = channel.joinPush

    channel.subscribe()
  })

  afterEach(() => {
    socket.disconnect()
    channel.unsubscribe()
  })

  test("sets state to 'closed'", () => {
    assert.notEqual(channel.state, 'closed')

    channel._trigger('phx_close')

    assert.equal(channel.state, 'closed')
  })

  test('does not rejoin', () => {
    const spy = sinon.stub(joinPush, 'send')

    channel._trigger('phx_close')

    clock.tick(1000)
    assert.equal(spy.callCount, 0)

    clock.tick(2000)
    assert.equal(spy.callCount, 0)
  })

  test('triggers additional callbacks', () => {
    const spy = sinon.spy()
    channel._onClose(spy)

    assert.equal(spy.callCount, 0)

    channel._trigger('phx_close')

    assert.equal(spy.callCount, 1)
  })

  test('removes channel from socket', () => {
    assert.equal(socket.channels.length, 1)
    assert.deepEqual(socket.channels[0], channel)

    channel._trigger('phx_close')

    assert.equal(socket.channels.length, 0)
  })
})

describe('onMessage', () => {
  beforeEach(() => {
    socket = new RealtimeClient('ws://example.com/socket')

    channel = socket.channel('topic', { one: 'two' })
  })

  afterEach(() => {
    socket.disconnect()
    channel.unsubscribe()
  })

  test('returns payload by default', () => {
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)
    const payload = channel._onMessage('event', { one: 'two' }, defaultRef)

    assert.deepEqual(payload, { one: 'two' })
  })
})

describe('canPush', () => {
  beforeEach(() => {
    socket = new RealtimeClient('ws://example.com/socket')

    channel = socket.channel('topic', { one: 'two' })
  })

  afterEach(() => {
    socket.disconnect()
    channel.unsubscribe()
  })

  test('returns true when socket connected and channel joined', () => {
    sinon.stub(socket, 'isConnected').returns(true)
    channel.state = 'joined'

    assert.ok(channel._canPush())
  })

  test('otherwise returns false', () => {
    const isConnectedStub = sinon.stub(socket, 'isConnected')

    isConnectedStub.returns(false)
    channel.state = 'joined'

    assert.ok(!channel._canPush())

    isConnectedStub.returns(true)
    channel.state = 'joining'

    assert.ok(!channel._canPush())

    isConnectedStub.returns(false)
    channel.state = 'joining'

    assert.ok(!channel._canPush())
  })
})

describe('on', () => {
  beforeEach(() => {
    socket = new RealtimeClient('ws://example.com/socket')
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)

    channel = socket.channel('topic', { one: 'two' })
  })

  afterEach(() => {
    socket.disconnect()
    channel.unsubscribe()
  })

  test('sets up callback for event', () => {
    const spy = sinon.spy()

    channel._trigger('event', {}, defaultRef)
    assert.ok(!spy.called)

    channel.on('event', {}, spy)

    channel._trigger('event', {}, defaultRef)

    assert.ok(spy.called)
  })

  test('other event callbacks are ignored', () => {
    const spy = sinon.spy()
    const ignoredSpy = sinon.spy()

    channel._trigger('event', {}, defaultRef)

    assert.ok(!ignoredSpy.called)

    channel.on('event', {}, spy)
    channel.on('otherEvent', {}, ignoredSpy)

    channel._trigger('event', {}, defaultRef)

    assert.ok(!ignoredSpy.called)
  })

  test('"*" bind all events', () => {
    const spy = sinon.spy()

    channel._trigger('realtime', { event: 'INSERT' }, defaultRef)
    assert.ok(!spy.called)

    channel.on('realtime', { event: 'INSERT' }, spy)
    channel._trigger('realtime', { event: 'INSERT' }, defaultRef)
    assert.ok(spy.called)
  })
})

describe('off', () => {
  beforeEach(() => {
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)
    channel = socket.channel('topic', { one: 'two' })
  })

  afterEach(() => {
    channel.unsubscribe()
  })

  test('removes all callbacks for event', () => {
    const spy1 = sinon.spy()
    const spy2 = sinon.spy()
    const spy3 = sinon.spy()

    channel.on('event', {}, spy1)
    channel.on('event', {}, spy2)
    channel.on('other', {}, spy3)

    channel._off('event', {})

    channel._trigger('event', {}, defaultRef)
    channel._trigger('other', {}, defaultRef)

    assert.ok(!spy1.called)
    assert.ok(!spy2.called)
    assert.ok(spy3.called)
  })
})

describe('push', () => {
  let socketSpy

  const pushParams = {
    topic: 'realtime:topic',
    event: 'event',
    payload: { foo: 'bar' },
    ref: defaultRef,
    join_ref: defaultRef,
  }

  beforeEach(() => {
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)
    sinon.stub(socket, 'isConnected').callsFake(() => true)
    socketSpy = sinon.stub(socket, 'push')

    channel = socket.channel('topic', { one: 'two' })
  })

  afterEach(() => {
    channel.unsubscribe()
  })

  test('sends push event when successfully joined', () => {
    channel.subscribe()
    channel.joinPush.trigger('ok', {})
    channel._push('event', { foo: 'bar' })

    assert.ok(socketSpy.calledWith(pushParams))
  })

  test('enqueues push event to be sent once join has succeeded', () => {
    channel.subscribe()
    channel._push('event', { foo: 'bar' })

    assert.ok(!socketSpy.calledWith(pushParams))

    clock.tick(channel.timeout / 2)
    channel.joinPush.trigger('ok', {})

    assert.ok(socketSpy.calledWith(pushParams))
  })

  test('does not push if channel join times out', () => {
    channel.subscribe()
    channel._push('event', { foo: 'bar' })

    assert.ok(!socketSpy.calledWith(pushParams))

    clock.tick(channel.timeout * 2)
    channel.joinPush.trigger('ok', {})

    assert.ok(!socketSpy.calledWith(pushParams))
  })

  test('uses channel timeout by default', () => {
    const timeoutSpy = sinon.spy()
    channel.subscribe()
    channel.joinPush.trigger('ok', {})

    channel._push('event', { foo: 'bar' }).receive('timeout', timeoutSpy)

    clock.tick(channel.timeout / 2)
    assert.ok(!timeoutSpy.called)

    clock.tick(channel.timeout)
    assert.ok(timeoutSpy.called)
  })

  test('accepts timeout arg', () => {
    const timeoutSpy = sinon.spy()
    channel.subscribe()
    channel.joinPush.trigger('ok', {})

    channel
      ._push('event', { foo: 'bar' }, channel.timeout * 2)
      .receive('timeout', timeoutSpy)

    clock.tick(channel.timeout / 2)
    assert.equal(timeoutSpy.called, false)

    clock.tick(channel.timeout * 2)
    assert.ok(timeoutSpy.called)
  })

  test("does not time out after receiving 'ok'", () => {
    channel.subscribe()
    channel.joinPush.trigger('ok', {})
    const timeoutSpy = sinon.spy()
    const push = channel._push('event', { foo: 'bar' })
    push.receive('timeout', timeoutSpy)

    clock.tick(push.timeout / 2)
    assert.ok(!timeoutSpy.called)

    push.trigger('ok', {})

    clock.tick(push.timeout)
    assert.ok(!timeoutSpy.called)
  })

  test('throws if channel has not been joined', () => {
    assert.throws(
      () => channel._push('event', {}),
      /tried to push.*before joining/
    )
  })
})

describe('leave', () => {
  let socketSpy

  beforeEach(() => {
    socket = new RealtimeClient('ws://example.com/socket', {
      timeout: defaultTimeout,
    })
    sinon.stub(socket, 'isConnected').callsFake(() => true)
    socketSpy = sinon.stub(socket, 'push')

    channel = socket.channel('topic', { one: 'two' })
    channel.subscribe()
    channel.joinPush.trigger('ok', {})
  })

  afterEach(() => {
    socket.disconnect()
    channel.unsubscribe()
  })

  test('unsubscribes from server events', () => {
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)

    channel.unsubscribe()

    assert.ok(
      socketSpy.calledWith({
        topic: 'realtime:topic',
        event: 'phx_leave',
        payload: {},
        ref: defaultRef,
        join_ref: defaultRef,
      })
    )
  })

  test("closes channel on 'ok' from server", () => {
    const anotherChannel = socket.channel('another', { three: 'four' })
    assert.equal(socket.channels.length, 2)

    channel.unsubscribe()
    channel.joinPush.trigger('ok', {})

    assert.equal(socket.channels.length, 1)
    assert.deepEqual(socket.channels[0], anotherChannel)
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
    clock.tick(channel.timeout)
    assert.equal(channel.state, 'closed')
  })

  // TODO - this tests needs a better approach as the current approach does not test the Push event timeout
  // This might be better to be an integration test or a test in the Push class
  test('accepts timeout arg', () => {
    channel.unsubscribe(10000)
    clock.tick(channel.timeout)
    assert.equal(channel.state, 'closed')
  })
})

describe('presence helper methods', () => {
  beforeEach(() => {
    channel = socket.channel('topic', { one: 'two' })
  })

  test('gets presence state', () => {
    channel.presence.state = { u1: [{ id: 1, presence_ref: '1' }] }

    assert.deepEqual(channel.presenceState(), {
      u1: [{ id: 1, presence_ref: '1' }],
    })
  })

  test('tracks presence', () => {
    const sendStub = sinon.stub(channel, 'send')

    channel.track({ id: 123 })

    assert.ok(
      sendStub.calledWith({
        type: 'presence',
        event: 'track',
        payload: { id: 123 },
      })
    )
  })

  test('untracks presence', () => {
    const sendStub = sinon.stub(channel, 'send')

    channel.untrack()

    assert.ok(sendStub.calledWith({ type: 'presence', event: 'untrack' }))
  })
})

describe('send', () => {
  test('sends message via ws conn when subscribed to channel', async () => {
    let subscribed = false
    socket.connect()
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(1)
    const new_channel = socket.channel('topic', { config: { private: true } })
    const pushStub = sinon.stub(new_channel, '_push')

    new_channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        subscribed = true
        await new_channel.send({ type: 'broadcast', event: 'test' })
      }
    })
    new_channel.joinPush.trigger('ok', {})

    await vi.waitFor(
      () => {
        if (subscribed) return true
        else throw new Error('did not subscribe')
      },
      { timeout: 3000 }
    )
    assert.ok(pushStub.calledOnce)
    assert.ok(
      pushStub.calledWith('broadcast', { type: 'broadcast', event: 'test' })
    )
  })

  test('tries to send message via ws conn when subscribed to channel but times out', async () => {
    let timed_out = false
    socket.connect()
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(1)
    const new_channel = socket.channel('topic', { config: { private: true } })
    const pushStub = sinon.stub(new_channel, '_push')

    new_channel.subscribe(async (status) => {
      if (status === 'TIMED_OUT') {
        timed_out = true
      }
    })
    new_channel.joinPush.trigger('timeout', {})

    await vi.waitFor(
      () => {
        if (timed_out) return true
        else throw new Error('did not time out')
      },
      { timeout: 3000 }
    )
    assert.equal(pushStub.callCount, 0)
  })

  test('sends message via http request to Broadcast endpoint when not subscribed to channel', async () => {
    const fetchStub = sinon.stub().resolves(new Response())
    const socket = new RealtimeClient(url, {
      fetch: fetchStub as unknown as typeof fetch,
      timeout: defaultTimeout,
      params: { apikey: 'abc123' },
    })
    socket.setAuth()
    const channel = socket.channel('topic', { config: { private: true } })

    const expectedBody = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer abc123',
        apikey: 'abc123',
        'Content-Type': 'application/json',
      },
      body: '{"messages":[{"topic":"topic","event":"test","private":true}]}',
      signal: new AbortController().signal,
    }

    const expectedUrl = url
      .replace('/socket', '')
      .replace('wss', 'https')
      .concat('/api/broadcast')

    const res = await channel.send({
      type: 'broadcast',
      event: 'test',
      id: 'u123',
    })

    assert.equal(res, 'ok')
    assert.ok(fetchStub.calledOnce)
    assert.ok(fetchStub.calledWith(expectedUrl, expectedBody))
  })
})

describe('trigger', () => {
  let spy

  beforeEach(() => {
    channel = socket.channel('topic', { one: 'two' })
  })

  test('triggers when type is insert, update, delete', () => {
    spy = sinon.spy()

    channel.bindings.postgres_changes = [
      { type: 'postgres_changes', filter: { event: 'INSERT' }, callback: spy },
      { type: 'postgres_changes', filter: { event: 'UPDATE' }, callback: spy },
      { type: 'postgres_changes', filter: { event: 'DELETE' }, callback: spy },
      { type: 'postgres_changes', filter: { event: '*' }, callback: spy },
    ]

    channel._trigger('insert', { test: '123' }, '1')
    channel._trigger('update', { test: '123' }, '2')
    channel._trigger('delete', { test: '123' }, '3')

    assert.equal(spy.getCalls().length, 6)
  })

  test('triggers when type is broadcast', () => {
    spy = sinon.spy()

    channel.bindings.broadcast = [
      { type: 'broadcast', filter: { event: '*' }, callback: spy },
      { type: 'broadcast', filter: { event: 'test' }, callback: spy },
    ]

    channel._trigger('broadcast', { event: 'test', id: '123' }, '1')

    assert.ok(spy.calledTwice)
    assert.ok(spy.calledWith({ event: 'test', id: '123' }, '1'))
  })

  test('triggers when type is presence', () => {
    spy = sinon.spy()

    channel.bindings.presence = [
      { type: 'presence', filter: { event: 'sync' }, callback: spy },
      { type: 'presence', filter: { event: 'join' }, callback: spy },
      { type: 'presence', filter: { event: 'leave' }, callback: spy },
    ]

    channel._trigger('presence', { event: 'sync' }, '1')
    channel._trigger('presence', { event: 'join' }, '2')
    channel._trigger('presence', { event: 'leave' }, '3')

    assert.ok(spy.calledThrice)
  })

  test('triggers when type is postgres_changes', () => {
    spy = sinon.spy()

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

    assert.ok(
      spy.calledWith(
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
    )
  })

  test('sets apikey as initial accessToken', () => {
    const client = new RealtimeClient('ws://example.com/socket', {
      timeout: defaultTimeout,
      params: { apikey: '123' },
    })
    assert.equal(client.accessTokenValue, '123')
  })
})

describe('worker', () => {
  let client: RealtimeClient
  let mockServer: Server

  beforeAll(() => {
    window.Worker = Worker
    projectRef = randomProjectRef()
    url = `wss://${projectRef}/socket`
    mockServer = new Server(url)
  })

  afterAll(() => {
    window.Worker = undefined
    mockServer.close()
  })

  beforeEach(() => {
    client = new RealtimeClient('ws://localhost:8080/socket', {
      worker: true,
      workerUrl: 'https://realtime.supabase.com/worker.js',
      heartbeatIntervalMs: 10,
    })
  })

  test('sets worker flag', () => {
    assert.ok(client.worker)
  })

  test('sets worker URL', () => {
    assert.equal(client.workerUrl, 'https://realtime.supabase.com/worker.js')
  })
})
