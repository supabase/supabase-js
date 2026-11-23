import { describe, beforeEach, afterEach, test, expect } from 'vitest'
import RealtimeChannel from '../src/RealtimeChannel'
import { setupRealtimeTest, waitForChannelSubscribed, type TestSetup } from './helpers/setup'

let channel: RealtimeChannel
let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest({ useFakeTimers: true, timeout: 1000 })
  channel = testSetup.client.channel('test-presence-proto')
})

afterEach(() => {
  channel.unsubscribe()
  testSetup.cleanup()
})

describe('presenceState() with unusual presence keys', () => {
  test('a presence key named "__proto__" is kept as an own key, not swallowed as a prototype', async () => {
    channel.on('presence', { event: 'sync' }, () => {})
    channel.subscribe()
    await waitForChannelSubscribed(channel)

    // JSON.parse creates an own "__proto__" property, as a server frame would.
    const frame = {
      alice: { metas: [{ phx_ref: '1', name: 'alice' }] },
      mallory: { metas: [{ phx_ref: '2', name: 'mallory' }] },
    }
    const json = JSON.stringify(frame).replace('"mallory"', '"__proto__"')
    const payload = JSON.parse(json)
    const message = { topic: channel.topic, event: 'presence_state', payload }
    testSetup.mockServer.emit('message', JSON.stringify(message))

    const state = channel.presenceState()

    expect(Object.keys(state).sort()).toEqual(['__proto__', 'alice'])
    expect(Object.getPrototypeOf(state)).toBe(Object.prototype)
    expect(Object.prototype.hasOwnProperty.call(state, '__proto__')).toBe(true)
    const kept = Object.getOwnPropertyDescriptor(state, '__proto__')
    expect(kept?.value).toEqual([{ name: 'mallory', presence_ref: '2' }])
  })
})
