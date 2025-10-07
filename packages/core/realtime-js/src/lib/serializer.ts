// This file draws heavily from https://github.com/phoenixframework/phoenix/commit/cf098e9cf7a44ee6479d31d911a97d3c7430c6fe
// License: https://github.com/phoenixframework/phoenix/blob/master/LICENSE.md
import { CHANNEL_EVENTS } from '../lib/constants'

type Msg<T> = {
  join_ref: string
  ref: string
  topic: string
  event: string
  payload: T
}

export default class Serializer {
  HEADER_LENGTH = 1
  META_LENGTH = 4
  KINDS = { push: 0, reply: 1, broadcast: 2 }

  encode(msg: Msg<string | ArrayBuffer>, callback: Function) {
    if (msg.payload.constructor === ArrayBuffer) {
      console.log('Encoding binary', msg)
      return callback(this._binaryEncode(msg as Msg<ArrayBuffer>))
    } else {
      console.log('Encoding string', msg)
      let payload = [msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload]
      return callback(JSON.stringify(payload))
    }
  }

  decode(rawPayload: ArrayBuffer | string, callback: Function) {
    if (rawPayload.constructor === ArrayBuffer) {
      let result = this._binaryDecode(rawPayload)
      console.log('Decoding binary message', result)
      return callback(result)
    }

    if (typeof rawPayload === 'string') {
      console.log('Decoding text message', JSON.parse(rawPayload))
      const jsonPayload = JSON.parse(rawPayload)
      // if (Array.isArray(jsonPayload)) {
      const [join_ref, ref, topic, event, payload] = jsonPayload
      return callback({ join_ref, ref, topic, event, payload })
      // } else {
      //   let { join_ref, ref, topic, event, payload } = jsonPayload
      //   return callback({ join_ref, ref, topic, event, payload })
      // }
    }

    // return callback({})
  }

  private _binaryEncode(message: Msg<ArrayBuffer>) {
    const { join_ref, ref, event, topic, payload } = message
    const metaLength = this.META_LENGTH + join_ref.length + ref.length + topic.length + event.length
    const header = new ArrayBuffer(this.HEADER_LENGTH + metaLength)
    let view = new DataView(header)
    let offset = 0

    view.setUint8(offset++, this.KINDS.push) // kind
    view.setUint8(offset++, join_ref.length)
    view.setUint8(offset++, ref.length)
    view.setUint8(offset++, topic.length)
    view.setUint8(offset++, event.length)
    Array.from(join_ref, (char) => view.setUint8(offset++, char.charCodeAt(0)))
    Array.from(ref, (char) => view.setUint8(offset++, char.charCodeAt(0)))
    Array.from(topic, (char) => view.setUint8(offset++, char.charCodeAt(0)))
    Array.from(event, (char) => view.setUint8(offset++, char.charCodeAt(0)))

    var combined = new Uint8Array(header.byteLength + payload.byteLength)
    combined.set(new Uint8Array(header), 0)
    combined.set(new Uint8Array(payload), header.byteLength)

    return combined.buffer
  }

  private _binaryDecode(buffer: ArrayBuffer) {
    const view = new DataView(buffer)
    const kind = view.getUint8(0)
    const decoder = new TextDecoder()
    switch (kind) {
      case this.KINDS.push:
        return this._decodePush(buffer, view, decoder)
      case this.KINDS.reply:
        return this._decodeReply(buffer, view, decoder)
      case this.KINDS.broadcast:
        return this._decodeBroadcast(buffer, view, decoder)
    }
  }

  private _decodePush(
    buffer: ArrayBuffer,
    view: DataView,
    decoder: TextDecoder
  ): {
    join_ref: string
    ref: null
    topic: string
    event: string
    payload: { [key: string]: any }
  } {
    const joinRefSize = view.getUint8(1)
    const topicSize = view.getUint8(2)
    const eventSize = view.getUint8(3)
    let offset = this.HEADER_LENGTH + this.META_LENGTH - 1 // pushes have no ref
    const joinRef = decoder.decode(buffer.slice(offset, offset + joinRefSize))
    offset = offset + joinRefSize
    const topic = decoder.decode(buffer.slice(offset, offset + topicSize))
    offset = offset + topicSize
    const event = decoder.decode(buffer.slice(offset, offset + eventSize))
    offset = offset + eventSize
    const data = JSON.parse(decoder.decode(buffer.slice(offset, buffer.byteLength)))
    return {
      join_ref: joinRef,
      ref: null,
      topic: topic,
      event: event,
      payload: data,
    }
  }

  private _decodeReply(
    buffer: ArrayBuffer,
    view: DataView,
    decoder: TextDecoder
  ): {
    join_ref: string
    ref: string
    topic: string
    event: CHANNEL_EVENTS.reply
    payload: { status: string; response: { [key: string]: any } }
  } {
    const joinRefSize = view.getUint8(1)
    const refSize = view.getUint8(2)
    const topicSize = view.getUint8(3)
    const eventSize = view.getUint8(4)
    let offset = this.HEADER_LENGTH + this.META_LENGTH
    const joinRef = decoder.decode(buffer.slice(offset, offset + joinRefSize))
    offset = offset + joinRefSize
    const ref = decoder.decode(buffer.slice(offset, offset + refSize))
    offset = offset + refSize
    const topic = decoder.decode(buffer.slice(offset, offset + topicSize))
    offset = offset + topicSize
    const event = decoder.decode(buffer.slice(offset, offset + eventSize))
    offset = offset + eventSize
    const data = JSON.parse(decoder.decode(buffer.slice(offset, buffer.byteLength)))
    const payload = { status: event, response: data }
    return {
      join_ref: joinRef,
      ref: ref,
      topic: topic,
      event: CHANNEL_EVENTS.reply,
      payload: payload,
    }
  }

  private _decodeBroadcast(
    buffer: ArrayBuffer,
    view: DataView,
    decoder: TextDecoder
  ): {
    join_ref: null
    ref: null
    topic: string
    event: string
    payload: { [key: string]: any }
  } {
    const topicSize = view.getUint8(1)
    const eventSize = view.getUint8(2)
    let offset = this.HEADER_LENGTH + 2
    const topic = decoder.decode(buffer.slice(offset, offset + topicSize))
    offset = offset + topicSize
    const event = decoder.decode(buffer.slice(offset, offset + eventSize))
    offset = offset + eventSize
    const data = JSON.parse(decoder.decode(buffer.slice(offset, buffer.byteLength)))

    return { join_ref: null, ref: null, topic: topic, event: event, payload: data }
  }
}
