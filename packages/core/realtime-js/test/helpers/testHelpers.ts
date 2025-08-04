import { Server, WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient from '../../src/RealtimeClient'
import assert from 'assert'
import sinon from 'sinon'

export const DEFAULT_URL = 'ws://localhost:4000/socket'
export const DEFAULT_API_KEY = '123456789'

export interface TestContext {
  socket: RealtimeClient
  mockServer: Server
  url: string
}

/**
 * Creates a test context with a RealtimeClient and mock server
 */
export function createTestContext(
  options: {
    url?: string
    apikey?: string
    transport?: any
    [key: string]: any
  } = {}
): TestContext {
  const url = options.url || DEFAULT_URL
  const apikey = options.apikey || DEFAULT_API_KEY

  const mockServer = new Server(url)
  const socket = new RealtimeClient(url, {
    transport: MockWebSocket,
    params: { apikey, ...options.params },
    ...options,
  })

  return { socket, mockServer, url }
}

/**
 * Cleanup test context
 */
export function cleanupTestContext(context: TestContext): void {
  context.socket.disconnect()
  context.mockServer.stop()
}

/**
 * Wait for a specified amount of time
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wait for a socket to be connected
 */
export async function waitForConnection(
  socket: RealtimeClient,
  timeout = 1000
): Promise<void> {
  const startTime = Date.now()

  while (!socket.isConnected() && Date.now() - startTime < timeout) {
    await waitFor(10)
  }

  if (!socket.isConnected()) {
    throw new Error(`Socket did not connect within ${timeout}ms`)
  }
}

/**
 * Wait for a socket to be disconnected
 */
export async function waitForDisconnection(
  socket: RealtimeClient,
  timeout = 1000
): Promise<void> {
  const startTime = Date.now()

  while (socket.isConnected() && Date.now() - startTime < timeout) {
    await waitFor(10)
  }

  if (socket.isConnected()) {
    throw new Error(`Socket did not disconnect within ${timeout}ms`)
  }
}

/**
 * Common test assertions for RealtimeClient
 */
export const assertions = {
  /**
   * Assert that socket has expected default values
   */
  hasDefaults(socket: RealtimeClient): void {
    assert.equal(socket.getChannels().length, 0)
    assert.equal(socket.sendBuffer.length, 0)
    assert.equal(socket.ref, 0)
    // Note: transport is set by test context, so we don't check it here
    assert.equal(socket.timeout, 10000)
    assert.equal(socket.heartbeatIntervalMs, 25000)
    assert.equal(typeof socket.logger, 'function')
  },

  /**
   * Assert that socket is in expected connection state
   */
  isConnected(socket: RealtimeClient): void {
    assert.equal(socket.isConnected(), true)
  },

  /**
   * Assert that socket is disconnected
   */
  isDisconnected(socket: RealtimeClient): void {
    assert.equal(socket.isConnected(), false)
  },
}

/**
 * Common test patterns for spies and stubs
 */
export const spies = {
  /**
   * Create a spy for a method and return cleanup function
   */
  method(target: any, methodName: string): { spy: any; cleanup: () => void } {
    const spy = sinon.spy(target, methodName)
    return {
      spy,
      cleanup: () => spy.restore(),
    }
  },

  /**
   * Create a stub for a method with return value
   */
  stub(
    target: any,
    methodName: string,
    returnValue?: any
  ): { stub: any; cleanup: () => void } {
    const stub = sinon.stub(target, methodName)
    if (returnValue !== undefined) {
      stub.returns(returnValue)
    }
    return {
      stub,
      cleanup: () => stub.restore(),
    }
  },
}
