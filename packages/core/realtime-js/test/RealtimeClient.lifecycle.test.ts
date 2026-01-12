import assert, { deepEqual, equal } from 'assert'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Client, WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient from '../src/RealtimeClient'
import { DEFAULT_REALTIME_URL, setupRealtimeTest } from './helpers/setup'
import { fixtures, mocks } from './helpers/lifecycle'
import { CONNECTION_STATE } from '../src/lib/constants.js'

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
    const { client, wssUrl, cleanup } = setupRealtimeTest({ ...options })

    assert.equal(client.getChannels().length, expected.channelsLength)
    assert.equal(client.sendBuffer.length, expected.sendBufferLength)
    assert.equal(client.ref, expected.ref)
    assert.equal(client.endPoint, wssUrl)
    assert.deepEqual(client.stateChangeCallbacks, {
      open: [],
      close: [],
      error: [],
      message: [],
    })
    assert.equal(client.transport, expected.transport)
    assert.equal(client.timeout, expected.timeout)
    assert.equal(client.heartbeatIntervalMs, expected.heartbeatIntervalMs)
    assert.equal(typeof client.reconnectAfterMs, 'function')

    cleanup()
  })

  test('throws error when API key is missing', () => {
    expect(() => {
      new RealtimeClient(DEFAULT_REALTIME_URL, {})
    }).toThrow('API key is required to connect to Realtime')

    expect(() => {
      new RealtimeClient(DEFAULT_REALTIME_URL, { params: {} })
    }).toThrow('API key is required to connect to Realtime')

    expect(() => {
      new RealtimeClient(DEFAULT_REALTIME_URL, { params: { apikey: null } })
    }).toThrow('API key is required to connect to Realtime')
  })

  test('sets wrapped heartbeatCallback when provided in options', () => {
    const mockCallback = () => {}

    const { client, cleanup } = setupRealtimeTest({
      heartbeatCallback: mockCallback,
    })

    // @ts-ignore - access private method
    const wrappedCallback = client._wrapHeartbeatCallback(mockCallback)

    assert.equal(client.heartbeatCallback.toString(), wrappedCallback.toString())

    cleanup()
  })

  test('defaults heartbeatCallback to noop when not provided', () => {
    const { client, cleanup } = setupRealtimeTest()

    // Should be a function (noop)
    assert.equal(typeof client.heartbeatCallback, 'function')

    // Should not throw when called
    assert.doesNotThrow(() => client.heartbeatCallback('sent'))

    cleanup()
  })
})

describe('connect with WebSocket', () => {
  test('establishes websocket connection with endpoint', async () => {
    const testSetup = setupRealtimeTest()
    testSetup.connect()

    await vi.waitFor(() => expect(testSetup.emitters.connected).toBeCalled())

    testSetup.cleanup()
  })

  test('handles WebSocket factory errors gracefully', async () => {
    // Mock WebSocketFactory to throw an error
    const { default: WebSocketFactory } = await import('../src/lib/websocket-factory.js')
    const originalGetWebsocketConstructor = WebSocketFactory.getWebSocketConstructor
    WebSocketFactory.getWebSocketConstructor = vi.fn(() => {
      return class MockWebSocket {
        constructor() {
          throw new Error('WebSocket not available in test environment')
        }
      } as unknown as typeof WebSocket
    })

    const testSetup = setupRealtimeTest()

    expect(() => {
      testSetup.client.connect()
    }).toThrow('WebSocket not available: WebSocket not available in test environment')

    assert.equal(testSetup.client.connectionState(), CONNECTION_STATE.closed)

    // Restore original method
    WebSocketFactory.getWebSocketConstructor = originalGetWebsocketConstructor
    testSetup.cleanup()
  })
})

test('disconnect', async () => {
  const testSetup = setupRealtimeTest()

  testSetup.client.connect()
  await vi.waitFor(() => expect(testSetup.emitters.connected).toHaveBeenCalled())
  equal(testSetup.client.isConnected(), true)

  testSetup.client.disconnect()
  await vi.waitFor(() => expect(testSetup.emitters.close).toHaveBeenCalled())
  equal(testSetup.client.isConnected(), false)

  testSetup.cleanup()
})

describe('connectionState', () => {
  test('defaults to closed', () => {
    const { client, cleanup } = setupRealtimeTest()
    assert.equal(client.connectionState(), 'closed')
    cleanup()
  })

  test.each(fixtures.connectionStates)(
    'returns $expected when readyState is $readyState ($name)',
    ({ readyState, expected, isConnected }) => {
      const testSetup = setupRealtimeTest()
      testSetup.client.connect()
      const spy = mocks.connectionState(testSetup.client, readyState)

      assert.equal(testSetup.client.connectionState(), expected)
      assert.equal(testSetup.client.isConnected(), isConnected)

      spy.mockRestore()
      testSetup.cleanup()
    }
  )
})

describe('Connection state management', () => {
  test('should track connection states correctly', async () => {
    const { client, cleanup, emitters } = setupRealtimeTest()

    assert.equal(client.isConnecting(), false)
    assert.equal(client.isDisconnecting(), false)

    client.connect()
    assert.equal(client.isConnecting(), true)

    await vi.waitFor(() => expect(emitters.connected).toBeCalled())
    assert.equal(client.isConnected(), true)

    client.disconnect()
    assert.equal(client.isDisconnecting(), true)

    await vi.waitFor(() => expect(emitters.close).toBeCalled())
    assert.equal(client.connectionState(), CONNECTION_STATE.closed)

    cleanup()
  })

  test('should handle connection state transitions on WebSocket events', async () => {
    let serverSocket: Client
    const { client, mockServer, cleanup } = setupRealtimeTest({
      onConnectionCallback: (socket) => {
        serverSocket = socket
      },
    })

    client.connect()
    assert.equal(client.isConnecting(), true)

    // @ts-ignore - serverSocket will be assigned
    await vi.waitFor(() => expect(serverSocket.readyState).toBe(WebSocket.OPEN))

    mockServer.close({ code: 1000, reason: 'Normal close', wasClean: true })
    assert.equal(client.isDisconnecting(), false)
    cleanup()
  })
})

describe('Race condition prevention', () => {
  test('should prevent multiple simultaneous connection attempts', () => {
    const { client, cleanup } = setupRealtimeTest()

    // Make multiple rapid connection attempts
    client.connect()
    client.connect()
    client.connect()

    // Should only have one connection attempt
    assert.equal(client.isConnecting(), true)
    assert.ok(client.socketAdapter.getSocket().conn)

    cleanup()
  })

  test('should prevent connection during disconnection', () => {
    const { client, cleanup } = setupRealtimeTest()
    client.connect()
    client.disconnect()

    // Try to connect while disconnecting
    client.connect()

    // Should not interfere with disconnection
    assert.equal(client.isDisconnecting(), true)
  })
})
