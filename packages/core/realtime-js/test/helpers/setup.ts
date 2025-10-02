import { vi } from 'vitest'
import crypto from 'crypto'
import { Server, WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient, { RealtimeClientOptions } from '../../src/RealtimeClient'
import RealtimeChannel from '../../src/RealtimeChannel'

// Constants
export const DEFAULT_URL = 'ws://localhost:4000/socket'
export const DEFAULT_API_KEY = '123456789'

// Core Interfaces
export interface TestContext {
  socket: RealtimeClient
  mockServer: Server
  url: string
}

export interface TestSetup {
  socket: RealtimeClient
  mockServer: Server
  url: string
  projectRef: string
  clock?: any
}

export interface EnhancedTestSetup extends TestSetup {
  cleanup: () => void
  connect: () => void
  disconnect: () => void
}

export interface BuilderOptions extends Omit<RealtimeClientOptions, 'params'> {
  useFakeTimers?: boolean
  apikey?: string
  params?: Record<string, any>
  [key: string]: any
}

// Utility Functions
export const randomProjectRef = () => crypto.randomUUID()

// Core Setup Functions
export function setupRealtimeTest(options: BuilderOptions = {}): TestSetup {
  const projectRef = randomProjectRef()
  const url = `wss://${projectRef}/socket`
  const mockServer = new Server(url)

  const socket = new RealtimeClient(url, {
    transport: MockWebSocket,
    timeout: options.timeout || 1000,
    heartbeatIntervalMs: options.heartbeatIntervalMs || 25000,
    params: { apikey: options.apikey || DEFAULT_API_KEY, ...options.params },
    ...options,
  })

  const setup: TestSetup = { socket, mockServer, url, projectRef }

  if (options.useFakeTimers) {
    setup.clock = vi.useFakeTimers({ shouldAdvanceTime: true })
  }

  return setup
}

export function cleanupRealtimeTest(setup: TestSetup): void {
  try {
    setup.socket.disconnect()
  } catch (error) {
    // Ignore WebSocket cleanup errors in mock environment
  }
  try {
    setup.mockServer.stop()
  } catch (error) {
    // Ignore server cleanup errors
  }
  if (setup.clock) {
    vi.useRealTimers()
  }
  vi.resetAllMocks()
}

// Enhanced Test Builders
export const testBuilders = {
  /**
   * Creates a standard RealtimeClient setup for basic testing
   */
  standardClient(options: BuilderOptions = {}): EnhancedTestSetup {
    const setup = setupRealtimeTest(options)

    return {
      ...setup,
      cleanup: () => cleanupRealtimeTest(setup),
      connect: () => setup.socket.connect(),
      disconnect: () => setup.socket.disconnect(),
    }
  },
}

// Test Suites (Pattern-based setups)
export const testSuites = {
  /**
   * Standard setup for client tests with connection
   */
  clientWithConnection(
    options: {
      useFakeTimers?: boolean
      connect?: boolean
      timeout?: number
    } = {}
  ) {
    let testSetup: TestSetup

    const beforeEach = () => {
      testSetup = setupRealtimeTest({
        useFakeTimers: options.useFakeTimers,
        timeout: options.timeout,
      })
      if (options.connect) {
        testSetup.socket.connect()
      }
    }

    const afterEach = () => {
      cleanupRealtimeTest(testSetup)
    }

    const getSetup = () => testSetup

    return { beforeEach, afterEach, getSetup }
  },
}

// Channel Helper Functions
export function setupJoinedChannel(channel: RealtimeChannel): void {
  channel.joinedOnce = true
  channel.state = 'joined' as any
}

export function setupConnectedSocket(socket: RealtimeClient): any {
  return vi.spyOn(socket, 'isConnected').mockReturnValue(true)
}

export function setupDisconnectedSocket(socket: RealtimeClient): any {
  return vi.spyOn(socket, 'isConnected').mockReturnValue(false)
}

export function setupJoinedChannelWithSocket(
  channel: RealtimeChannel,
  socket: RealtimeClient
): any {
  setupJoinedChannel(channel)
  return setupConnectedSocket(socket)
}
