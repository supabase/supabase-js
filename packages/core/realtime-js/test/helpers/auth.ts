import { vi, expect, Mock } from 'vitest'
import jwt from 'jsonwebtoken'
import RealtimeClient from '../../src/RealtimeClient'
import { DEFAULT_VERSION } from '../../src/lib/constants'
import { BuilderOptions, setupRealtimeTest, TestSetup } from './setup'

/**
 * Generates a JWT token for testing
 */
export function generateJWT(exp: string = '1h'): string {
  return jwt.sign({}, 'your-256-bit-secret', {
    algorithm: 'HS256',
    expiresIn: exp,
  })
}
/**
 * Creates a RealtimeClient with authentication pre-configured
 */
export function setupAuthTest(token?: string, options: BuilderOptions = {}): TestSetup {
  const authToken = token || generateJWT('1h')

  const setup = setupRealtimeTest({
    ...options,
    accessToken: () => Promise.resolve(authToken),
  })

  // Set the token immediately for synchronous access
  setup.client.accessTokenValue = authToken

  return setup
}

// Auth-specific Test Helpers
export const authHelpers = {
  /**
   * Setup channels with different states for setAuth testing
   */
  async setupAuthTestChannels(socket: RealtimeClient) {
    const channel1 = socket.channel('test-topic1')
    const channel2 = socket.channel('test-topic2')
    const channel3 = socket.channel('test-topic3')

    let subscribedChan1 = false
    let subscribedChan3 = false

    channel1.subscribe((status) => {
      if (status == 'SUBSCRIBED') subscribedChan1 = true
    })
    channel3.subscribe((status) => {
      if (status == 'SUBSCRIBED') subscribedChan3 = true
    })

    await vi.waitFor(() => {
      expect(subscribedChan1).toBe(true)
      expect(subscribedChan3).toBe(true)
    })

    return {
      channels: [channel1, channel2, channel3],
      topics: ['test-topic1', 'test-topic2', 'test-topic3'],
    }
  },

  async setupAuthTestChannel(socket: RealtimeClient) {
    const channel = socket.channel('test-topic')
    let subscribed = false

    channel.subscribe((status) => {
      if (status == 'SUBSCRIBED') subscribed = true
    })
    await vi.waitFor(() => expect(subscribed).toBe(true))

    return channel
  },

  /**
   * Assert auth test expectations
   */
  async assertPushes(token: string, dataSpy: Mock, topics: string[]) {
    await vi.waitFor(() =>
      topics.forEach((topic) => {
        expect(dataSpy).toBeCalledWith(`realtime:${topic}`, 'access_token', { access_token: token })
      })
    )

    expect(dataSpy).toBeCalledTimes(topics.length)
  },
}

// Utility exports for backward compatibility
export const utils = {
  generateJWT,
}

// Legacy exports for backward compatibility
export const testHelpers = authHelpers
