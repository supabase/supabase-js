import assert from 'assert'
import { Server as WebSocketServer, WebSocket } from 'mock-socket'
import sinon from 'sinon'
import { w3cwebsocket as W3CWebSocket } from 'websocket'
import { RealtimeClient } from '../dist/main'
import { CONNECTION_STATE } from '../dist/main/lib/constants'

let socket

describe('constructor', () => {
  before(() => {
    window.XMLHttpRequest = sinon.useFakeXMLHttpRequest()
  })

  afterEach(() => {
    socket.disconnect()
  })

  after(() => {
    window.XMLHttpRequest = null
  })

  it('sets defaults', () => {
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
    assert.equal(socket.transport, W3CWebSocket)
    assert.equal(socket.timeout, 10000)
    assert.equal(socket.heartbeatIntervalMs, 30000)
    assert.equal(typeof socket.logger, 'function')
    assert.equal(typeof socket.reconnectAfterMs, 'function')
  })

  it('overrides some defaults with options', () => {
    const customTransport = function transport() {}
    const customLogger = function logger() {}
    const customReconnect = function reconnect() {}

    socket = new RealtimeClient('wss://example.com/socket', {
      timeout: 40000,
      heartbeatIntervalMs: 60000,
      transport: customTransport,
      logger: customLogger,
      reconnectAfterMs: customReconnect,
      params: { one: 'two' },
    })

    assert.equal(socket.timeout, 40000)
    assert.equal(socket.heartbeatIntervalMs, 60000)
    assert.equal(socket.transport, customTransport)
    assert.equal(socket.logger, customLogger)
    assert.equal(socket.reconnectAfterMs, customReconnect)
    assert.deepEqual(socket.params, { one: 'two' })
  })

  describe('with Websocket', () => {
    let mockServer

    before(() => {
      mockServer = new WebSocketServer('wss://example.com/')
    })

    after((done) => {
      mockServer.stop(() => {
        window.WebSocket = null
        done()
      })
    })
  
    afterEach(() => {
    socket.disconnect()
    })

    it('defaults to Websocket transport if available', () => {
      socket = new RealtimeClient('wss://example.com/socket')
      assert.equal(socket.transport, W3CWebSocket)
    })
  })
})

describe('endpointURL', () => {
  afterEach(() => {
    socket.disconnect()
  })

  it('returns endpoint for given full url', () => {
    socket = new RealtimeClient('wss://example.org/chat')
    assert.equal(
      socket._endPointURL(),
      'wss://example.org/chat/websocket?vsn=1.0.0'
    )
  })

  it('returns endpoint with parameters', () => {
    socket = new RealtimeClient('ws://example.org/chat', { params: { foo: 'bar' } })
    assert.equal(
      socket._endPointURL(),
      'ws://example.org/chat/websocket?foo=bar&vsn=1.0.0'
    )
  })

  it('returns endpoint with apikey', () => {
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

  before(() => {
    mockServer = new WebSocketServer('wss://example.com/')
  })

  after((done) => {
    mockServer.stop(() => {
      window.WebSocket = null
      done()
    })
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    socket.disconnect()
  })

  it('establishes websocket connection with endpoint', () => {
    socket.connect()

    let conn = socket.conn
    assert.ok(conn instanceof W3CWebSocket)
    assert.equal(conn.url, socket._endPointURL())
  })

  it('is idempotent', () => {
    socket.connect()

    let conn = socket.conn

    socket.connect()

    assert.deepStrictEqual(conn, socket.conn)
  })
})

describe('disconnect', () => {
  let mockServer

  before(() => {
    mockServer = new WebSocketServer('wss://example.com/')
  })

  after((done) => {
    mockServer.stop(() => {
      window.WebSocket = null
      done()
    })
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    socket.disconnect()
  })

  it('removes existing connection', () => {
    socket.connect()
    socket.disconnect()

    assert.equal(socket.conn, null)
  })

  it('calls callback', () => {
    let count = 0
    socket.connect()
    socket.disconnect()
    count++
    
    assert.equal(count, 1)
  })

  it('calls connection close callback', () => {
    socket.connect()
    const spy = sinon.spy(socket.conn, 'close')

    socket.disconnect('code', 'reason')

    assert(spy.calledWith('code', 'reason'))
  })

  it('does not throw when no connection', () => {
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

  it('defaults to closed', () => {
    assert.equal(socket.connectionState(), 'closed')
  })

  // TODO: fix for W3CWebSocket
  it.skip('returns closed if readyState unrecognized', () => {
    socket.connect()

    socket.conn.readyState = 5678
    assert.equal(socket.connectionState(), 'closed')
  })

  // TODO: fix for W3CWebSocket
  it.skip('returns connecting', () => {
    socket.connect()

    socket.conn.readyState = 0
    assert.equal(socket.connectionState(), 'connecting')
    assert.ok(!socket.isConnected(), 'is not connected')
  })

  // TODO: fix for W3CWebSocket
  it.skip('returns open', () => {
    socket.connect()

    socket.conn.readyState = 1
    assert.equal(socket.connectionState(), 'open')
    assert.ok(socket.isConnected(), 'is connected')
  })

  // TODO: fix for W3CWebSocket
  it.skip('returns closing', () => {
    socket.connect()

    socket.conn.readyState = 2
    assert.equal(socket.connectionState(), 'closing')
    assert.ok(!socket.isConnected(), 'is not connected')
  })

  // TODO: fix for W3CWebSocket
  it.skip('returns closed', () => {
    socket.connect()

    socket.conn.readyState = 3
    assert.equal(socket.connectionState(), 'closed')
    assert.ok(!socket.isConnected(), 'is not connected')
  })
})

describe('channel', () => {
  let channel

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    socket.disconnect()
  })

  it('returns channel with given topic and params', () => {
    channel = socket.channel('topic', { one: 'two' })

    assert.deepStrictEqual(channel.socket, socket)
    assert.equal(channel.topic, 'realtime:topic')
    assert.deepEqual(channel.params, { config: { broadcast: { ack: false, self: false }, presence: { key: '' } }, one: 'two' })
  })

  it('adds channel to sockets channels list', () => {
    assert.equal(socket.channels.length, 0)

    channel = socket.channel('topic', { one: 'two' })

    assert.equal(socket.channels.length, 1)

    const [foundChannel] = socket.channels
    assert.deepStrictEqual(foundChannel, channel)
  })

  it('gets all channels', () => {
    assert.equal(socket.getChannels().length, 0)

    const chan1 = socket.channel('chan1', { one: 'two' })
    const chan2 = socket.channel('chan2', { one: 'two' })

    assert.deepEqual(socket.getChannels(), [chan1, chan2])
  })

  it('removes a channel', async () => {
    const connectStub = sinon.stub(socket, 'connect')
    const disconnectStub = sinon.stub(socket, 'disconnect')

    channel = socket.channel('topic', { one: 'two' }).subscribe()

    assert.equal(socket.channels.length, 1)
    assert.ok(connectStub.called)

    await socket.removeChannel(channel)

    assert.equal(socket.channels.length, 0)
    assert.ok(disconnectStub.called)
  })

  it('removes all channels', async () => {
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
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    channel1.unsubscribe()
    channel2.unsubscribe()
    socket.disconnect()
  })

  it('enforces client to subscribe to unique topics', () => {
    channel1 = socket.channel('topic', { one: 'two' })
    channel2 = socket.channel('topic', { one: 'two' })
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

  it('removes given channel from channels', () => {
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

  before(() => {
    window.XMLHttpRequest = sinon.useFakeXMLHttpRequest()
  })

  after(() => {
    window.XMLHttpRequest = null
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
  })

  afterEach(() => {
    socket.disconnect()
  })

  // TODO: fix for W3CWebSocket
  it.skip('sends data to connection when connected', () => {
    socket.connect()
    socket.conn.readyState = 1 // open

    const spy = sinon.spy(socket.conn, 'send')

    socket.push(data)

    assert.ok(spy.calledWith(json))
  })

  // TODO: fix for W3CWebSocket
  it.skip('buffers data when not connected', () => {
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

  it('returns next message ref', () => {
    assert.strictEqual(socket.ref, 0)
    assert.strictEqual(socket._makeRef(), '1')
    assert.strictEqual(socket.ref, 1)
    assert.strictEqual(socket._makeRef(), '2')
    assert.strictEqual(socket.ref, 2)
  })

  it('restarts for overflow', () => {
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

  it("sets access token, updates channels' join payload, and pushes token to channels", () => {
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
    assert.ok(pushStub1.calledWith('access_token', {
      access_token: 'token123',
    }))
    assert.ok(!pushStub2.calledWith('access_token', {
      access_token: 'token123',
    }))
    assert.ok(pushStub3.calledWith('access_token', {
      access_token: 'token123',
    }))
    assert.ok(payloadStub1.calledWith({ access_token: 'token123' }))
    assert.ok(payloadStub2.calledWith({ access_token: 'token123' }))
    assert.ok(payloadStub3.calledWith({ access_token: 'token123' }))
  })
})

describe('sendHeartbeat', () => {
  before(() => {
    window.XMLHttpRequest = sinon.useFakeXMLHttpRequest()
  })

  after(() => {
    window.XMLHttpRequest = null
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
    socket.connect()
  })

  afterEach(() => {
    socket.disconnect()
  })

  // TODO: fix for W3CWebSocket
  it.skip("closes socket when heartbeat is not ack'd within heartbeat window", () => {
    let closed = false
    socket.conn.readyState = 1 // open
    socket.conn.onclose = () => (closed = true)
    socket.sendHeartbeat()
    assert.equal(closed, false)

    socket.sendHeartbeat()
    assert.equal(closed, true)
  })

  // TODO: fix for W3CWebSocket
  it.skip('pushes heartbeat data when connected', () => {
    socket.conn.readyState = 1 // open

    const spy = sinon.spy(socket.conn, 'send')
    const data =
      '{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"1"}'

    socket.sendHeartbeat()
    assert.ok(spy.calledWith(data))
  })

  // TODO: fix for W3CWebSocket
  it.skip('no ops when not connected', () => {
    socket.conn.readyState = 0 // connecting

    const spy = sinon.spy(socket.conn, 'send')
    const data =
      '{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"1"}'

    socket.sendHeartbeat()
    assert.ok(spy.neverCalledWith(data))
  })
})

describe('flushSendBuffer', () => {
  before(() => {
    window.XMLHttpRequest = sinon.useFakeXMLHttpRequest()
  })

  after(() => {
    window.XMLHttpRequest = null
  })

  beforeEach(() => {
    socket = new RealtimeClient('wss://example.com/socket')
    socket.connect()
  })

  afterEach(() => {
    socket.disconnect()
  })

  // TODO: fix for W3CWebSocket
  it.skip('calls callbacks in buffer when connected', () => {
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

  // TODO: fix for W3CWebSocket
  it.skip('empties sendBuffer', () => {
    socket.conn.readyState = 1 // open
    socket.sendBuffer.push(() => {})

    socket.flushSendBuffer()

    assert.deepEqual(socket.sendBuffer.length, 0)
  })
})

describe('_onConnOpen', () => {
  let mockServer

  before(() => {
    mockServer = new WebSocketServer('wss://example.com/')
  })

  after((done) => {
    mockServer.stop(() => {
      window.WebSocket = null
      done()
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

  // TODO: fix for W3CWebSocket

  it.skip('flushes the send buffer', () => {
    socket.conn.readyState = 1 // open
    const spy = sinon.spy()
    socket.sendBuffer.push(spy)

    socket._onConnOpen()

    assert.ok(spy.calledOnce)
  })

  it('resets reconnectTimer', () => {
    const spy = sinon.spy(socket.reconnectTimer, 'reset')

    socket._onConnOpen()

    assert.ok(spy.calledOnce)
  })
})

describe('_onConnClose', () => {
  let mockServer

  before(() => {
    mockServer = new WebSocketServer('wss://example.com/')
  })

  after((done) => {
    mockServer.stop(() => {
      window.WebSocket = null
      done()
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

  it('schedules reconnectTimer timeout', () => {
    const spy = sinon.spy(socket.reconnectTimer, 'scheduleTimeout')

    socket._onConnClose()

    assert.ok(spy.calledOnce)
  })

  it('triggers channel error', () => {
    const channel = socket.channel('topic')
    const spy = sinon.spy(channel, '_trigger')

    socket._onConnClose()

    assert.ok(spy.calledWith('phx_error'))
  })
})

describe('_onConnError', () => {
  let mockServer

  before(() => {
    mockServer = new WebSocketServer('wss://example.com/')
  })

  after((done) => {
    mockServer.stop(() => {
      window.WebSocket = null
      done()
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

  it('triggers channel error', () => {
    const channel = socket.channel('topic')
    const spy = sinon.spy(channel, '_trigger')

    socket._onConnError('error')

    assert.ok(spy.calledWith('phx_error'))
  })
})

describe('onConnMessage', () => {
  let mockServer

  before(() => {
    mockServer = new WebSocketServer('wss://example.com/')
  })

  after((done) => {
    mockServer.stop(() => {
      window.WebSocket = null
      done()
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

  it('parses raw message and triggers channel event', () => {
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

  it('encodes to JSON by default', () => {
    socket = new RealtimeClient('wss://example.com/socket')
    let payload = { foo: 'bar' }

    socket.encode(payload, (encoded) => {
      assert.deepStrictEqual(encoded, JSON.stringify(payload))
    })
  })

  it('allows custom encoding when using WebSocket transport', () => {
    let encoder = (payload, callback) => callback('encode works')
    socket = new RealtimeClient('wss://example.com/socket', {
      transport: WebSocket,
      encode: encoder,
    })

    socket.encode({ foo: 'bar' }, (encoded) => {
      assert.deepStrictEqual(encoded, 'encode works')
    })
  })

  it('decodes JSON by default', () => {
    socket = new RealtimeClient('wss://example.com/socket')
    let payload = JSON.stringify({ foo: 'bar' })

    socket.decode(payload, (decoded) => {
      assert.deepStrictEqual(decoded, { foo: 'bar' })
    })
  })

  it('decodes ArrayBuffer by default', () => {
    socket = new RealtimeClient('wss://example.com/socket')
    const buffer = new Uint8Array([2, 20, 6, 114, 101, 97, 108, 116, 105,
      109, 101, 58, 112, 117, 98, 108, 105, 99, 58, 116, 101, 115, 116, 73,
      78, 83, 69, 82, 84, 123, 34, 102, 111, 111, 34, 58, 34, 98, 97, 114, 34, 125]).buffer

    socket.decode(buffer, decoded => {
      assert.deepStrictEqual(
        decoded, {
          ref: null,
          topic: "realtime:public:test",
          event: "INSERT",
          payload: { foo: 'bar' }
        }
      )
    })
  })

  it('allows custom decoding when using WebSocket transport', () => {
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
