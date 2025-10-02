import { vi, expect } from 'vitest'
import jwt from 'jsonwebtoken'
import RealtimeClient from '../../src/RealtimeClient'
import { DEFAULT_VERSION } from '../../src/lib/constants'
import { testBuilders, EnhancedTestSetup, BuilderOptions } from './setup'

/**
 * Generates a JWT token for testing
 */
export function generateJWT(exp: string = '1h'): string {
  return jwt.sign({}, 'your-256-bit-secret', {
    algorithm: 'HS256',
    expiresIn: exp,
  })
}

// Auth-specific Test Builders
export const authBuilders = {
  /**
   * Creates a RealtimeClient with authentication pre-configured
   */
  authClient(token?: string, options: BuilderOptions = {}): EnhancedTestSetup {
    const authToken = token || generateJWT('1h')

    const setup = testBuilders.standardClient({
      ...options,
      accessToken: () => Promise.resolve(authToken),
    })

    // Set the token immediately for synchronous access
    setup.socket.accessTokenValue = authToken

    return setup
  },
}

// Auth-specific Test Helpers
export const authHelpers = {
  /**
   * Setup channels with different states for setAuth testing
   */
  setupAuthTestChannels(socket: RealtimeClient) {
    const channel1 = socket.channel('test-topic1')
    const channel2 = socket.channel('test-topic2')
    const channel3 = socket.channel('test-topic3')

    // Set different states to test different behaviors
    channel1.state = 'joined' as any
    channel2.state = 'closed' as any
    channel3.state = 'joined' as any

    channel1.joinedOnce = true
    channel2.joinedOnce = false
    channel3.joinedOnce = true

    return { channel1, channel2, channel3 }
  },

  /**
   * Setup spies for auth test channels
   */
  setupAuthTestSpies(channels: { channel1: any; channel2: any; channel3: any }) {
    return {
      pushSpies: {
        push1: vi.spyOn(channels.channel1, '_push'),
        push2: vi.spyOn(channels.channel2, '_push'),
        push3: vi.spyOn(channels.channel3, '_push'),
      },
      payloadSpies: {
        payload1: vi.spyOn(channels.channel1, 'updateJoinPayload'),
        payload2: vi.spyOn(channels.channel2, 'updateJoinPayload'),
        payload3: vi.spyOn(channels.channel3, 'updateJoinPayload'),
      },
    }
  },

  /**
   * Assert auth test expectations
   */
  assertAuthTestResults(
    token: string,
    spies: any,
    shouldPush: boolean = true,
    callCount: number = 1
  ) {
    const { pushSpies, payloadSpies } = spies

    if (shouldPush) {
      expect(pushSpies.push1).toHaveBeenCalledWith('access_token', {
        access_token: token,
      })
      expect(pushSpies.push2).not.toHaveBeenCalledWith('access_token', {
        access_token: token,
      })
      expect(pushSpies.push3).toHaveBeenCalledWith('access_token', {
        access_token: token,
      })
    }

    if (payloadSpies.payload1) {
      expect(payloadSpies.payload1).toHaveBeenCalledTimes(callCount)
      expect(payloadSpies.payload1).toHaveBeenCalledWith({
        access_token: token,
        version: DEFAULT_VERSION,
      })
    }
    if (payloadSpies.payload2) {
      expect(payloadSpies.payload2).toHaveBeenCalledWith({
        access_token: token,
        version: DEFAULT_VERSION,
      })
    }
    if (payloadSpies.payload3) {
      expect(payloadSpies.payload3).toHaveBeenCalledWith({
        access_token: token,
        version: DEFAULT_VERSION,
      })
    }
  },

  /**
   * Setup single channel for token unchanged tests
   */
  setupSingleAuthTestChannel(socket: RealtimeClient) {
    const channel = socket.channel('test-topic')
    channel.state = 'joined' as any
    channel.joinedOnce = true
    return channel
  },
}

// Utility exports for backward compatibility
export const utils = {
  generateJWT,
}

// Legacy exports for backward compatibility
export const testHelpers = authHelpers
export { authBuilders as testBuilders }
