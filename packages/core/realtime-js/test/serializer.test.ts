import { describe, expect, it } from 'vitest'
import Serializer from '../src/lib/serializer'
import type { Msg } from '../src/lib/serializer'

let serializer = new Serializer()
let decoder = new TextDecoder()

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
let missingRefExampleMsg = {
  join_ref: null,
  ref: null,
  topic: 't',
  event: 'e',
  payload: { foo: 1 },
}

// \x01\x04
let binPayload = () => {
  let buffer = new ArrayBuffer(2)
  new DataView(buffer).setUint8(0, 1)
  new DataView(buffer).setUint8(1, 4)
  return buffer
}

describe('JSON', () => {
  it('encodes', async () => {
    const result = await encodeAsync(serializer, exampleMsg)
    expect(result).toBe('["0","1","t","e",{"foo":1}]')
  })

  it('encodes missing refs', async () => {
    const result = await encodeAsync(serializer, missingRefExampleMsg)
    expect(result).toBe('[null,null,"t","e",{"foo":1}]')
  })

  it('decodes', async () => {
    const result = await decodeAsync(serializer, '["0","1","t","e",{"foo":1}]')
    expect(result).toEqual(exampleMsg)
  })

  it('decodes missing refs', async () => {
    const result = await decodeAsync(serializer, '[null,null,"t","e",{"foo":1}]')
    expect(result).toEqual(missingRefExampleMsg)
  })
})

describe('binary', () => {
  it('encodes user broadcast push with JSON payload', async () => {
    // 3 -> user_broadcast_push
    // 2 join_ref length
    // 1 for ref length
    // 3 for topic length
    // 10 for user event length
    // 1 for JSON encoding
    // actual join ref
    // actual ref
    // actual topic
    // actual user event
    // actual payload
    let bin = '\x03\x02\x01\x03\x0a\x01101topuser-event{"a":"b"}'

    const result = await encodeAsync(serializer, {
      join_ref: '10',
      ref: '1',
      topic: 'top',
      event: 'broadcast',
      payload: {
        event: 'user-event',
        payload: {
          a: 'b',
        },
      },
    })
    expect(decoder.decode(result as ArrayBuffer)).toBe(bin)
  })

  it('encodes user broadcast push with JSON payload no refs', async () => {
    // 3 -> user_broadcast_push
    // 0 join_ref length
    // 0 for ref length
    // 3 for topic length
    // 10 for user event length
    // 1 for JSON encoding
    // actual join ref
    // actual ref
    // actual topic
    // actual user event
    // actual payload
    let bin = '\x03\x00\x00\x03\x0a\x01topuser-event{"a":"b"}'

    const result = await encodeAsync(serializer, {
      topic: 'top',
      event: 'broadcast',
      payload: {
        event: 'user-event',
        payload: {
          a: 'b',
        },
      },
    })
    expect(decoder.decode(result as ArrayBuffer)).toBe(bin)
  })

  it('encodes user broadcast push with Binary payload', async () => {
    // 3 -> user_broadcast_push
    // 2 join_ref length
    // 1 for ref length
    // 3 for topic length
    // 10 for user event length
    // 0 for Binary encoding
    // actual join ref
    // actual ref
    // actual topic
    // actual user event
    // actual payload
    let bin = '\x03\x02\x01\x03\x0a\x00101topuser-event\x01\x04'

    const result = await encodeAsync(serializer, {
      join_ref: '10',
      ref: '1',
      topic: 'top',
      event: 'broadcast',
      payload: {
        event: 'user-event',
        payload: binPayload(),
      },
    })
    expect(decoder.decode(result as ArrayBuffer)).toBe(bin)
  })

  it('encodes user broadcast push with Binary payload no refs', async () => {
    // 3 -> user_broadcast_push
    // 0 join_ref length
    // 0 for ref length
    // 3 for topic length
    // 10 for user event length
    // 0 for Binary encoding
    // actual join ref
    // actual ref
    // actual topic
    // actual user event
    // actual payload
    let bin = '\x03\x00\x00\x03\x0a\x00topuser-event\x01\x04'

    const result = await encodeAsync(serializer, {
      topic: 'top',
      event: 'broadcast',
      payload: {
        event: 'user-event',
        payload: binPayload(),
      },
    })
    expect(decoder.decode(result as ArrayBuffer)).toBe(bin)
  })

  it('decodes user broadcast with JSON payload and no metadata', async () => {
    // 4 -> user_broadcast
    // 3 for topic length
    // 10 for user event length
    // 0 for metadata length
    // 1 for JSON encoding
    // actual topic
    // actual user event
    // (no metadata)
    // actual payload
    let bin = '\x04\x03\x0a\x00\x01topuser-event{"a":"b"}'
    let buffer = new TextEncoder().encode(bin).buffer

    const result = await decodeAsync(serializer, buffer)

    expect(result.join_ref).toBeNull()
    expect(result.ref).toBeNull()
    expect(result.topic).toBe('top')
    expect(result.event).toBe('broadcast')
    expect(result.payload.constructor).toBe(Object)
    expect(result.payload).toStrictEqual({
      type: 'broadcast',
      event: 'user-event',
      payload: { a: 'b' },
    })
  })

  it('decodes user broadcast with JSON payload and metadata', async () => {
    // 4 -> user_broadcast
    // 3 for topic length
    // 10 for user event length (\x0a)
    // 17 for metadata length 17 (\x11)
    // 1 for JSON encoding
    // actual topic
    // actual user event
    // actual metadata
    // actual payload
    let bin = '\x04\x03\x0a\x11\x01topuser-event{"replayed":true}{"a":"b"}'
    let buffer = new TextEncoder().encode(bin).buffer
    ;('{"replayed":true}')
    const result = await decodeAsync(serializer, buffer)

    expect(result.join_ref).toBeNull()
    expect(result.ref).toBeNull()
    expect(result.topic).toBe('top')
    expect(result.event).toBe('broadcast')
    expect(result.payload.constructor).toBe(Object)
    expect(result.payload).toStrictEqual({
      type: 'broadcast',
      event: 'user-event',
      meta: { replayed: true },
      payload: { a: 'b' },
    })
  })

  it('decodes user broadcast with binary payload and no metadata', async () => {
    // 4 -> user_broadcast
    // 3 for topic length
    // 10 for user event length (\x0a)
    // 0 for metadata length
    // 0 for binary encoding
    // actual topic
    // actual user event
    // (no metadata)
    // actual payload
    let bin = '\x04\x03\x0a\x00\x00topuser-event\x01\x04'
    let buffer = new TextEncoder().encode(bin).buffer

    const result = await decodeAsync(serializer, buffer)

    expect(result.join_ref).toBeNull()
    expect(result.ref).toBeNull()
    expect(result.topic).toBe('top')
    expect(result.event).toBe('broadcast')
    expect(result.payload.constructor).toBe(Object)
    expect(Object.keys(result.payload)).toHaveLength(3)
    expect(result.payload.type).toBe('broadcast')
    expect(result.payload.event).toBe('user-event')
    expect(decoder.decode(result.payload.payload as ArrayBuffer)).toBe('\x01\x04')
  })

  it('decodes user broadcast with binary payload and metadata', async () => {
    // 4 -> user_broadcast
    // 3 for topic length
    // 10 for user event length (\x0a)
    // 17 for metadata length 17 (\x11)
    // 0 for binary encoding
    // actual topic
    // actual user event
    // actual metadata
    // actual payload
    let bin = '\x04\x03\x0a\x11\x00topuser-event{"replayed":true}\x01\x04'
    let buffer = new TextEncoder().encode(bin).buffer

    const result = await decodeAsync(serializer, buffer)

    expect(result.join_ref).toBeNull()
    expect(result.ref).toBeNull()
    expect(result.topic).toBe('top')
    expect(result.event).toBe('broadcast')
    expect(result.payload.constructor).toBe(Object)
    expect(Object.keys(result.payload)).toHaveLength(4)
    expect(result.payload.type).toBe('broadcast')
    expect(result.payload.event).toBe('user-event')
    expect(result.payload.meta).toStrictEqual({ replayed: true })
    expect(decoder.decode(result.payload.payload as ArrayBuffer)).toBe('\x01\x04')
  })
})
