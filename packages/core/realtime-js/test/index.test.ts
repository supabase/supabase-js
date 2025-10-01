import { describe, test, expect } from 'vitest'
import * as RealtimeJS from '../src/index'

describe('index.ts exports', () => {
  test('should export all expected classes and types', () => {
    // Test that main classes are exported
    expect(RealtimeJS.RealtimeClient).toBeDefined()
    expect(RealtimeJS.RealtimeChannel).toBeDefined()
    expect(RealtimeJS.RealtimePresence).toBeDefined()
    expect(RealtimeJS.WebSocketFactory).toBeDefined()

    // Test that the classes are constructors
    expect(typeof RealtimeJS.RealtimeClient).toBe('function')
    expect(typeof RealtimeJS.RealtimeChannel).toBe('function')
    expect(typeof RealtimeJS.RealtimePresence).toBe('function')
    expect(typeof RealtimeJS.WebSocketFactory).toBe('function')
  })

  test('should export all expected constants', () => {
    // Test that constants are exported
    expect(RealtimeJS.REALTIME_LISTEN_TYPES).toBeDefined()
    expect(RealtimeJS.REALTIME_POSTGRES_CHANGES_LISTEN_EVENT).toBeDefined()
    expect(RealtimeJS.REALTIME_PRESENCE_LISTEN_EVENTS).toBeDefined()
    expect(RealtimeJS.REALTIME_SUBSCRIBE_STATES).toBeDefined()
    expect(RealtimeJS.REALTIME_CHANNEL_STATES).toBeDefined()

    // Test that constants have expected structure
    expect(typeof RealtimeJS.REALTIME_LISTEN_TYPES).toBe('object')
    expect(typeof RealtimeJS.REALTIME_POSTGRES_CHANGES_LISTEN_EVENT).toBe('object')
    expect(typeof RealtimeJS.REALTIME_PRESENCE_LISTEN_EVENTS).toBe('object')
    expect(typeof RealtimeJS.REALTIME_SUBSCRIBE_STATES).toBe('object')
    expect(typeof RealtimeJS.REALTIME_CHANNEL_STATES).toBe('object')
  })

  test('should be able to create instances of exported classes', () => {
    // Test RealtimeClient creation
    const client = new RealtimeJS.RealtimeClient('ws://localhost:4000/socket', {
      params: { apikey: 'test-key' },
    })
    expect(client).toBeInstanceOf(RealtimeJS.RealtimeClient)

    // Test RealtimeChannel creation
    const channel = client.channel('test-topic')
    expect(channel).toBeInstanceOf(RealtimeJS.RealtimeChannel)

    // Test RealtimePresence creation
    const presence = new RealtimeJS.RealtimePresence(channel)
    expect(presence).toBeInstanceOf(RealtimeJS.RealtimePresence)

    // Clean up
    client.disconnect()
  })
})
