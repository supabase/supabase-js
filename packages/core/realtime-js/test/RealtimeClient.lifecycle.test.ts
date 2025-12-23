import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Client, WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient from '../src/RealtimeClient'
import { testBuilders, EnhancedTestSetup } from './helpers/setup'
import { fixtures, mocks } from './helpers/lifecycle'
import { CONNECTION_STATE } from '../src/lib/constants.js'

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
    const socket = new RealtimeClient(testSetup.realtimeUrl, options)

    assert.equal(socket.getChannels().length, expected.channelsLength)
    assert.equal(socket.sendBuffer.length, expected.sendBufferLength)
    assert.equal(socket.ref, expected.ref)
    assert.equal(socket.endPoint, testSetup.wssUrl)
    assert.deepEqual(socket.stateChangeCallbacks, {
      open: [],
      close: [],
      error: [],
      message: [],
    })
    assert.equal(socket.transport, expected.transport)
    assert.equal(socket.timeout, expected.timeout)
    assert.equal(socket.heartbeatIntervalMs, expected.heartbeatIntervalMs)
    assert.equal(typeof socket.reconnectAfterMs, 'function')
  })

  test('throws error when API key is missing', () => {
    expect(() => {
      new RealtimeClient(testSetup.realtimeUrl, {})
    }).toThrow('API key is required to connect to Realtime')

    expect(() => {
      new RealtimeClient(testSetup.realtimeUrl, { params: {} })
    }).toThrow('API key is required to connect to Realtime')

    expect(() => {
      new RealtimeClient(testSetup.realtimeUrl, { params: { apikey: null } })
    }).toThrow('API key is required to connect to Realtime')
  })

  test('sets heartbeatCallback when provided in options', () => {
    const mockCallback = () => {}
    const socket = new RealtimeClient(testSetup.realtimeUrl, {
      params: { apikey: '123456789' },
      heartbeatCallback: mockCallback,
    })

    assert.equal(socket.heartbeatCallback, mockCallback)
  })

  test('defaults heartbeatCallback to noop when not provided', () => {
    const socket = new RealtimeClient(testSetup.realtimeUrl, {
      params: { apikey: '123456789' },
    })

    // Should be a function (noop)
    assert.equal(typeof socket.heartbeatCallback, 'function')

    // Should not throw when called
    assert.doesNotThrow(() => socket.heartbeatCallback('sent'))
  })
})

describe('connect with WebSocket', () => {
  test('establishes websocket connection with endpoint', async () => {
    let connected = false
    let testClient = testBuilders.standardClient({
      preparation: (server) => {
        server.on('connection', (socket) => {
          if (socket.readyState == socket.OPEN) {
            connected = true
          }
        })
      },
    })

    testClient.socket.connect()

    await vi.waitFor(() => expect(connected).toBe(true), { timeout: 2000, interval: 100 })

    assert.equal(connected, true)
    testClient.cleanup()
  })

  test('is idempotent', () => {
    testSetup.socket.connect()

    let conn = testSetup.socket.socketAdapter.getSocket().conn

    testSetup.socket.connect()
    assert.deepStrictEqual(conn, testSetup.socket.socketAdapter.getSocket().conn)
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

    // Create a socket without transport to trigger WebSocketFactory usage
    const socketWithoutTransport = new RealtimeClient(testSetup.realtimeUrl, {
      params: { apikey: '123456789' },
    })

    expect(() => {
      socketWithoutTransport.connect()
    }).toThrow('WebSocket not available: WebSocket not available in test environment')

    assert.equal(socketWithoutTransport.connectionState(), CONNECTION_STATE.closed)

    // Restore original method
    WebSocketFactory.getWebSocketConstructor = originalGetWebsocketConstructor
  })
})

describe('disconnect', () => {
  test('removes existing connection', async () => {
    testSetup.socket.connect()
    await testSetup.socket.disconnect()

    assert.equal(testSetup.socket.socketAdapter.getSocket().conn, null)
  })

  test('calls connection close callback', async () => {
    const expectedCode = 1000
    const expectedReason = 'reason'

    const closeSpy = vi.spyOn(MockWebSocket.prototype, 'close')

    testSetup.socket.connect()

    await vi.waitFor(() => {
      expect(testSetup.socket.socketAdapter.getSocket().conn).not.toBeNull()
    })

    testSetup.socket.disconnect(expectedCode, expectedReason)

    expect(closeSpy).toHaveBeenCalledWith(expectedCode, expectedReason)
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
  test('should track connection states correctly', async () => {
    let state = 'closed'
    let testClient = testBuilders.standardClient({
      preparation: (server) => {
        server.on('connection', (socket) => {
          if (socket.readyState == socket.OPEN) {
            state = 'connected'
          }
          socket.on('close', () => {
            state = 'closed'
          })
        })
      },
    })

    assert.equal(testClient.socket.isConnecting(), false)
    assert.equal(testClient.socket.isDisconnecting(), false)

    testClient.socket.connect()
    state = 'connecting'
    assert.equal(testClient.socket.isConnecting(), true)

    await vi.waitFor(() => expect(state).toBe('connected'), { timeout: 2000 })
    assert.equal(testClient.socket.isConnected(), true)

    testClient.socket.disconnect()
    assert.equal(testClient.socket.isDisconnecting(), true)

    await vi.waitFor(() => expect(state).toBe('closed'), { timeout: 2000 })
    assert.equal(testClient.socket.connectionState(), CONNECTION_STATE.closed)
    testClient.cleanup()
  })

  test('should handle connection state transitions on WebSocket events', async () => {
    let serverSocket: Client
    let testClient = testBuilders.standardClient({
      preparation: (server) => {
        server.on('connection', (socket) => {
          serverSocket = socket
        })
      },
    })

    testClient.socket.connect()
    assert.equal(testClient.socket.isConnecting(), true)

    await vi.waitFor(() => expect(serverSocket.readyState).toBe(WebSocket.OPEN))

    // @ts-ignore it will be defined
    serverSocket.close({ code: 1000, reason: 'Normal close', wasClean: true })
    assert.equal(testSetup.socket.isDisconnecting(), false)
    testClient.cleanup()
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
    assert.ok(testSetup.socket.socketAdapter.getSocket().conn)
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
