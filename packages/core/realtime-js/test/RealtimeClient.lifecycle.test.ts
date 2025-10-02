import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient from '../src/RealtimeClient'
import { testBuilders, EnhancedTestSetup } from './helpers/setup'
import { fixtures, mocks } from './helpers/lifecycle'

let testSetup: EnhancedTestSetup

beforeEach(() => {
  testSetup = testBuilders.standardClient()
})

afterEach(() => {
  testSetup.cleanup()
})

describe('constructor', () => {
  test.each(
    fixtures.constructorOptions.map((fixture) => ({
      ...fixture,
      options: {
        ...fixture.options,
        ...(fixture.name === 'overrides some defaults' && {
          transport: MockWebSocket,
        }),
      },
      expected: {
        ...fixture.expected,
        ...(fixture.name === 'overrides some defaults' && {
          transport: MockWebSocket,
        }),
      },
    }))
  )('$name', ({ options, expected }) => {
    const socket = new RealtimeClient(testSetup.url, options)

    assert.equal(socket.getChannels().length, expected.channelsLength)
    assert.equal(socket.sendBuffer.length, expected.sendBufferLength)
    assert.equal(socket.ref, expected.ref)
    assert.equal(socket.endPoint, `${testSetup.url}/websocket`)
    assert.deepEqual(socket.stateChangeCallbacks, {
      open: [],
      close: [],
      error: [],
      message: [],
    })
    assert.equal(socket.transport, expected.transport)
    assert.equal(socket.timeout, expected.timeout)
    assert.equal(socket.heartbeatIntervalMs, expected.heartbeatIntervalMs)
    assert.equal(typeof socket.logger, 'function')
    assert.equal(typeof socket.reconnectAfterMs, 'function')
  })

  test('throws error when API key is missing', () => {
    expect(() => {
      new RealtimeClient(testSetup.url, {})
    }).toThrow('API key is required to connect to Realtime')

    expect(() => {
      new RealtimeClient(testSetup.url, { params: {} })
    }).toThrow('API key is required to connect to Realtime')

    expect(() => {
      new RealtimeClient(testSetup.url, { params: { apikey: null } })
    }).toThrow('API key is required to connect to Realtime')
  })

  test('defaults to Websocket transport if available', () => {
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
    })
    assert.equal(socket.transport, null)
  })

  test('sets heartbeatCallback when provided in options', () => {
    const mockCallback = () => {}
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      heartbeatCallback: mockCallback,
    })

    assert.equal(socket.heartbeatCallback, mockCallback)
  })

  test('defaults heartbeatCallback to noop when not provided', () => {
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
    })

    // Should be a function (noop)
    assert.equal(typeof socket.heartbeatCallback, 'function')

    // Should not throw when called
    assert.doesNotThrow(() => socket.heartbeatCallback('sent'))
  })
})

describe('connect with WebSocket', () => {
  test('establishes websocket connection with endpoint', () => {
    testSetup.socket.connect()
    let conn = testSetup.socket.conn
    assert.ok(conn, 'connection should exist')
    assert.equal(conn.url, testSetup.socket.endpointURL())
  })

  test('is idempotent', () => {
    testSetup.socket.connect()

    let conn = testSetup.socket.conn

    testSetup.socket.connect()
    assert.deepStrictEqual(conn, testSetup.socket.conn)
  })

  test('handles WebSocket factory errors gracefully', async () => {
    // Create a socket without transport to trigger WebSocketFactory usage
    const socketWithoutTransport = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
    })

    // Mock WebSocketFactory to throw an error
    const { default: WebSocketFactory } = await import('../src/lib/websocket-factory.js')
    const originalCreateWebSocket = WebSocketFactory.createWebSocket
    WebSocketFactory.createWebSocket = vi.fn(() => {
      throw new Error('WebSocket not available in test environment')
    })

    expect(() => {
      socketWithoutTransport.connect()
    }).toThrow('WebSocket not available: WebSocket not available in test environment')

    // Restore original method
    WebSocketFactory.createWebSocket = originalCreateWebSocket
  })
})

describe('disconnect', () => {
  test('removes existing connection', () => {
    testSetup.socket.connect()
    testSetup.socket.disconnect()

    assert.equal(testSetup.socket.conn, null)
  })

  test('calls callback', () => {
    let count = 0
    testSetup.socket.connect()
    testSetup.socket.disconnect()
    count++

    assert.equal(count, 1)
  })

  test('calls connection close callback', () => {
    testSetup.socket.connect()
    const spy = vi.spyOn(testSetup.socket.conn!, 'close')

    testSetup.socket.disconnect(1000, 'reason')

    expect(spy).toHaveBeenCalledWith(1000, 'reason')
  })

  test('does not throw when no connection', () => {
    assert.doesNotThrow(() => {
      testSetup.socket.disconnect()
    })
  })
})

describe('connectionState', () => {
  test('defaults to closed', () => {
    assert.equal(testSetup.socket.connectionState(), 'closed')
  })

  test.each(fixtures.connectionStates)(
    'returns $expected when readyState is $readyState ($name)',
    ({ readyState, expected, isConnected }) => {
      testSetup.socket.connect()
      const spy = mocks.connectionState(testSetup.socket, readyState)

      assert.equal(testSetup.socket.connectionState(), expected)
      assert.equal(testSetup.socket.isConnected(), isConnected)

      spy.mockRestore()
    }
  )
})

describe('Connection state management', () => {
  test('should track connection states correctly', () => {
    assert.equal(testSetup.socket.isConnecting(), false)
    assert.equal(testSetup.socket.isDisconnecting(), false)

    testSetup.socket.connect()
    assert.equal(testSetup.socket.isConnecting(), true)

    testSetup.socket.disconnect()
    assert.equal(testSetup.socket.isDisconnecting(), true)
  })

  test('should handle connection state transitions on WebSocket events', () => {
    testSetup.socket.connect()
    assert.equal(testSetup.socket.isConnecting(), true)

    // Simulate connection open
    const openEvent = new Event('open')
    testSetup.socket.conn?.onopen?.(openEvent)
    assert.equal(testSetup.socket.isConnecting(), false)

    // Simulate connection close
    const closeEvent = new CloseEvent('close', {
      code: 1000,
      reason: 'Normal close',
      wasClean: true,
    })
    testSetup.socket.conn?.onclose?.(closeEvent)
    assert.equal(testSetup.socket.isDisconnecting(), false)
  })
})

describe('Race condition prevention', () => {
  test('should prevent multiple simultaneous connection attempts', () => {
    // Make multiple rapid connection attempts
    testSetup.socket.connect()
    testSetup.socket.connect()
    testSetup.socket.connect()

    // Should only have one connection attempt
    assert.equal(testSetup.socket.isConnecting(), true)
    assert.ok(testSetup.socket.conn)
  })

  test('should prevent connection during disconnection', () => {
    testSetup.socket.connect()
    testSetup.socket.disconnect()

    // Try to connect while disconnecting
    testSetup.socket.connect()

    // Should not interfere with disconnection
    assert.equal(testSetup.socket.isDisconnecting(), true)
  })
})
