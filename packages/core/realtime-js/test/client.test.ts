import assert from 'assert'
import { describe, beforeEach, afterEach, test, vi, expect } from 'vitest'
import { Server, WebSocket as MockWebSocket } from 'mock-socket'
import WebSocket from 'ws'
import sinon from 'sinon'
import crypto from 'crypto'

import RealtimeClient, {
  HeartbeatStatus,
  RealtimeMessage,
} from '../src/RealtimeClient'
import jwt from 'jsonwebtoken'
import { CHANNEL_STATES } from '../src/lib/constants'

function generateJWT(exp: string): string {
  return jwt.sign({}, 'your-256-bit-secret', {
    algorithm: 'HS256',
    expiresIn: exp || '1h',
  })
}

let socket: RealtimeClient
let randomProjectRef = () => crypto.randomUUID()
let mockServer: Server
let projectRef: string
let url: string
const version = crypto.randomUUID()
beforeEach(() => {
  projectRef = randomProjectRef()
  url = `wss://${projectRef}/socket`
  mockServer = new Server(url)
  socket = new RealtimeClient(url, {
    transport: MockWebSocket,
    headers: {
      'X-Client-Info': version,
    },
  })
})

afterEach(() => {
  mockServer.stop()
  vi.resetAllMocks()
})

describe('constructor', () => {
  test('sets defaults', () => {
    let socket = new RealtimeClient(url)

    assert.equal(socket.getChannels().length, 0)
    assert.equal(socket.sendBuffer.length, 0)
    assert.equal(socket.ref, 0)
    assert.equal(socket.endPoint, `${url}/websocket`)
    assert.deepEqual(socket.stateChangeCallbacks, {
      open: [],
      close: [],
      error: [],
      message: [],
    })
    assert.equal(socket.transport, null)
    assert.equal(socket.timeout, 10000)
    assert.equal(socket.heartbeatIntervalMs, 25000)
    assert.equal(typeof socket.logger, 'function')
    assert.equal(typeof socket.reconnectAfterMs, 'function')
  })

  test('overrides some defaults with options', () => {
    const customLogger = function logger() {}
    const customReconnect = function reconnect() {}

    socket = new RealtimeClient(`wss://${projectRef}/socket`, {
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
    test('defaults to Websocket transport if available', () => {
      socket = new RealtimeClient(`wss://${projectRef}/socket`)
      assert.equal(socket.transport, null)
    })
  })
})

describe('endpointURL', () => {
  test('returns endpoint for given full url', () => {
    assert.equal(socket.endpointURL(), `${url}/websocket?vsn=1.0.0`)
  })

  test('returns endpoint with parameters', () => {
    socket = new RealtimeClient(url, { params: { foo: 'bar' } })
    assert.equal(socket.endpointURL(), `${url}/websocket?foo=bar&vsn=1.0.0`)
  })

  test('returns endpoint with apikey', () => {
    socket = new RealtimeClient(url, {
      params: { apikey: '123456789' },
    })
    assert.equal(
      socket.endpointURL(),
      `${url}/websocket?apikey=123456789&vsn=1.0.0`
    )
  })
})

describe('connect with WebSocket', () => {
  test('establishes websocket connection with endpoint', () => {
    socket.connect()
    let conn = socket.conn
    assert.ok(conn, 'connection should exist')
    assert.equal(conn.url, socket.endpointURL())
  })

  test('is idempotent', () => {
    socket.connect()

    let conn = socket.conn

    socket.connect()
    assert.deepStrictEqual(conn, socket.conn)
  })
})

describe('disconnect', () => {
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
    const spy = sinon.spy(socket.conn, 'close' as keyof typeof socket.conn)

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
  test('defaults to closed', () => {
    assert.equal(socket.connectionState(), 'closed')
  })

  test('returns closed if readyState unrecognized', () => {
    socket.connect()
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(5678)
    assert.equal(socket.connectionState(), 'closed')
  })

  test('returns connecting', () => {
    socket.connect()
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(0)
    assert.equal(socket.connectionState(), 'connecting')
    assert.ok(!socket.isConnected(), 'is not connected')
  })

  test('returns open', () => {
    socket.connect()
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(1)
    assert.equal(socket.connectionState(), 'open')
    assert.ok(socket.isConnected(), 'is connected')
  })

  test('returns closing', () => {
    socket.connect()
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(2)
    assert.equal(socket.connectionState(), 'closing')
    assert.ok(!socket.isConnected(), 'is not connected')
  })

  test('returns closed', () => {
    socket.connect()
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(3)
    assert.equal(socket.connectionState(), 'closed')
    assert.ok(!socket.isConnected(), 'is not connected')
  })
})

describe('channel', () => {
  let channel

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
    assert.equal(socket.getChannels().length, 0)

    channel = socket.channel('topic')

    assert.equal(socket.getChannels().length, 1)

    const [foundChannel] = socket.channels
    assert.deepStrictEqual(foundChannel, channel)
  })

  test('does not repeat channels to sockets channels list', () => {
    assert.equal(socket.getChannels().length, 0)

    channel = socket.channel('topic')
    socket.channel('topic') // should be ignored

    assert.equal(socket.getChannels().length, 1)

    const [foundChannel] = socket.channels
    assert.deepStrictEqual(foundChannel, channel)
  })
  test('gets all channels', () => {
    assert.equal(socket.getChannels().length, 0)

    const chan1 = socket.channel('chan1')
    const chan2 = socket.channel('chan2')

    assert.deepEqual(socket.getChannels(), [chan1, chan2])
  })

  test('removes a channel', async () => {
    const connectStub = sinon.stub(socket, 'connect')
    const disconnectStub = sinon.stub(socket, 'disconnect')

    channel = socket.channel('topic').subscribe()

    assert.equal(socket.getChannels().length, 1)
    assert.ok(connectStub.called)

    await socket.removeChannel(channel)

    assert.equal(socket.getChannels().length, 0)
    assert.ok(disconnectStub.called)
  })

  test('removes all channels', async () => {
    const disconnectStub = sinon.stub(socket, 'disconnect')

    socket.channel('chan1').subscribe()
    socket.channel('chan2').subscribe()

    assert.equal(socket.getChannels().length, 2)

    await socket.removeAllChannels()

    assert.equal(socket.getChannels().length, 0)
    assert.ok(disconnectStub.called)
  })
})

describe('leaveOpenTopic', () => {
  let channel1
  let channel2

  afterEach(() => {
    channel1.unsubscribe()
    channel2.unsubscribe()
  })

  test('enforces client to subscribe to unique topics', () => {
    channel1 = socket.channel('topic')
    channel2 = socket.channel('topic')
    channel1.subscribe()
    try {
      channel2.subscribe()
    } catch (e) {
      console.error(e)
      assert.equal(
        e,
        `tried to subscribe multiple times. 'subscribe' can only be called a single time per channel instance`
      )
    }

    assert.equal(socket.getChannels().length, 1)
    assert.equal(socket.getChannels()[0].topic, 'realtime:topic')
  })
})

describe('remove', () => {
  test('removes given channel from channels', () => {
    const channel1 = socket.channel('topic-1')
    const channel2 = socket.channel('topic-2')

    sinon.stub(channel1, '_joinRef').returns('1')
    sinon.stub(channel2, '_joinRef').returns('2')

    socket._remove(channel1)

    assert.equal(socket.getChannels().length, 1)

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

  test('sends data to connection when connected', () => {
    socket.connect()
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(1) // open

    const spy = sinon.spy(socket.conn, 'send' as keyof typeof socket.conn)

    socket.push(data)

    assert.ok(spy.calledWith(json))
  })

  test('buffers data when not connected', () => {
    socket.connect()
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(0) // connecting
    const spy = sinon.spy(socket.conn, 'send' as keyof typeof socket.conn)

    assert.equal(socket.sendBuffer.length, 0)
    socket.push(data)

    assert.ok(spy.neverCalledWith(json))
    assert.equal(socket.sendBuffer.length, 1)
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(1) // open
    socket.push(data)
    assert.ok(spy.calledWith(json))
  })
})

describe('makeRef', () => {
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
  afterEach(() => {
    socket.removeAllChannels()
  })

  test("sets access token, updates channels' join payload, and pushes token to channels", async () => {
    const channel1 = socket.channel('test-topic1')
    const channel2 = socket.channel('test-topic2')
    const channel3 = socket.channel('test-topic3')

    channel1.state = CHANNEL_STATES.joined
    channel2.state = CHANNEL_STATES.closed
    channel3.state = CHANNEL_STATES.joined

    channel1.joinedOnce = true
    channel2.joinedOnce = false
    channel3.joinedOnce = true

    const pushStub1 = sinon.stub(channel1, '_push')
    const pushStub2 = sinon.stub(channel2, '_push')
    const pushStub3 = sinon.stub(channel3, '_push')

    const payloadStub1 = sinon.stub(channel1, 'updateJoinPayload')
    const payloadStub2 = sinon.stub(channel2, 'updateJoinPayload')
    const payloadStub3 = sinon.stub(channel3, 'updateJoinPayload')
    const token = generateJWT('1h')
    await socket.setAuth(token)

    assert.strictEqual(socket.accessTokenValue, token)

    assert.ok(pushStub1.calledWith('access_token', { access_token: token }))
    assert.ok(!pushStub2.calledWith('access_token', { access_token: token }))
    assert.ok(pushStub3.calledWith('access_token', { access_token: token }))

    assert.ok(payloadStub1.calledWith({ access_token: token, version }))
    assert.ok(payloadStub2.calledWith({ access_token: token, version }))
    assert.ok(payloadStub3.calledWith({ access_token: token, version }))
  })

  test("does not send message if token hasn't changed", async () => {
    const channel1 = socket.channel('test-topic')

    channel1.state = CHANNEL_STATES.joined

    channel1.joinedOnce = true

    sinon.stub(channel1, '_push')

    const payloadStub1 = sinon.stub(channel1, 'updateJoinPayload')
    const token = generateJWT('1h')

    await socket.setAuth(token)
    await socket.setAuth(token)

    assert.strictEqual(socket.accessTokenValue, token)
    assert.ok(payloadStub1.calledOnceWith({ access_token: token, version }))
  })

  test("sets access token, updates channels' join payload, and pushes token to channels if is not a jwt", async () => {
    const channel1 = socket.channel('test-topic1')
    const channel2 = socket.channel('test-topic2')
    const channel3 = socket.channel('test-topic3')

    channel1.state = CHANNEL_STATES.joined
    channel2.state = CHANNEL_STATES.closed
    channel3.state = CHANNEL_STATES.joined

    channel1.joinedOnce = true
    channel2.joinedOnce = false
    channel3.joinedOnce = true

    const pushStub1 = sinon.stub(channel1, '_push')
    const pushStub2 = sinon.stub(channel2, '_push')
    const pushStub3 = sinon.stub(channel3, '_push')

    const payloadStub1 = sinon.stub(channel1, 'updateJoinPayload')
    const payloadStub2 = sinon.stub(channel2, 'updateJoinPayload')
    const payloadStub3 = sinon.stub(channel3, 'updateJoinPayload')

    const new_token = 'sb-key'
    await socket.setAuth(new_token)

    assert.strictEqual(socket.accessTokenValue, new_token)
    assert.ok(pushStub1.calledWith('access_token', { access_token: new_token }))
    assert.ok(
      !pushStub2.calledWith('access_token', { access_token: new_token })
    )
    assert.ok(pushStub3.calledWith('access_token', { access_token: new_token }))
    assert.ok(payloadStub1.calledWith({ access_token: new_token, version }))
    assert.ok(payloadStub2.calledWith({ access_token: new_token, version }))
    assert.ok(payloadStub3.calledWith({ access_token: new_token, version }))
  })

  test("sets access token using callback, updates channels' join payload, and pushes token to channels", async () => {
    let new_token = generateJWT('1h')
    let new_socket = new RealtimeClient(url, {
      transport: MockWebSocket,
      headers: { 'X-Client-Info': version },
      accessToken: () => Promise.resolve(token),
    })

    const channel1 = new_socket.channel('test-topic1')
    const channel2 = new_socket.channel('test-topic2')
    const channel3 = new_socket.channel('test-topic3')

    channel1.state = CHANNEL_STATES.joined
    channel2.state = CHANNEL_STATES.closed
    channel3.state = CHANNEL_STATES.joined

    channel1.joinedOnce = true
    channel2.joinedOnce = false
    channel3.joinedOnce = true

    const pushStub1 = sinon.stub(channel1, '_push')
    const pushStub2 = sinon.stub(channel2, '_push')
    const pushStub3 = sinon.stub(channel3, '_push')

    const payloadStub1 = sinon.stub(channel1, 'updateJoinPayload')
    const payloadStub2 = sinon.stub(channel2, 'updateJoinPayload')
    const payloadStub3 = sinon.stub(channel3, 'updateJoinPayload')

    const token = generateJWT('1h')
    await new_socket.setAuth()
    assert.strictEqual(new_socket.accessTokenValue, new_token)
    assert.ok(pushStub1.calledWith('access_token', { access_token: new_token }))
    assert.ok(
      !pushStub2.calledWith('access_token', { access_token: new_token })
    )
    assert.ok(pushStub3.calledWith('access_token', { access_token: new_token }))
    assert.ok(payloadStub1.calledWith({ access_token: new_token, version }))
    assert.ok(payloadStub2.calledWith({ access_token: new_token, version }))
    assert.ok(payloadStub3.calledWith({ access_token: new_token, version }))
  })

  test("overrides access token, updates channels' join payload, and pushes token to channels", () => {
    const channel1 = socket.channel('test-topic1')
    const channel2 = socket.channel('test-topic2')
    const channel3 = socket.channel('test-topic3')

    channel1.state = CHANNEL_STATES.joined
    channel2.state = CHANNEL_STATES.closed
    channel3.state = CHANNEL_STATES.joined

    channel1.joinedOnce = true
    channel2.joinedOnce = false
    channel3.joinedOnce = true

    const pushStub1 = sinon.stub(channel1, '_push')
    const pushStub2 = sinon.stub(channel2, '_push')
    const pushStub3 = sinon.stub(channel3, '_push')

    const payloadStub1 = sinon.stub(channel1, 'updateJoinPayload')
    const payloadStub2 = sinon.stub(channel2, 'updateJoinPayload')
    const payloadStub3 = sinon.stub(channel3, 'updateJoinPayload')
    const new_token = 'override'
    socket.setAuth(new_token)

    assert.strictEqual(socket.accessTokenValue, new_token)
    assert.ok(pushStub1.calledWith('access_token', { access_token: new_token }))
    assert.ok(
      !pushStub2.calledWith('access_token', { access_token: new_token })
    )
    assert.ok(pushStub3.calledWith('access_token', { access_token: new_token }))
    assert.ok(payloadStub1.calledWith({ access_token: new_token, version }))
    assert.ok(payloadStub2.calledWith({ access_token: new_token, version }))
    assert.ok(payloadStub3.calledWith({ access_token: new_token, version }))
  })
})

describe('sendHeartbeat', () => {
  beforeEach(() => {
    socket.connect()
  })
  test("closes socket when heartbeat is not ack'd within heartbeat window", () => {
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(1) // open
    socket.sendHeartbeat()
    assert.equal(socket.connectionState(), 'open')

    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(3) // closed
    socket.sendHeartbeat()
    assert.equal(socket.connectionState(), 'closed')
  })

  test('pushes heartbeat data when connected', () => {
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(1) // open

    const spy = sinon.spy(socket.conn, 'send' as keyof typeof socket.conn)
    const data =
      '{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"1"}'

    socket.sendHeartbeat()
    assert.ok(spy.calledWith(data))
  })

  test('no ops when not connected', () => {
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(0) // connecting

    const spy = sinon.spy(socket.conn, 'send' as keyof typeof socket.conn)
    const data =
      '{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"1"}'

    socket.sendHeartbeat()
    assert.ok(spy.neverCalledWith(data))
  })

  test('sends heartbeat and updates auth token', async () => {
    const token = generateJWT('1h')
    const setAuthSpy = vi.spyOn(socket, 'setAuth')
    const sendSpy = vi.spyOn(socket.conn as WebSocket, 'send')

    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(1)
    vi.spyOn(socket, 'accessTokenValue', 'get').mockReturnValue(token)

    const heartbeatData =
      '{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"1"}'

    await socket.sendHeartbeat()

    expect(sendSpy).toHaveBeenCalledWith(heartbeatData)
    expect(setAuthSpy).toHaveBeenCalled()
    expect(setAuthSpy).toHaveBeenCalledTimes(1)
  })
})

describe('flushSendBuffer', () => {
  beforeEach(() => {
    socket.connect()
  })
  test('calls callbacks in buffer when connected', () => {
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(1) // open
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

  test('empties sendBuffer', () => {
    vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(1) // open
    socket.sendBuffer.push(() => {})

    socket.flushSendBuffer()

    assert.deepEqual(socket.sendBuffer.length, 0)
  })
})

describe('_onConnClose', () => {
  beforeEach(() => {
    socket.connect()
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
  beforeEach(() => {
    socket.connect()
  })

  test('triggers channel error', () => {
    const channel = socket.channel('topic')
    const spy = sinon.spy(channel, '_trigger')

    socket._onConnError('error')

    assert.ok(spy.calledWith('phx_error'))
  })
})

describe('onConnMessage', () => {
  beforeEach(() => {
    socket.connect()
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
  })

  test("on heartbeat events from the 'phoenix' topic, callback is called", async () => {
    let called = false
    let socket = new RealtimeClient(url)
    socket.onHeartbeat((message: HeartbeatStatus) => (called = message == 'ok'))

    const message =
      '{"ref":"1","event":"phx_reply","payload":{"status":"ok","response":{}},"topic":"phoenix"}'
    const data = { data: message }

    socket.pendingHeartbeatRef = '3'
    socket._onConnMessage(data)

    assert.strictEqual(called, true)
  })
  test("on heartbeat events from the 'phoenix' topic, callback is called with error", async () => {
    let called = false
    let socket = new RealtimeClient(url)
    socket.onHeartbeat(
      (message: HeartbeatStatus) => (called = message == 'error')
    )

    const message =
      '{"ref":"1","event":"phx_reply","payload":{"status":"error","response":{}},"topic":"phoenix"}'
    const data = { data: message }

    socket.pendingHeartbeatRef = '3'
    socket._onConnMessage(data)

    assert.strictEqual(called, true)
  })
})

describe('custom encoder and decoder', () => {
  test('encodes to JSON by default', () => {
    let payload = { foo: 'bar' }

    socket.encode(payload, (encoded) => {
      assert.deepStrictEqual(encoded, JSON.stringify(payload))
    })
  })

  test('allows custom encoding when using WebSocket transport', () => {
    let encoder = (payload, callback) => callback('encode works')
    socket = new RealtimeClient(`wss://${projectRef}/socket`, {
      transport: WebSocket,
      encode: encoder,
    })

    socket.encode({ foo: 'bar' }, (encoded) => {
      assert.deepStrictEqual(encoded, 'encode works')
    })
  })

  test('decodes JSON by default', () => {
    socket = new RealtimeClient(`wss://${projectRef}/socket`)
    let payload = JSON.stringify({ foo: 'bar' })

    socket.decode(payload, (decoded) => {
      assert.deepStrictEqual(decoded, { foo: 'bar' })
    })
  })

  test('decodes ArrayBuffer by default', () => {
    socket = new RealtimeClient(`wss://${projectRef}/socket`)
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
    let decoder = (_payload, callback) => callback('decode works')
    socket = new RealtimeClient(`wss://${projectRef}/socket`, {
      transport: WebSocket,
      decode: decoder,
    })

    socket.decode('...esoteric format...', (decoded) => {
      assert.deepStrictEqual(decoded, 'decode works')
    })
  })
})

describe('log operations', () => {
  test('calls the logger with the correct arguments', () => {
    const mockLogger = vi.fn()
    socket = new RealtimeClient(url, { logger: mockLogger })

    socket.log('testKind', 'testMessage', { testData: 'test' })

    expect(mockLogger).toHaveBeenCalledWith('testKind', 'testMessage', {
      testData: 'test',
    })
  })
  test('changing log_level sends proper params in URL', () => {
    socket = new RealtimeClient(url, { log_level: 'warn' })

    assert.equal(socket.logLevel, 'warn')
    assert.equal(
      socket.endpointURL(),
      `${url}/websocket?log_level=warn&vsn=1.0.0`
    )
  })
  test('changing logLevel sends proper params in URL', () => {
    socket = new RealtimeClient(url, { logLevel: 'warn' })

    assert.equal(socket.logLevel, 'warn')
    assert.equal(
      socket.endpointURL(),
      `${url}/websocket?log_level=warn&vsn=1.0.0`
    )
  })
})
