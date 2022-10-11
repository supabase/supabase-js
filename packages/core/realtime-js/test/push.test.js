import assert from 'assert'
import { RealtimeChannel, RealtimeClient } from '../dist/main'
import Push from '../dist/main/lib/push'

let socket, channel, push

describe('constructor', () => {
  beforeEach(() => {
    socket = new RealtimeClient('/socket', { timeout: 1234 })
  })

  afterEach(() => {
    channel.unsubscribe()
    socket.disconnect()
  })

  it('sets defaults', () => {
    channel = new RealtimeChannel('test_topic', {}, socket)
    push = new Push(channel, 'test_event')

    assert.strictEqual(push.channel, channel)
    assert.strictEqual(push.event, 'test_event')
    assert.deepEqual(push.payload, {})
    assert.strictEqual(push.timeout, 10000)
  })
})

describe('updatePayload', () => {
  beforeEach(() => {
    socket = new RealtimeClient('/socket', { timeout: 1234 })
  })

  afterEach(() => {
    channel.unsubscribe()
    socket.disconnect()
  })

  it('updates push payload', () => {
    channel = new RealtimeChannel('test_topic', {}, socket)
    push = new Push(channel, 'test_event', { test: 'test' })

    assert.deepEqual(push.payload, { test: 'test' })

    push.updatePayload({ user_token: 'token123' })

    assert.deepEqual(push.payload, { user_token: 'token123', test: 'test' })
  })
})
