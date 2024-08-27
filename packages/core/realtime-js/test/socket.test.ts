import assert from 'assert'
import { describe, beforeEach, afterEach, test } from 'vitest'
import { Server as MockServer, WebSocket as MockWebSocket } from 'mock-socket'
import WebSocket from 'ws'
import sinon from 'sinon'

import RealtimeClient from '../src/RealtimeClient'

let socket: RealtimeClient

describe('constructor', () => {
  beforeEach(() => {
    window.XMLHttpRequest = sinon.useFakeXMLHttpRequest()
  })

  afterEach(() => {
    socket.disconnect()
  })

  afterEach(() => {
    window.XMLHttpRequest = null
  })

  test('sets defaults', () => {
    socket = new RealtimeClient('wss://example.com/socket')

    assert.equal(socket.channels.length, 0)
    assert.equal(socket.sendBuffer.length, 0)
    assert.equal(socket.ref, 0)
    assert.equal(socket.endPoint, 'wss://example.com/socket/websocket')
    assert.deepEqual(socket.stateChangeCallbacks, {
      open: [],
      close: [],
      error: [],
      message: [],
    })
    assert.equal(socket.transport, null)
    assert.equal(socket.timeout, 10000)
    assert.equal(socket.heartbeatIntervalMs, 30000)
    assert.equal(typeof socket.logger, 'function')
    assert.equal(typeof socket.reconnectAfterMs, 'function')
  })

  test('overrides some defaults with options', () => {
    const customLogger = function logger() {}
    const customReconnect = function reconnect() {}

    socket = new RealtimeClient('wss://example.com/socket', {
      timeout: 40000,
      heartbeatIntervalMs: 60000,
      transport: MockWebSocket,
      logger: customLogger,
      reconnectAfterMs: customReconnect,
      params: { one: 'two' },
    })

    assert.equal(socket.timeout, 40000)
    assert.equal(socket.heartbeatIntervalMs, 60000)
    assert.equal(socket.transport, MockWebSocket)
    assert.equal(socket.logger, customLogger)
    assert.equal(socket.reconnectAfterMs, customReconnect)
    assert.deepEqual(socket.params, { one: 'two' })
  })

  describe('with Websocket', () => {
    let mockServer

    beforeEach(() => {
      mockServer = new MockServer('wss://example.com/')
    })

    afterEach((done) => {
      mockServer.stop(() => {
        window.WebSocket = null
      })
    })

    afterEach(() => {
      socket.disconnect()
    })

    test('defaults to Websocket transport if available', () => {
      socket = new RealtimeClient('wss://example.com/socket')
      assert.equal(socket.transport, null)
    })
  })
})

describe('endpointURL', () => {
  afterEach(() => {
    socket.disconnect()
  })

  test('returns endpoint for given full url', () => {
    socket = new RealtimeClient('wss://example.org/chat')
    assert.equal(
      socket._endPointURL(),
      'wss://example.org/chat/websocket?vsn=1.0.0'
    )
  })

  test('returns endpoint with parameters', () => {
    socket = new RealtimeClient('ws://example.org/chat', {
      params: { foo: 'bar' },
    })
    assert.equal(
      socket._endPointURL(),
      'ws://example.org/chat/websocket?foo=bar&vsn=1.0.0'
    )
  })

  test('returns endpoint with apikey', () => {
    socket = new RealtimeClient('ws://example.org/chat', {
      params: { apikey: '123456789' },
    })
    assert.equal(
      socket._endPointURL(),
      'ws://example.org/chat/websocket?apikey=123456789&vsn=1.0.0'
    )
  })
})

describe('connect with WebSocket', () => {
  let mockServer

  beforeEach(() => {
    mockServer = new MockServer('wss://example.com/')
  })

  afterEach((done) => {
    mockServer.stop(() => {
      window.WebSocket = null
    })
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    socket.disconnect()
  })

  test('establishes websocket connection with endpoint', () => {
    socket.connect()

    let conn = socket.conn
    assert.equal(conn.url, socket._endPointURL())
  })

  test('is idempotent', () => {
    socket.connect()

    let conn = socket.conn

    socket.connect()

    assert.deepStrictEqual(conn, socket.conn)
  })
})

describe('disconnect', () => {
  let mockServer

  beforeEach(() => {
    mockServer = new MockServer('wss://example.com/')
  })

  afterEach((done) => {
    mockServer.stop(() => {
      window.WebSocket = null
    })
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    socket.disconnect()
  })

  test('removes existing connection', () => {
    socket.connect()
    socket.disconnect()

    assert.equal(socket.conn, null)
  })

  test('calls callback', () => {
    let count = 0
    socket.connect()
    socket.disconnect()
    count++

    assert.equal(count, 1)
  })

  test('calls connection close callback', () => {
    socket.connect()
    const spy = sinon.spy(socket.conn, 'close')

    socket.disconnect(1000, 'reason')

    assert(spy.calledWith(1000, 'reason'))
  })

  test('does not throw when no connection', () => {
    assert.doesNotThrow(() => {
      socket.disconnect()
    })
  })
})

describe('connectionState', () => {
  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    socket.disconnect()
  })

  test('defaults to closed', () => {
    assert.equal(socket.connectionState(), 'closed')
  })

  // TODO: fix for WSWebSocket
  test.skip('returns closed if readyState unrecognized', () => {
    socket.connect()

    socket.conn.readyState = 5678
    assert.equal(socket.connectionState(), 'closed')
  })

  // TODO: fix for WSWebSocket
  test.skip('returns connecting', () => {
    socket.connect()

    socket.conn.readyState = 0
    assert.equal(socket.connectionState(), 'connecting')
    assert.ok(!socket.isConnected(), 'is not connected')
  })

  // TODO: fix for WSWebSocket
  test.skip('returns open', () => {
    socket.connect()

    socket.conn.readyState = 1
    assert.equal(socket.connectionState(), 'open')
    assert.ok(socket.isConnected(), 'is connected')
  })

  // TODO: fix for WSWebSocket
  test.skip('returns closing', () => {
    socket.connect()

    socket.conn.readyState = 2
    assert.equal(socket.connectionState(), 'closing')
    assert.ok(!socket.isConnected(), 'is not connected')
  })

  // TODO: fix for WSWebSocket
  test.skip('returns closed', () => {
    socket.connect()

    socket.conn.readyState = 3
    assert.equal(socket.connectionState(), 'closed')
    assert.ok(!socket.isConnected(), 'is not connected')
  })
})

describe('channel', () => {
  let channel

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket', {
      transport: MockWebSocket,
    })
  })

  afterEach(() => {
    socket.disconnect()
  })

  test('returns channel with given topic and params', () => {
    channel = socket.channel('topic', { one: 'two' })

    assert.deepStrictEqual(channel.socket, socket)
    assert.equal(channel.topic, 'realtime:topic')
    assert.deepEqual(channel.params, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '' },
        private: false,
      },
      one: 'two',
    })
  })
  test('returns channel with given topic and params for a private channel', () => {
    channel = socket.channel('topic', { config: { private: true }, one: 'two' })

    assert.deepStrictEqual(channel.socket, socket)
    assert.equal(channel.topic, 'realtime:topic')
    assert.deepEqual(channel.params, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '' },
        private: true,
      },
      one: 'two',
    })
  })
  test('adds channel to sockets channels list', () => {
    assert.equal(socket.channels.length, 0)

    channel = socket.channel('topic', { one: 'two' })

    assert.equal(socket.channels.length, 1)

    const [foundChannel] = socket.channels
    assert.deepStrictEqual(foundChannel, channel)
  })

  test('gets all channels', () => {
    assert.equal(socket.getChannels().length, 0)

    const chan1 = socket.channel('chan1', { one: 'two' })
    const chan2 = socket.channel('chan2', { one: 'two' })

    assert.deepEqual(socket.getChannels(), [chan1, chan2])
  })

  test('removes a channel', async () => {
    const connectStub = sinon.stub(socket, 'connect')
    const disconnectStub = sinon.stub(socket, 'disconnect')

    channel = socket.channel('topic', { one: 'two' }).subscribe()

    assert.equal(socket.channels.length, 1)
    assert.ok(connectStub.called)

    await socket.removeChannel(channel)

    assert.equal(socket.channels.length, 0)
    assert.ok(disconnectStub.called)
  })

  test('removes all channels', async () => {
    const disconnectStub = sinon.stub(socket, 'disconnect')

    socket.channel('chan1', { one: 'two' }).subscribe()
    socket.channel('chan2', { one: 'two' }).subscribe()

    assert.equal(socket.channels.length, 2)

    await socket.removeAllChannels()

    assert.equal(socket.channels.length, 0)
    assert.ok(disconnectStub.called)
  })
})

describe('leaveOpenTopic', () => {
  let channel1
  let channel2

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket', {
      transport: MockWebSocket,
    })
  })

  afterEach(() => {
    channel1.unsubscribe()
    channel2.unsubscribe()
    socket.disconnect()
  })

  test('enforces client to subscribe to unique topics', () => {
    channel1 = socket.channel('topic')
    channel2 = socket.channel('topic')
    channel1.subscribe()
    channel2.subscribe()

    assert.equal(socket.channels.length, 1)
    assert.equal(socket.channels[0].topic, 'realtime:topic')
  })
})

describe('remove', () => {
  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    socket.disconnect()
  })

  test('removes given channel from channels', () => {
    const channel1 = socket.channel('topic-1')
    const channel2 = socket.channel('topic-2')

    sinon.stub(channel1, '_joinRef').returns(1)
    sinon.stub(channel2, '_joinRef').returns(2)

    socket._remove(channel1)

    assert.equal(socket.channels.length, 1)

    const [foundChannel] = socket.channels
    assert.deepStrictEqual(foundChannel, channel2)
  })
})

describe('push', () => {
  const data = {
    topic: 'topic',
    event: 'event',
    payload: 'payload',
    ref: 'ref',
  }
  const json =
    '{"topic":"topic","event":"event","payload":"payload","ref":"ref"}'

  beforeEach(() => {
    window.XMLHttpRequest = sinon.useFakeXMLHttpRequest()
  })

  afterEach(() => {
    window.XMLHttpRequest = null
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    socket.disconnect()
  })

  // TODO: fix for WSWebSocket
  test.skip('sends data to connection when connected', () => {
    socket.connect()
    socket.conn.readyState = 1 // open

    const spy = sinon.spy(socket.conn, 'send')

    socket.push(data)

    assert.ok(spy.calledWith(json))
  })

  // TODO: fix for WSWebSocket
  test.skip('buffers data when not connected', () => {
    socket.connect()
    socket.conn.readyState = 0 // connecting

    const spy = sinon.spy(socket.conn, 'send')

    assert.equal(socket.sendBuffer.length, 0)

    socket.push(data)

    assert.ok(spy.neverCalledWith(json))
    assert.equal(socket.sendBuffer.length, 1)

    const [callback] = socket.sendBuffer
    callback()
    assert.ok(spy.calledWith(json))
  })
})

describe('makeRef', () => {
  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    socket.disconnect()
  })

  test('returns next message ref', () => {
    assert.strictEqual(socket.ref, 0)
    assert.strictEqual(socket._makeRef(), '1')
    assert.strictEqual(socket.ref, 1)
    assert.strictEqual(socket._makeRef(), '2')
    assert.strictEqual(socket.ref, 2)
  })

  test('restarts for overflow', () => {
    socket.ref = Number.MAX_SAFE_INTEGER + 1

    assert.strictEqual(socket._makeRef(), '0')
    assert.strictEqual(socket.ref, 0)
  })
})

describe('setAuth', () => {
  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    socket.removeAllChannels()
  })

  test("sets access token, updates channels' join payload, and pushes token to channels", () => {
    const channel1 = socket.channel('test-topic')
    const channel2 = socket.channel('test-topic')
    const channel3 = socket.channel('test-topic')

    channel1.joinedOnce = true
    channel1.state = 'joined'
    channel2.joinedOnce = false
    channel2.state = 'closed'
    channel3.joinedOnce = true
    channel3.state = 'joined'

    const pushStub1 = sinon.stub(channel1, '_push')
    const pushStub2 = sinon.stub(channel2, '_push')
    const pushStub3 = sinon.stub(channel3, '_push')

    const payloadStub1 = sinon.stub(channel1, 'updateJoinPayload')
    const payloadStub2 = sinon.stub(channel2, 'updateJoinPayload')
    const payloadStub3 = sinon.stub(channel3, 'updateJoinPayload')

    socket.setAuth('token123')

    assert.strictEqual(socket.accessToken, 'token123')
    assert.ok(
      pushStub1.calledWith('access_token', {
        access_token: 'token123',
      })
    )
    assert.ok(
      !pushStub2.calledWith('access_token', {
        access_token: 'token123',
      })
    )
    assert.ok(
      pushStub3.calledWith('access_token', {
        access_token: 'token123',
      })
    )
    assert.ok(payloadStub1.calledWith({ access_token: 'token123' }))
    assert.ok(payloadStub2.calledWith({ access_token: 'token123' }))
    assert.ok(payloadStub3.calledWith({ access_token: 'token123' }))
  })
})

describe('sendHeartbeat', () => {
  beforeEach(() => {
    window.XMLHttpRequest = sinon.useFakeXMLHttpRequest()
  })

  afterEach(() => {
    window.XMLHttpRequest = null
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
    socket.connect()
  })

  afterEach(() => {
    socket.disconnect()
  })

  // TODO: fix for WSWebSocket
  test.skip("closes socket when heartbeat is not ack'd within heartbeat window", () => {
    let closed = false
    socket.conn.readyState = 1 // open
    socket.conn.onclose = () => (closed = true)
    socket.sendHeartbeat()
    assert.equal(closed, false)

    socket.sendHeartbeat()
    assert.equal(closed, true)
  })

  // TODO: fix for WSWebSocket
  test.skip('pushes heartbeat data when connected', () => {
    socket.conn.readyState = 1 // open

    const spy = sinon.spy(socket.conn, 'send')
    const data =
      '{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"1"}'

    socket.sendHeartbeat()
    assert.ok(spy.calledWith(data))
  })

  // TODO: fix for WSWebSocket
  test.skip('no ops when not connected', () => {
    socket.conn.readyState = 0 // connecting

    const spy = sinon.spy(socket.conn, 'send')
    const data =
      '{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"1"}'

    socket.sendHeartbeat()
    assert.ok(spy.neverCalledWith(data))
  })
})

describe('flushSendBuffer', () => {
  beforeEach(() => {
    window.XMLHttpRequest = sinon.useFakeXMLHttpRequest()
  })

  afterEach(() => {
    window.XMLHttpRequest = null
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
    socket.connect()
  })

  afterEach(() => {
    socket.disconnect()
  })

  // TODO: fix for WSWebSocket
  test.skip('calls callbacks in buffer when connected', () => {
    socket.conn.readyState = 1 // open
    const spy1 = sinon.spy()
    const spy2 = sinon.spy()
    const spy3 = sinon.spy()
    socket.sendBuffer.push(spy1)
    socket.sendBuffer.push(spy2)

    socket.flushSendBuffer()

    assert.ok(spy1.calledOnce)
    assert.ok(spy2.calledOnce)
    assert.equal(spy3.callCount, 0)
  })

  // TODO: fix for WSWebSocket
  test.skip('empties sendBuffer', () => {
    socket.conn.readyState = 1 // open
    socket.sendBuffer.push(() => {})

    socket.flushSendBuffer()

    assert.deepEqual(socket.sendBuffer.length, 0)
  })
})

describe('_onConnOpen', () => {
  let mockServer

  beforeEach(() => {
    mockServer = new MockServer('wss://example.com/')
  })

  afterEach(() => {
    mockServer.stop(() => {
      window.WebSocket = null
    })
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket', {
      reconnectAfterMs: () => 100000,
    })
    socket.connect()
  })

  afterEach(() => {
    socket.disconnect()
  })

  // TODO: fix for WSWebSocket

  test.skip('flushes the send buffer', () => {
    socket.conn.readyState = 1 // open
    const spy = sinon.spy()
    socket.sendBuffer.push(spy)

    socket._onConnOpen()

    assert.ok(spy.calledOnce)
  })

  test('resets reconnectTimer', () => {
    const spy = sinon.spy(socket.reconnectTimer, 'reset')

    socket._onConnOpen()

    assert.ok(spy.calledOnce)
  })
})

describe('_onConnClose', () => {
  let mockServer

  beforeEach(() => {
    mockServer = new MockServer('wss://example.com/')
  })

  afterEach(() => {
    mockServer.stop(() => {
      window.WebSocket = null
    })
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket', {
      reconnectAfterMs: () => 100000,
    })
    socket.connect()
  })

  afterEach(() => {
    socket.disconnect()
  })

  test('schedules reconnectTimer timeout', () => {
    const spy = sinon.spy(socket.reconnectTimer, 'scheduleTimeout')

    socket._onConnClose()

    assert.ok(spy.calledOnce)
  })

  test('triggers channel error', () => {
    const channel = socket.channel('topic')
    const spy = sinon.spy(channel, '_trigger')

    socket._onConnClose()

    assert.ok(spy.calledWith('phx_error'))
  })
})

describe('_onConnError', () => {
  let mockServer

  beforeEach(() => {
    mockServer = new MockServer('wss://example.com/')
  })

  afterEach((done) => {
    mockServer.stop(() => {
      window.WebSocket = null
    })
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket', {
      reconnectAfterMs: () => 100000,
    })
    socket.connect()
  })

  afterEach(() => {
    socket.disconnect()
  })

  test('triggers channel error', () => {
    const channel = socket.channel('topic')
    const spy = sinon.spy(channel, '_trigger')

    socket._onConnError('error')

    assert.ok(spy.calledWith('phx_error'))
  })
})

describe('onConnMessage', () => {
  let mockServer

  beforeEach(() => {
    mockServer = new MockServer('wss://example.com/')
  })

  afterEach((done) => {
    mockServer.stop(() => {
      window.WebSocket = null
    })
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket', {
      reconnectAfterMs: () => 100000,
    })
    socket.connect()
  })

  afterEach(() => {
    socket.disconnect()
  })

  test('parses raw message and triggers channel event', () => {
    const message =
      '{"topic":"realtime:topic","event":"INSERT","payload":{"type":"INSERT"},"ref":"ref"}'
    const data = { data: message }

    const targetChannel = socket.channel('topic')
    const otherChannel = socket.channel('off-topic')

    const targetSpy = sinon.spy(targetChannel, '_trigger')
    const otherSpy = sinon.spy(otherChannel, '_trigger')

    socket.pendingHeartbeatRef = '3'
    socket._onConnMessage(data)

    // assert.ok(targetSpy.calledWith('INSERT', {type: 'INSERT'}, 'ref'))
    assert.strictEqual(targetSpy.callCount, 1)
    assert.strictEqual(otherSpy.callCount, 0)
    assert.strictEqual(socket.pendingHeartbeatRef, null)
  })
})

describe('custom encoder and decoder', () => {
  afterEach(() => {
    socket.disconnect()
  })

  test('encodes to JSON by default', () => {
    socket = new RealtimeClient('wss://example.com/socket')
    let payload = { foo: 'bar' }

    socket.encode(payload, (encoded) => {
      assert.deepStrictEqual(encoded, JSON.stringify(payload))
    })
  })

  test('allows custom encoding when using WebSocket transport', () => {
    let encoder = (payload, callback) => callback('encode works')
    socket = new RealtimeClient('wss://example.com/socket', {
      transport: WebSocket,
      encode: encoder,
    })

    socket.encode({ foo: 'bar' }, (encoded) => {
      assert.deepStrictEqual(encoded, 'encode works')
    })
  })

  test('decodes JSON by default', () => {
    socket = new RealtimeClient('wss://example.com/socket')
    let payload = JSON.stringify({ foo: 'bar' })

    socket.decode(payload, (decoded) => {
      assert.deepStrictEqual(decoded, { foo: 'bar' })
    })
  })

  test('decodes ArrayBuffer by default', () => {
    socket = new RealtimeClient('wss://example.com/socket')
    const buffer = new Uint8Array([
      2, 20, 6, 114, 101, 97, 108, 116, 105, 109, 101, 58, 112, 117, 98, 108,
      105, 99, 58, 116, 101, 115, 116, 73, 78, 83, 69, 82, 84, 123, 34, 102,
      111, 111, 34, 58, 34, 98, 97, 114, 34, 125,
    ]).buffer

    socket.decode(buffer, (decoded) => {
      assert.deepStrictEqual(decoded, {
        ref: null,
        topic: 'realtime:public:test',
        event: 'INSERT',
        payload: { foo: 'bar' },
      })
    })
  })

  test('allows custom decoding when using WebSocket transport', () => {
    let decoder = (payload, callback) => callback('decode works')
    socket = new RealtimeClient('wss://example.com/socket', {
      transport: WebSocket,
      decode: decoder,
    })

    socket.decode('...esoteric format...', (decoded) => {
      assert.deepStrictEqual(decoded, 'decode works')
    })
  })
})
