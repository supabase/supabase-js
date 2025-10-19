import { describe, expect, it } from 'vitest'
import Serializer from '../src/lib/serializer'
import type { Msg } from '../src/lib/serializer'

let serializer = new Serializer()

const encodeAsync = (
  serializer: Serializer,
  msg: Msg<ArrayBuffer | { [key: string]: any }>
): Promise<ArrayBuffer | string> => {
  return new Promise((resolve) => {
    serializer.encode(msg, (result: ArrayBuffer | string) => {
      resolve(result)
    })
  })
}

const decodeAsync = (
  serializer: Serializer,
  buffer: ArrayBuffer | string
): Promise<Msg<{ [key: string]: any }>> => {
  return new Promise((resolve) => {
    serializer.decode(buffer, (result: Msg<{ [key: string]: any }>) => {
      resolve(result)
    })
  })
}

let exampleMsg = { join_ref: '0', ref: '1', topic: 't', event: 'e', payload: { foo: 1 } }

let binPayload = () => {
  let buffer = new ArrayBuffer(1)
  new DataView(buffer).setUint8(0, 1)
  return buffer
}

describe('JSON', () => {
  it('encodes general pushes', async () => {
    const result = await encodeAsync(serializer, exampleMsg)
    expect(result).toBe('["0","1","t","e",{"foo":1}]')
  })

  it('decodes', async () => {
    const result = await decodeAsync(serializer, '["0","1","t","e",{"foo":1}]')
    expect(result).toEqual(exampleMsg)
  })
})

describe('binary', () => {
  it('encodes push', async () => {
    let buffer = binPayload()
    let bin = '\0\x01\x01\x01\x0101te\x01'
    let decoder = new TextDecoder()
    const result = await encodeAsync(serializer, {
      join_ref: '0',
      ref: '1',
      topic: 't',
      event: 'e',
      payload: buffer,
    })
    expect(decoder.decode(result as ArrayBuffer)).toBe(bin)
  })

  it('encodes variable length segments', async () => {
    let buffer = binPayload()
    let bin = '\0\x02\x01\x03\x02101topev\x01'
    let decoder = new TextDecoder()

    const result = await encodeAsync(serializer, {
      join_ref: '10',
      ref: '1',
      topic: 'top',
      event: 'ev',
      payload: buffer,
    })
    expect(decoder.decode(result as ArrayBuffer)).toBe(bin)
  })

  it('encodes user push with JSON broadcast', async () => {
    // 3 -> user_push
    // 2 join_ref length
    // 1 for ref length
    // 3 for topic length
    // 9 for event length
    // 10 for user event length
    // 1 for JSON encoding
    // actual join ref
    // actual ref
    // actual topic
    // actual event
    // actual user event
    // actual payload
    let bin = '\x03\x02\x01\x03\x09\x0a\x01101topbroadcastuser-event{"a":"b"}'

    let decoder = new TextDecoder()
    const result = await encodeAsync(serializer, {
      join_ref: '10',
      ref: '1',
      topic: 'top',
      event: 'broadcast',
      payload: {
        event: 'user-event',
        payload: {
          a: 'b'
        }
      }
    })
    expect(decoder.decode(result as ArrayBuffer)).toBe(bin)

  })

  it('decodes push payload as JSON', async () => {
    let bin = '\0\x03\x03\n123topsome-event{"a":"b"}'
    let buffer = new TextEncoder().encode(bin).buffer

    const result = await decodeAsync(serializer, buffer)

    expect(result.join_ref).toBe('123')
    expect(result.ref).toBeNull()
    expect(result.topic).toBe('top')
    expect(result.event).toBe('some-event')
    expect(result.payload.constructor).toBe(Object)
    expect(result.payload).toStrictEqual({ a: 'b' })
  })

  it('decodes reply payload as JSON', async () => {
    let bin = '\x01\x03\x02\x03\x0210012topok{"a":"b"}'
    let buffer = new TextEncoder().encode(bin).buffer

    const result = await decodeAsync(serializer, buffer)

    expect(result.join_ref).toBe('100')
    expect(result.ref).toBe('12')
    expect(result.topic).toBe('top')
    expect(result.event).toBe('phx_reply')
    expect(result.payload.status).toBe('ok')
    expect(result.payload.response.constructor).toBe(Object)
    expect(result.payload.response).toStrictEqual({ a: 'b' })
  })

  it('decodes broadcast payload as JSON', async () => {
    let bin = '\x02\x03\ntopsome-event{"a":"b"}'
    let buffer = new TextEncoder().encode(bin).buffer

    const result = await decodeAsync(serializer, buffer)

    expect(result.join_ref).toBeNull()
    expect(result.ref).toBeNull()
    expect(result.topic).toBe('top')
    expect(result.event).toBe('some-event')
    expect(result.payload.constructor).toBe(Object)
    expect(result.payload).toStrictEqual({ a: 'b' })
  })
})
