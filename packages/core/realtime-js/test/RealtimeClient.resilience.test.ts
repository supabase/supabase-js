import assert from "assert";
import { type Client } from "mock-socket"
import { beforeEach, afterEach, vi, describe, test, expect } from "vitest"
import { type EnhancedTestSetup, testBuilders } from "./helpers/setup"
import { CHANNEL_EVENTS, CHANNEL_STATES } from "../src/lib/constants";

let serverSocket: Client
let testClient: EnhancedTestSetup
let connected: boolean

beforeEach(() => {
  connected = false
  testClient = testBuilders.standardClient({
    preparation: (server) => {
      server.on('connection', (socket) => {
        serverSocket = socket;
        connected = true;
      })
      server.on('close', () => {
        connected = false;
      })
    },
  })
})

afterEach(() => {
  testClient.cleanup()
})

describe('Network failure scenarios', () => {
  test('should handle network failure and schedule reconnection', async () => {
    testClient.socket.connect()

    await vi.waitFor(() => expect(connected).toBe(true))

    serverSocket.close({ code: 1006, reason: 'Network error', wasClean: false })
    await vi.waitFor(() => expect(connected).toBe(false))

    // Verify reconnection is scheduled
    assert.ok(testClient.socket.socketAdapter.getSocket().reconnectTimer.timer)
  })

  test('should not schedule reconnection on manual disconnect', async () => {
    testClient.socket.connect()
    await vi.waitFor(() => expect(connected).toBe(true))
    testClient.socket.disconnect()

    // Verify no reconnection is scheduled
    assert.equal(testClient.socket.socketAdapter.getSocket().reconnectTimer.timer, undefined)
  })
})

describe('Heartbeat timeout handling', () => {
  test('should handle heartbeat timeout with reconnection fallback', async () => {
    testClient.socket.connect()

    // Simulate heartbeat timeout
    // @ts-ignore - accessing private property for testing
    testClient.socket.socketAdapter.socket.pendingHeartbeatRef = 'test-ref'

    // Mock connection to prevent actual WebSocket close
    const mockConn = {
      close: () => {},
      send: () => {},
      readyState: WebSocket.OPEN,
    }
    // @ts-ignore - accessing private property for testing
    testClient.socket.socketAdapter.socket.conn = mockConn as any

    // Trigger heartbeat - should detect timeout
    await testClient.socket.sendHeartbeat()

    // Should have reset manual disconnect flag
    // @ts-ignore - accessing private property for testing
    assert.equal(testClient.socket.socketAdapter.socket.closeWasClean, false)
  })
})

describe('Reconnection timer logic', () => {
  test('should use delay in reconnection callback', async () => {
    testClient.socket.connect()

    // Mock isConnected to return false initially
    const originalIsConnected = testClient.socket.isConnected
    testClient.socket.isConnected = () => false

    // Track connect calls
    let connectCalls = 0
    const originalConnect = testClient.socket.connect
    testClient.socket.connect = () => {
      connectCalls++
      return originalConnect.call(testClient.socket)
    }

    // Trigger reconnection
    testClient.socket.reconnectTimer!.callback()

    // Should not have called connect immediately
    assert.equal(connectCalls, 0)

    // Wait for the delay
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Should have called connect after delay
    assert.equal(connectCalls, 1)

    // Restore original methods
    testClient.socket.isConnected = originalIsConnected
    testClient.socket.connect = originalConnect
  })
})

describe('socket close event', () => {
  beforeEach(async () => {
    testClient.socket.connect()
    await vi.waitFor(() => expect(connected).toBe(true))
  })

  test('schedules reconnectTimer timeout', async () => {
    const spy = vi.spyOn(testClient.socket.socketAdapter.getSocket().reconnectTimer, 'scheduleTimeout')

    serverSocket.close({ code: 1000, reason: '', wasClean: true })
    await vi.waitFor(() => expect(connected).toBe(false))

    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('triggers channel error', async () => {
    const channel = testClient.socket.channel('topic')
    channel.state = CHANNEL_STATES.joined;
    const spy = vi.spyOn(channel.channelAdapter.getChannel(), 'trigger')

    serverSocket.close({ code: 1000, reason: '', wasClean: true })
    await vi.waitFor(() => expect(connected).toBe(false))

    expect(spy).toHaveBeenCalledWith(CHANNEL_EVENTS.error)
  })
})

describe('_onConnError', () => {
  beforeEach(() => {
    testClient.socket.connect()
  })

  test('triggers channel error', () => {
    const channel = testClient.socket.channel('topic')
    channel.state = CHANNEL_STATES.joined;
    const spy = vi.spyOn(channel.channelAdapter.getChannel(), 'trigger')
    testClient.mockServer.simulate('error')

    expect(spy).toHaveBeenCalledWith(CHANNEL_EVENTS.error)
  })
})
