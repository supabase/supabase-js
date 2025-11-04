import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import RealtimeClient, { HeartbeatStatus } from '../src/RealtimeClient'
import { setupRealtimeTest, cleanupRealtimeTest, TestSetup, testSuites } from './helpers/setup'

let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest()
})

afterEach(() => {
  cleanupRealtimeTest(testSetup)
})

describe('push', () => {
  const data = {
    topic: 'topic',
    event: 'event',
    payload: 'payload',
    ref: 'ref',
  }
  const json = '{"topic":"topic","event":"event","payload":"payload","ref":"ref"}'

  test('sends data to connection when connected', () => {
    testSetup.socket.connect()
    const readyStateSpy = vi.spyOn(testSetup.socket.conn!, 'readyState', 'get').mockReturnValue(1) // open

    const spy = vi.spyOn(testSetup.socket.conn!, 'send')

    testSetup.socket.push(data)

    expect(spy).toHaveBeenCalledWith(json)
    readyStateSpy.mockRestore()
  })

  test('buffers data when not connected', () => {
    testSetup.socket.connect()
    const readyStateSpy = vi.spyOn(testSetup.socket.conn!, 'readyState', 'get').mockReturnValue(0) // connecting
    const spy = vi.spyOn(testSetup.socket.conn!, 'send')

    assert.equal(testSetup.socket.sendBuffer.length, 0)
    testSetup.socket.push(data)

    expect(spy).not.toHaveBeenCalledWith(json)
    assert.equal(testSetup.socket.sendBuffer.length, 1)
    readyStateSpy.mockReturnValue(1) // open
    testSetup.socket.push(data)
    expect(spy).toHaveBeenCalledWith(json)
    readyStateSpy.mockRestore()
  })
})

describe('makeRef', () => {
  test('returns next message ref', () => {
    assert.strictEqual(testSetup.socket.ref, 0)
    assert.strictEqual(testSetup.socket._makeRef(), '1')
    assert.strictEqual(testSetup.socket.ref, 1)
    assert.strictEqual(testSetup.socket._makeRef(), '2')
    assert.strictEqual(testSetup.socket.ref, 2)
  })

  test('restarts for overflow', () => {
    testSetup.socket.ref = Number.MAX_SAFE_INTEGER + 1

    assert.strictEqual(testSetup.socket._makeRef(), '0')
    assert.strictEqual(testSetup.socket.ref, 0)
  })
})

describe('sendHeartbeat', () => {
  const {
    beforeEach: setupConnected,
    afterEach: teardownConnected,
    getSetup,
  } = testSuites.clientWithConnection({ connect: true })

  beforeEach(() => {
    setupConnected()
    // Override testSetup to use the connected setup
    Object.assign(testSetup, getSetup())
  })

  test("closes socket when heartbeat is not ack'd within heartbeat window", () => {
    const readyStateSpy = vi.spyOn(testSetup.socket.conn!, 'readyState', 'get').mockReturnValue(1) // open
    testSetup.socket.sendHeartbeat()
    assert.equal(testSetup.socket.connectionState(), 'open')

    readyStateSpy.mockReturnValue(3) // closed
    testSetup.socket.sendHeartbeat()
    assert.equal(testSetup.socket.connectionState(), 'closed')
    readyStateSpy.mockRestore()
  })

  test('pushes heartbeat data when connected', () => {
    const readyStateSpy = vi.spyOn(testSetup.socket.conn!, 'readyState', 'get').mockReturnValue(1) // open

    const spy = vi.spyOn(testSetup.socket.conn!, 'send')
    const data = '{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"1"}'

    testSetup.socket.sendHeartbeat()
    expect(spy).toHaveBeenCalledWith(data)
    readyStateSpy.mockRestore()
  })

  test('no ops when not connected', () => {
    const readyStateSpy = vi.spyOn(testSetup.socket.conn!, 'readyState', 'get').mockReturnValue(0) // connecting

    const spy = vi.spyOn(testSetup.socket.conn!, 'send')
    const data = '{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"1"}'

    testSetup.socket.sendHeartbeat()
    expect(spy).not.toHaveBeenCalledWith(data)
    readyStateSpy.mockRestore()
  })

  test('handles heartbeat timeout and triggers reconnection', async () => {
    vi.spyOn(testSetup.socket.conn!, 'readyState', 'get').mockReturnValue(1) // open
    const logSpy = vi.spyOn(testSetup.socket, 'log')
    const heartbeatCallbackSpy = vi.spyOn(testSetup.socket, 'heartbeatCallback')

    // Mock the close method to avoid the mock-socket issue
    const closeSpy = vi.spyOn(testSetup.socket.conn!, 'close').mockImplementation(() => {})

    // Set a pending heartbeat reference to simulate timeout condition
    testSetup.socket.pendingHeartbeatRef = 'test-ref'

    await testSetup.socket.sendHeartbeat()

    // Verify the timeout was logged
    expect(logSpy).toHaveBeenCalledWith(
      'transport',
      'heartbeat timeout. Attempting to re-establish connection'
    )

    // Verify the heartbeat callback was called with timeout
    expect(heartbeatCallbackSpy).toHaveBeenCalledWith('timeout')

    // Verify the pending heartbeat ref was cleared
    expect(testSetup.socket.pendingHeartbeatRef).toBe(null)

    // Verify close was called with correct parameters
    expect(closeSpy).toHaveBeenCalledWith(1000, 'heartbeat timeout')
  })
})

describe('flushSendBuffer', () => {
  const {
    beforeEach: setupConnected,
    afterEach: teardownConnected,
    getSetup,
  } = testSuites.clientWithConnection({ connect: true })

  beforeEach(() => {
    setupConnected()
    Object.assign(testSetup, getSetup())
  })

  test('calls callbacks in buffer when connected', () => {
    const readyStateSpy = vi.spyOn(testSetup.socket.conn!, 'readyState', 'get').mockReturnValue(1) // open
    const spy1 = vi.fn()
    const spy2 = vi.fn()
    const spy3 = vi.fn()
    testSetup.socket.sendBuffer.push(spy1)
    testSetup.socket.sendBuffer.push(spy2)

    testSetup.socket.flushSendBuffer()

    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledTimes(1)
    expect(spy3).toHaveBeenCalledTimes(0)
    readyStateSpy.mockRestore()
  })

  test('empties sendBuffer', () => {
    const readyStateSpy = vi.spyOn(testSetup.socket.conn!, 'readyState', 'get').mockReturnValue(1) // open
    testSetup.socket.sendBuffer.push(() => {})

    testSetup.socket.flushSendBuffer()

    assert.deepEqual(testSetup.socket.sendBuffer.length, 0)
    readyStateSpy.mockRestore()
  })
})

describe('onConnMessage', () => {
  beforeEach(() => {
    testSetup.socket.connect()
  })

  test('parses raw message and triggers channel event', () => {
    const message =
      '{"topic":"realtime:topic","event":"INSERT","payload":{"type":"INSERT"},"ref":"ref"}'
    const data = { data: message }

    const targetChannel = testSetup.socket.channel('topic')
    const otherChannel = testSetup.socket.channel('off-topic')

    const targetSpy = vi.spyOn(targetChannel, '_trigger')
    const otherSpy = vi.spyOn(otherChannel, '_trigger')

    testSetup.socket.pendingHeartbeatRef = '3'
    const messageEvent = new MessageEvent('message', { data: message })
    testSetup.socket.conn?.onmessage?.(messageEvent)

    // expect(targetSpy).toHaveBeenCalledWith('INSERT', {type: 'INSERT'}, 'ref')
    expect(targetSpy).toHaveBeenCalledTimes(1)
    expect(otherSpy).toHaveBeenCalledTimes(0)
  })

  test("on heartbeat events from the 'phoenix' topic, callback is called", async () => {
    let called = false
    let socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
    })
    socket.onHeartbeat((message: HeartbeatStatus) => (called = message == 'ok'))

    socket.connect()

    const message =
      '{"ref":"1","event":"phx_reply","payload":{"status":"ok","response":{}},"topic":"phoenix"}'
    const data = { data: message }

    socket.pendingHeartbeatRef = '3'
    const messageEvent = new MessageEvent('message', { data: message })
    socket.conn?.onmessage?.(messageEvent)

    assert.strictEqual(called, true)
  })

  test("on heartbeat events from the 'phoenix' topic, callback is called with error", async () => {
    let called = false
    let socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
    })
    socket.onHeartbeat((message: HeartbeatStatus) => (called = message == 'error'))

    socket.connect()

    const message =
      '{"ref":"1","event":"phx_reply","payload":{"status":"error","response":{}},"topic":"phoenix"}'
    const data = { data: message }

    socket.pendingHeartbeatRef = '3'
    const messageEvent = new MessageEvent('message', { data: message })
    socket.conn?.onmessage?.(messageEvent)

    assert.strictEqual(called, true)
  })
})

describe('custom encoder and decoder', () => {
  test('encodes to JSON by default', () => {
    let payload = { foo: 'bar' }

    testSetup.socket.encode(payload, (encoded) => {
      assert.deepStrictEqual(encoded, JSON.stringify(payload))
    })
  })

  test('allows custom encoding when using WebSocket transport', () => {
    let encoder = (payload, callback) => callback('encode works')
    testSetup.socket = new RealtimeClient(`wss://${testSetup.projectRef}/socket`, {
      transport: WebSocket,
      encode: encoder,
      params: { apikey: '123456789' },
    })

    testSetup.socket.encode({ foo: 'bar' }, (encoded) => {
      assert.deepStrictEqual(encoded, 'encode works')
    })
  })

  test('decodes JSON by default', () => {
    testSetup.socket = new RealtimeClient(`wss://${testSetup.projectRef}/socket`, {
      params: { apikey: '123456789' },
    })
    let payload = JSON.stringify({ foo: 'bar' })

    testSetup.socket.decode(payload, (decoded) => {
      assert.deepStrictEqual(decoded, { foo: 'bar' })
    })
  })

  test('allows custom decoding when using WebSocket transport', () => {
    let decoder = (_payload, callback) => callback('decode works')
    testSetup.socket = new RealtimeClient(`wss://${testSetup.projectRef}/socket`, {
      transport: WebSocket,
      decode: decoder,
      params: { apikey: '123456789' },
    })

    testSetup.socket.decode('...esoteric format...', (decoded) => {
      assert.deepStrictEqual(decoded, 'decode works')
    })
  })
})
