import assert from 'assert'
import sinon from 'sinon'

import { RealtimeChannel, RealtimeClient } from '../dist/main'

let channel, socket

const defaultRef = '1'
const defaultTimeout = 10000

describe('constructor', () => {
  beforeEach(() => {
    socket = new RealtimeClient('ws://example.com/socket', { timeout: 1234 })
  })

  afterEach(() => {
    socket.disconnect()
    channel.unsubscribe()
  })

  it('sets defaults', () => {
    channel = new RealtimeChannel('topic', { one: 'two' }, socket)

    assert.equal(channel.state, 'closed')
    assert.equal(channel.topic, 'topic')
    assert.deepEqual(channel.params, { config: { broadcast: { ack: false, self: false }, presence: { key: '' } }, one: 'two' })
    assert.deepEqual(channel.socket, socket)
    assert.equal(channel.timeout, 1234)
    assert.equal(channel.joinedOnce, false)
    assert.ok(channel.joinPush)
    assert.deepEqual(channel.pushBuffer, [])
  })

  it('sets up joinPush object', () => {
    channel = new RealtimeChannel('topic', { one: 'two' }, socket)
    const joinPush = channel.joinPush

    assert.deepEqual(joinPush.channel, channel)
    assert.deepEqual(joinPush.payload, { config: { broadcast: { ack: false, self: false }, presence: { key: '' } }, one: 'two' })
    assert.equal(joinPush.event, 'phx_join')
    assert.equal(joinPush.timeout, 1234)
  })
})

describe('subscribe', () => {
  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket', { timeout: defaultTimeout })

    channel = socket.channel('topic', { one: 'two' })
  })

  afterEach(() => {
    socket.disconnect()
    channel.unsubscribe()
  })

  it('sets state to joining', () => {
    channel.subscribe()

    assert.equal(channel.state, 'joining')
  })

  it('sets joinedOnce to true', () => {
    assert.ok(!channel.joinedOnce)

    channel.subscribe()

    assert.ok(channel.joinedOnce)
  })

  it('throws if attempting to join multiple times', () => {
    channel.subscribe()

    assert.throws(() => channel.subscribe(), /tried to subscribe multiple times/)
  })

  it ('updates join push payload access token', () => {
    socket.accessToken = 'token123'

    channel.subscribe()

    assert.deepEqual(channel.joinPush.payload, {
      access_token: 'token123',
      config: {
        broadcast: {
          ack: false,
          self: false
        },
        presence: {
          key: ''
        },
        postgres_changes: []
      },
      one: 'two'
    })
  })

  it('triggers socket push with default channel params', () => {
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)
    const spy = sinon.spy(socket, 'push')
    const cbSpy = sinon.spy()

    channel.subscribe(cbSpy)

    const cb = channel.bindings['chan_reply_1'][0].callback
    cb({ status: 'ok', response: { postgres_changes: undefined }})

    assert.ok(spy.calledOnce)
    assert.ok(
      spy.calledWith({
        topic: 'realtime:topic',
        event: 'phx_join',
        payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: [] }, one: 'two' },
        ref: defaultRef,
        join_ref: defaultRef
      })
    )
    assert.ok(cbSpy.calledWith('SUBSCRIBED'))
  })

  it('triggers socket push with postgres_changes channel params with correct server resp', () => {
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)
    const spy = sinon.spy(socket, 'push')
    const cbSpy = sinon.spy()
    const func = () => {}

    channel.bindings.postgres_changes = [
      { type: 'postgres_changes', filter: { event: '*', schema: '*' }, callback: func},
      { type: 'postgres_changes', filter: { event: 'INSERT', schema: 'public', table: 'test' }, callback: func},
      { type: 'postgres_changes', filter: { event: 'UPDATE', schema: 'public', table: 'test', filter: 'id=eq.1' }, callback: func}
    ]
    channel.subscribe(cbSpy)

    const cb = channel.bindings['chan_reply_1'][0].callback
    cb({ status: 'ok', response: { postgres_changes: [{ id: 'abc', event: '*', schema: '*' }, { id: 'def', event: 'INSERT', schema: 'public', table: 'test' }, { id: 'ghi', event: 'UPDATE', schema: 'public', table: 'test', filter: 'id=eq.1' }] }})

    assert.ok(spy.calledOnce)
    assert.ok(
      spy.calledWith({
        topic: 'realtime:topic',
        event: 'phx_join',
        payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: [{ event: '*', schema: '*' }, { event: 'INSERT', schema: 'public', table: 'test' }, { event: 'UPDATE', schema: 'public', table: 'test', filter: 'id=eq.1' }] }, one: 'two' },
        ref: defaultRef,
        join_ref: defaultRef
      })
    )
    assert.ok(cbSpy.calledWith('SUBSCRIBED'))
    assert.deepEqual(channel.bindings.postgres_changes, [
      { id: 'abc', type: 'postgres_changes', filter: { event: '*', schema: '*' }, callback: func},
      { id: 'def', type: 'postgres_changes', filter: { event: 'INSERT', schema: 'public', table: 'test' }, callback: func},
      { id: 'ghi', type: 'postgres_changes', filter: { event: 'UPDATE', schema: 'public', table: 'test', filter: 'id=eq.1' }, callback: func}
    ])
  })

  it('unsubscribes to channel with incorrect server postgres_changes resp', () => {
    const unsubscribeSpy = sinon.spy(channel, 'unsubscribe')
    const cbSpy = sinon.spy()
    const func = () => {}

    channel.bindings.postgres_changes = [
      { type: 'postgres_changes', filter: { event: '*', schema: '*' }, callback: func},
      { type: 'postgres_changes', filter: { event: 'INSERT', schema: 'public', table: 'test' }, callback: func},
      { type: 'postgres_changes', filter: { event: 'UPDATE', schema: 'public', table: 'test', filter: 'id=eq.1' }, callback: func}
    ]
    channel.subscribe(cbSpy)

    const cb = channel.bindings['chan_reply_1'][0].callback
    cb({ status: 'ok', response: { postgres_changes: [{ id: 'abc', event: '*', schema: '*' }] }})

    assert.ok(unsubscribeSpy.calledOnce)
    assert.ok(cbSpy.calledWith('CHANNEL_ERROR', sinon.match({ message: 'mismatch between server and client bindings for postgres changes' })))
  })

  it('can set timeout on joinPush', () => {
    const newTimeout = 2000
    const joinPush = channel.joinPush

    assert.equal(joinPush.timeout, defaultTimeout)

    channel.subscribe(() => {}, newTimeout)

    assert.equal(joinPush.timeout, newTimeout)
  })

  it('updates channel joinPush payload', () => {
    const payloadStub = sinon.stub(channel.joinPush, 'updatePayload')

    channel.updateJoinPayload({ access_token: 'token123' })

    assert.ok(payloadStub.calledWith({ access_token: 'token123' }))
  })

  describe('timeout behavior', () => {
    let clock, joinPush

    const helpers = {
      receiveSocketOpen() {
        sinon.stub(socket, 'isConnected', () => true)
        socket.onConnOpen()
      },
    }

    beforeEach(() => {
      clock = sinon.useFakeTimers()
      joinPush = channel.joinPush
    })

    afterEach(() => {
      clock.restore()
    })

    // TODO: fix
    it.skip('succeeds before timeout', () => {
      const spy = sinon.spy(socket, 'push')
      const timeout = joinPush.timeout

      socket.connect()
      helpers.receiveSocketOpen()

      channel.subscribe()
      assert.equal(spy.callCount, 1)

      clock.tick(timeout / 2)

      joinPush.trigger('ok', {})

      assert.equal(channel.state, 'joined')

      clock.tick(timeout)
      assert.equal(spy.callCount, 1)
    })
  })
})

describe('joinPush', () => {
  let joinPush, clock, response

  const helpers = {
    receiveOk() {
      clock.tick(joinPush.timeout / 2) // before timeout
      return joinPush.trigger('ok', response)
    },

    receiveTimeout() {
      clock.tick(joinPush.timeout * 2) // after timeout
    },

    receiveError() {
      clock.tick(joinPush.timeout / 2) // before timeout
      return joinPush.trigger('error', response)
    },

    getBindings(type) {
      return channel.bindings[type].filter((bind) => bind.type === type)
    },
  }

  beforeEach(() => {
    clock = sinon.useFakeTimers()

    socket = new RealtimeClient('ws://example.com/socket', { timeout: defaultTimeout })

    channel = socket.channel('topic', { one: 'two' })
    joinPush = channel.joinPush

    channel.subscribe()
  })

  afterEach(() => {
    clock.restore()
    socket.disconnect()
    channel.unsubscribe()
  })

  describe("receives 'ok'", () => {
    beforeEach(() => {
      response = { chan: 'reply' }
    })

    it('sets channel state to joined', () => {
      assert.notEqual(channel.state, 'joined')

      helpers.receiveOk()

      assert.equal(channel.state, 'joined')
    })

    it("triggers receive('ok') callback after ok response", () => {
      const spyOk = sinon.spy()

      joinPush.receive('ok', spyOk)

      helpers.receiveOk()

      assert.ok(spyOk.calledOnce)
    })

    it("triggers receive('ok') callback if ok response already received", () => {
      const spyOk = sinon.spy()

      helpers.receiveOk()

      joinPush.receive('ok', spyOk)

      assert.ok(spyOk.calledOnce)
    })

    it('does not trigger other receive callbacks after ok response', () => {
      const spyError = sinon.spy()
      const spyTimeout = sinon.spy()

      joinPush.receive('error', spyError).receive('timeout', spyTimeout)

      helpers.receiveOk()
      clock.tick(channel.timeout * 2) // attempt timeout

      assert.ok(!spyError.called)
      assert.ok(!spyTimeout.called)
    })

    it('clears timeoutTimer', () => {
      assert.ok(joinPush.timeoutTimer)

      helpers.receiveOk()

      assert.equal(joinPush.timeoutTimer, null)
    })

    it('sets receivedResp', () => {
      assert.equal(joinPush.receivedResp, null)

      helpers.receiveOk()

      assert.deepEqual(joinPush.receivedResp, { status: 'ok', response })
    })

    it('removes channel bindings', () => {
      let bindings = helpers.getBindings('chan_reply_1')
      assert.equal(bindings.length, 1)

      helpers.receiveOk()

      bindings = helpers.getBindings('chan_reply_1')
      assert.equal(bindings.length, 0)
    })

    it('sets channel state to joined', () => {
      helpers.receiveOk()

      assert.equal(channel.state, 'joined')
    })

    it('resets channel rejoinTimer', () => {
      assert.ok(channel.rejoinTimer)

      const spy = sinon.spy(channel.rejoinTimer, 'reset')

      helpers.receiveOk()

      assert.ok(spy.calledOnce)
    })

    it("sends and empties channel's buffered pushEvents", () => {
      const pushEvent = { send() { } }
      const spy = sinon.spy(pushEvent, 'send')

      channel.pushBuffer.push(pushEvent)

      helpers.receiveOk()

      assert.ok(spy.calledOnce)
      assert.equal(channel.pushBuffer.length, 0)
    })
  })

  describe("receives 'timeout'", () => {
    it('sets channel state to errored', () => {
      helpers.receiveTimeout()

      assert.equal(channel.state, 'errored')
    })

    it("triggers receive('timeout') callback after ok response", () => {
      const spyTimeout = sinon.spy()

      joinPush.receive('timeout', spyTimeout)

      helpers.receiveTimeout()

      assert.ok(spyTimeout.calledOnce)
    })

    it("triggers receive('timeout') callback if already timed out", () => {
      const spyTimeout = sinon.spy()

      helpers.receiveTimeout()

      joinPush.receive('timeout', spyTimeout)

      assert.ok(spyTimeout.calledOnce)
    })

    it('does not trigger other receive callbacks after timeout response', () => {
      const spyOk = sinon.spy()
      const spyError = sinon.spy()

      joinPush.receive('ok', spyOk).receive('error', spyError)

      helpers.receiveTimeout()
      helpers.receiveOk()

      assert.ok(!spyOk.called)
      assert.ok(!spyError.called)
    })

    it('schedules rejoinTimer timeout', () => {
      assert.ok(channel.rejoinTimer)

      const spy = sinon.spy(channel.rejoinTimer, 'scheduleTimeout')

      helpers.receiveTimeout()

      assert.ok(spy.called) // TODO why called multiple times?
    })

    it('cannot send after timeout', () => {
      const spy = sinon.spy(socket, 'push')

      helpers.receiveTimeout()

      joinPush.send()

      assert.ok(!spy.called)
    })

    it('sets receivedResp', () => {
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

    it("triggers receive('error') callback after error response", () => {
      const spyError = sinon.spy()

      joinPush.receive('error', spyError)

      helpers.receiveError()

      assert.ok(spyError.calledOnce)
    })

    it("triggers receive('error') callback if error response already received", () => {
      const spyError = sinon.spy()

      helpers.receiveError()

      joinPush.receive('error', spyError)

      assert.ok(spyError.calledOnce)
    })

    it('does not trigger other receive callbacks after ok response', () => {
      const spyOk = sinon.spy()
      const spyTimeout = sinon.spy()

      joinPush.receive('ok', spyOk).receive('timeout', spyTimeout)

      helpers.receiveError()
      clock.tick(channel.timeout * 2) // attempt timeout

      assert.ok(!spyOk.called)
      assert.ok(!spyTimeout.called)
    })

    it('clears timeoutTimer', () => {
      assert.ok(joinPush.timeoutTimer)

      helpers.receiveError()

      assert.equal(joinPush.timeoutTimer, null)
    })

    it('sets receivedResp', () => {
      assert.equal(joinPush.receivedResp, null)

      helpers.receiveError()

      assert.deepEqual(joinPush.receivedResp, { status: 'error', response })
    })

    it('removes channel bindings', () => {
      let bindings = helpers.getBindings('chan_reply_1')
      assert.equal(bindings.length, 1)

      helpers.receiveError()

      bindings = helpers.getBindings('chan_reply_1')
      assert.equal(bindings.length, 0)
    })

    it('does not set channel state to joined', () => {
      helpers.receiveError()

      assert.equal(channel.state, 'joining')
    })

    it("does not trigger channel's buffered pushEvents", () => {
      const pushEvent = { send: () => { } }
      const spy = sinon.spy(pushEvent, 'send')

      channel.pushBuffer.push(pushEvent)

      helpers.receiveError()

      assert.ok(!spy.called)
      assert.equal(channel.pushBuffer.length, 1)
    })
  })
})

describe('onError', () => {
  let clock, joinPush

  beforeEach(() => {
    clock = sinon.useFakeTimers()

    socket = new RealtimeClient('ws://example.com/socket', { timeout: defaultTimeout })
    sinon.stub(socket, 'isConnected').callsFake(() => true)
    sinon.stub(socket, 'push').callsFake(() => true)

    channel = socket.channel('topic', { one: 'two' })

    joinPush = channel.joinPush

    channel.subscribe()
  })

  afterEach(() => {
    clock.restore()
    socket.disconnect()
    channel.unsubscribe()
  })

  it("sets state to 'errored'", () => {
    assert.notEqual(channel.state, 'errored')

    channel._trigger('phx_error')

    assert.equal(channel.state, 'errored')
  })

  it('tries to rejoin with backoff', () => {
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

  it('does not rejoin if channel leaving', () => {
    channel.state = 'leaving'

    const spy = sinon.stub(joinPush, 'send')

    channel._trigger('phx_error')

    clock.tick(1000)
    assert.equal(spy.callCount, 0)

    clock.tick(2000)
    assert.equal(spy.callCount, 0)

    assert.equal(channel.state, 'leaving')
  })

  it('does not rejoin if channel closed', () => {
    channel.state = 'closed'

    const spy = sinon.stub(joinPush, 'send')

    channel._trigger('phx_error')

    clock.tick(1000)
    assert.equal(spy.callCount, 0)

    clock.tick(2000)
    assert.equal(spy.callCount, 0)

    assert.equal(channel.state, 'closed')
  })

  it('triggers additional callbacks', () => {
    const spy = sinon.spy()
    channel._onError(spy)

    assert.equal(spy.callCount, 0)

    channel._trigger('phx_error')

    assert.equal(spy.callCount, 1)
  })
})

describe('onClose', () => {
  let clock, joinPush

  beforeEach(() => {
    clock = sinon.useFakeTimers()

    socket = new RealtimeClient('ws://example.com/socket', { timeout: defaultTimeout })
    sinon.stub(socket, 'isConnected').callsFake(() => true)
    sinon.stub(socket, 'push').callsFake(() => true)

    channel = socket.channel('topic', { one: 'two' })

    joinPush = channel.joinPush

    channel.subscribe()
  })

  afterEach(() => {
    clock.restore()
    socket.disconnect()
    channel.unsubscribe()
  })

  it("sets state to 'closed'", () => {
    assert.notEqual(channel.state, 'closed')

    channel._trigger('phx_close')

    assert.equal(channel.state, 'closed')
  })

  it('does not rejoin', () => {
    const spy = sinon.stub(joinPush, 'send')

    channel._trigger('phx_close')

    clock.tick(1000)
    assert.equal(spy.callCount, 0)

    clock.tick(2000)
    assert.equal(spy.callCount, 0)
  })

  it('triggers additional callbacks', () => {
    const spy = sinon.spy()
    channel._onClose(spy)

    assert.equal(spy.callCount, 0)

    channel._trigger('phx_close')

    assert.equal(spy.callCount, 1)
  })

  it('removes channel from socket', () => {
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

  it('returns payload by default', () => {
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

  it('returns true when socket connected and channel joined', () => {
    sinon.stub(socket, 'isConnected').returns(true)
    channel.state = 'joined'

    assert.ok(channel._canPush())
  })

  it('otherwise returns false', () => {
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

  it('sets up callback for event', () => {
    const spy = sinon.spy()

    channel._trigger('event', {}, defaultRef)
    assert.ok(!spy.called)

    channel.on('event', {}, spy)

    channel._trigger('event', {}, defaultRef)

    assert.ok(spy.called)
  })

  it('other event callbacks are ignored', () => {
    const spy = sinon.spy()
    const ignoredSpy = sinon.spy()

    channel._trigger('event', {}, defaultRef)

    assert.ok(!ignoredSpy.called)

    channel.on('event', {}, spy)
    channel.on('otherEvent', {}, ignoredSpy)

    channel._trigger('event', {}, defaultRef)

    assert.ok(!ignoredSpy.called)
  })

  it('"*" bind all events', () => {
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
    socket = new RealtimeClient('ws://example.com/socket')
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)

    channel = socket.channel('topic', { one: 'two' })
  })

  afterEach(() => {
    socket.disconnect()
    channel.unsubscribe()
  })

  it('removes all callbacks for event', () => {
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
  let clock, joinPush
  let socketSpy

  const pushParams = {
    topic: 'realtime:topic',
    event: 'event',
    payload: { foo: 'bar' },
    ref: defaultRef,
    join_ref: defaultRef
  }

  beforeEach(() => {
    clock = sinon.useFakeTimers()

    socket = new RealtimeClient('ws://example.com/socket', { timeout: defaultTimeout })
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)
    sinon.stub(socket, 'isConnected').callsFake(() => true)
    socketSpy = sinon.stub(socket, 'push')

    channel = socket.channel('topic', { one: 'two' })
  })

  afterEach(() => {
    clock.restore()
    socket.disconnect()
    channel.unsubscribe()
  })

  it('sends push event when successfully joined', () => {
    channel.subscribe()
    channel.joinPush.trigger('ok', {})
    channel._push('event', { foo: 'bar' })

    assert.ok(socketSpy.calledWith(pushParams))
  })

  it('enqueues push event to be sent once join has succeeded', () => {
    channel.subscribe()
    channel._push('event', { foo: 'bar' })

    assert.ok(!socketSpy.calledWith(pushParams))

    clock.tick(channel.timeout / 2)
    channel.joinPush.trigger('ok', {})

    assert.ok(socketSpy.calledWith(pushParams))
  })

  it('does not push if channel join times out', () => {
    channel.subscribe()
    channel._push('event', { foo: 'bar' })

    assert.ok(!socketSpy.calledWith(pushParams))

    clock.tick(channel.timeout * 2)
    channel.joinPush.trigger('ok', {})

    assert.ok(!socketSpy.calledWith(pushParams))
  })

  it('uses channel timeout by default', () => {
    const timeoutSpy = sinon.spy()
    channel.subscribe()
    channel.joinPush.trigger('ok', {})

    channel._push('event', { foo: 'bar' }).receive('timeout', timeoutSpy)

    clock.tick(channel.timeout / 2)
    assert.ok(!timeoutSpy.called)

    clock.tick(channel.timeout)
    assert.ok(timeoutSpy.called)
  })

  it('accepts timeout arg', () => {
    const timeoutSpy = sinon.spy()
    channel.subscribe()
    channel.joinPush.trigger('ok', {})

    channel
      ._push('event', { foo: 'bar' }, channel.timeout * 2)
      .receive('timeout', timeoutSpy)

    clock.tick(channel.timeout)
    assert.ok(!timeoutSpy.called)

    clock.tick(channel.timeout * 2)
    assert.ok(timeoutSpy.called)
  })

  it("does not time out after receiving 'ok'", () => {
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

  it('throws if channel has not been joined', () => {
    assert.throws(
      () => channel._push('event', {}),
      /tried to push.*before joining/
    )
  })
})

describe('leave', () => {
  let clock, joinPush
  let socketSpy

  beforeEach(() => {
    clock = sinon.useFakeTimers()

    socket = new RealtimeClient('ws://example.com/socket', { timeout: defaultTimeout })
    sinon.stub(socket, 'isConnected').callsFake(() => true)
    socketSpy = sinon.stub(socket, 'push')

    channel = socket.channel('topic', { one: 'two' })
    channel.subscribe()
    channel.joinPush.trigger('ok', {})
  })

  afterEach(() => {
    clock.restore()
    socket.disconnect()
    channel.unsubscribe();
  })

  it('unsubscribes from server events', () => {
    sinon.stub(socket, '_makeRef').callsFake(() => defaultRef)

    channel.unsubscribe()

    assert.ok(
      socketSpy.calledWith({
        topic: 'realtime:topic',
        event: 'phx_leave',
        payload: {},
        ref: defaultRef,
        join_ref: defaultRef
      })
    )
  })

  it("closes channel on 'ok' from server", () => {
    const anotherChannel = socket.channel('another', { three: 'four' })
    assert.equal(socket.channels.length, 2)

    channel.unsubscribe()
    channel.joinPush.trigger('ok', {})

    assert.equal(socket.channels.length, 1)
    assert.deepEqual(socket.channels[0], anotherChannel)
  })

  it("sets state to closed on 'ok' event", () => {
    assert.notEqual(channel.state, 'closed')

    channel.unsubscribe()
    channel.joinPush.trigger('ok', {})

    assert.equal(channel.state, 'closed')
  })

  // TODO - the following tests are skipped until Channel.leave
  // behavior can be fixed; currently, 'ok' is triggered immediately
  // within Channel.leave so timeout callbacks are never reached
  it.skip('sets state to leaving initially', () => {
    assert.notEqual(channel.state, 'leaving')

    channel.unsubscribe()

    assert.equal(channel.state, 'leaving')
  })

  it.skip("closes channel on 'timeout'", () => {
    channel.unsubscribe()

    clock.tick(channel.timeout)

    assert.equal(channel.state, 'closed')
  })

  it.skip('accepts timeout arg', () => {
    channel.unsubscribe(channel.timeout * 2)

    clock.tick(channel.timeout)

    assert.equal(channel.state, 'leaving')

    clock.tick(channel.timeout * 2)

    assert.equal(channel.state, 'closed')
  })
})

describe('presence helper methods', () => {
  beforeEach(() => {
    channel = socket.channel('topic', { one: 'two' })
  })

  it("gets presence state", () => {
    channel.presence.state = { u1: [{ id: 1, presence_ref: "1" }] }

    assert.deepEqual(channel.presenceState(), { u1: [{ id: 1, presence_ref: "1" }] })
  })

  it("tracks presence", () => {
    const sendStub = sinon.stub(channel, 'send')

    channel.track({ id: 123 })

    assert.ok(sendStub.calledWith({ type: 'presence', event: 'track', payload: { id: 123 }}))
  })

  it("untracks presence", () => {
    const sendStub = sinon.stub(channel, 'send')

    channel.untrack()

    assert.ok(sendStub.calledWith({ type: 'presence', event: 'untrack' }))
  })
})

describe('send', () => {
  let pushStub

  beforeEach(() => {
    channel = socket.channel('topic', { one: 'two' })
  })

  it("sends message", async () => {
    pushStub = sinon.stub(channel, '_push')
    pushStub.returns({ rateLimited: false, receive: (status, cb) => {
      if (status === 'ok') cb()
    }})

    const res = await channel.send({ type: 'broadcast', id: 'u123' })

    assert.equal(res, 'ok')
  })

  it("sends message but is rate limited", async () => {
    pushStub = sinon.stub(channel, '_push')
    pushStub.returns({ rateLimited: true })

    const res = await channel.send({ type: 'test', id: 'u123' })

    assert.equal(res, 'rate limited')
  })

  it("sends message but times out", async () => {
    pushStub = sinon.stub(channel, '_push')
    pushStub.returns({ rateLimited: false, receive: (status, cb) => {
      if (status === 'timeout') cb()
    }})

    const res = await channel.send({ type: 'test', id: 'u123' })

    assert.equal(res, 'timed out')
  })
})

describe('trigger', () => {
  let spy

  beforeEach(() => {
    channel = socket.channel('topic', { one: 'two' })
  })

  it("triggers when type is insert, update, delete", () => {
    spy = sinon.spy()

    channel.bindings.postgres_changes = [
      { type: 'postgres_changes', filter: { event: 'INSERT' }, callback: spy },
      { type: 'postgres_changes', filter: { event: 'UPDATE' }, callback: spy },
      { type: 'postgres_changes', filter: { event: 'DELETE' }, callback: spy },
      { type: 'postgres_changes', filter: { event: '*' }, callback: spy }
    ]

    channel._trigger('insert', { test: '123' }, '1')
    channel._trigger('update', { test: '123' }, '2')
    channel._trigger('delete', { test: '123' }, '3')

    assert.equal(spy.getCalls().length, 6)
  })

  it("triggers when type is broadcast", () => {
    spy = sinon.spy()

    channel.bindings.broadcast = [
      { type: 'broadcast', filter: { event: '*' }, callback: spy },
      { type: 'broadcast', filter: { event: 'test' }, callback: spy }
    ]

    channel._trigger('broadcast', { event: 'test', id: '123' }, '1')

    assert.ok(spy.calledTwice)
    assert.ok(spy.calledWith({ event: 'test', id: '123' }, '1'))
  })

  it("triggers when type is presence", () => {
    spy = sinon.spy()

    channel.bindings.presence = [
      { type: 'presence', filter: { event: 'sync' }, callback: spy },
      { type: 'presence', filter: { event: 'join' }, callback: spy },
      { type: 'presence', filter: { event: 'leave' }, callback: spy }
    ]

    channel._trigger('presence', { event: 'sync' }, '1')
    channel._trigger('presence', { event: 'join' }, '2')
    channel._trigger('presence', { event: 'leave' }, '3')

    assert.ok(spy.calledThrice)
  })

  it("triggers when type is postgres_changes", () => {
    spy = sinon.spy()

    channel.bindings.postgres_changes = [
      { id: 'abc123', type: 'postgres_changes', filter: { event: 'INSERT', schema: 'public', table: 'test' }, callback: spy }
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
          errors: []
        } 
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
})
