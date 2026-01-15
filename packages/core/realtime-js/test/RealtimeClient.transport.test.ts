import { vi, beforeEach, afterEach, describe, test, expect } from "vitest"
import { setupRealtimeTest, type TestSetup } from "./helpers/setup";
import assert from "assert";
import { LongPoll } from "phoenix";
import { WebSocketLike } from "../src/lib/websocket-factory";

let testSetup: TestSetup

describe('push', () => {
  beforeEach(() => {
    testSetup = setupRealtimeTest()
  })

  afterEach(() => {
    testSetup.cleanup()
  })

  const data = {
    topic: 'topic',
    event: 'event',
    payload: 'payload',
    ref: 'ref',
  }
  const json = '{"topic":"topic","event":"event","payload":"payload","ref":"ref"}'

  test('sends data to connection when connected', async () => {
    testSetup.connect()
    await vi.waitFor(() => expect(testSetup.emitters.connected).toHaveBeenCalled())

    const spy = vi.spyOn(testSetup.client.socketAdapter.getSocket().conn!, "send")
    testSetup.client.push(data)
    expect(spy).toHaveBeenCalledWith(json)
  })

  test('buffers data when not connected and flushes the buffer after connection', async () => {
    assert.equal(testSetup.client.socketAdapter.getSocket().sendBuffer.length, 0)
    testSetup.client.push(data)
    assert.equal(testSetup.client.socketAdapter.getSocket().sendBuffer.length, 1)

    testSetup.connect()
    const spy = vi.spyOn(testSetup.client.socketAdapter.getSocket().conn!, "send")
    await vi.waitFor(() => expect(spy).toHaveBeenCalledWith(json))
    assert.equal(testSetup.client.socketAdapter.getSocket().sendBuffer.length, 0)
  })
})

describe('custom encoder and decoder', () => {
  test('encodes to JSON by default', () => {
    testSetup = setupRealtimeTest()
    let payload = { foo: 'bar' }

    testSetup.client.encode(payload, (encoded: string) => {
      assert.deepStrictEqual(encoded, JSON.stringify(payload))
    })
  })

  test('decodes JSON by default', () => {
    testSetup = setupRealtimeTest()
    let payload = JSON.stringify({ foo: 'bar' })

    testSetup.client.decode(payload, (decoded: any) => {
      assert.deepStrictEqual(decoded, { foo: 'bar' })
    })
  })

  test('allows custom encoding when using WebSocket transport', () => {
    let encoder = (payload, callback) => callback('encode works')

    testSetup = setupRealtimeTest({
      transport: WebSocket,
      encode: encoder
    })

    testSetup.client.encode({ foo: 'bar' }, (encoded) => {
      assert.deepStrictEqual(encoded, 'encode works')
    })
  })

  test('allows custom decoding when using WebSocket transport', () => {
    let decoder = (_payload, callback) => callback('decode works')
    testSetup = setupRealtimeTest({
      transport: WebSocket,
      decode: decoder
    })

    testSetup.client.decode('...esoteric format...', (decoded) => {
      assert.deepStrictEqual(decoded, 'decode works')
    })
  })
})
