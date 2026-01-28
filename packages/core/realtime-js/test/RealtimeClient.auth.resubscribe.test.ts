import assert from 'assert'
import { describe, expect, test, vi } from 'vitest'
import { DEFAULT_PHX_JOIN_PAYLOAD, setupRealtimeTest } from './helpers/setup'
import { utils } from './helpers/auth'

describe('Custom JWT token preservation', () => {
  test('preserves access token when resubscribing after removeChannel', async () => {
    // Test scenario:
    // 1. Set custom JWT via setAuth (not using accessToken callback)
    // 2. Subscribe to private channel
    // 3. removeChannel
    // 4. Create new channel with same topic and subscribe

    const topic = 'conversation:dc3fb8c1-ceef-4c00-9f92-e496acd03593'
    const customToken = utils.generateJWT('1h')

    const testSetup = setupRealtimeTest()

    // Step 1: Set auth with custom token (mimics user's setup)
    await testSetup.client.setAuth(customToken)

    // Verify token was set
    assert.strictEqual(testSetup.client.accessTokenValue, customToken)

    // Step 2: Create and subscribe to private channel (first time)
    const channel1 = testSetup.client.channel(topic, {
      config: { private: true },
    })

    channel1.subscribe()

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toBeCalledWith(`realtime:${topic}`, 'phx_join', {
        ...DEFAULT_PHX_JOIN_PAYLOAD,
        access_token: customToken,
      })
    )

    // Step 3: Remove channel (mimics user cleanup)
    await testSetup.client.removeChannel(channel1)

    await vi.waitFor(() => {
      expect(testSetup.emitters.message).toBeCalledWith(`realtime:${topic}`, 'phx_leave', {})
    })

    // Verify channel was removed
    expect(testSetup.client.getChannels()).not.toContain(channel1)

    // Step 4: Create NEW channel with SAME topic and subscribe
    const channel2 = testSetup.client.channel(topic, {
      config: { private: true },
    })

    // This should be a different channel instance
    expect(channel2).not.toBe(channel1)

    channel2.subscribe()

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toBeCalledWith(`realtime:${topic}`, 'phx_join', {
        ...DEFAULT_PHX_JOIN_PAYLOAD,
        access_token: customToken,
      })
    )

    await vi.waitFor(() => expect(channel2.state).toBe('joined'))

    testSetup.cleanup()
    testSetup.client.removeAllChannels()
  })

  test('supports accessToken callback for token rotation', async () => {
    // Verify that callback-based token fetching works correctly
    const customToken = utils.generateJWT('1h')
    let callCount = 0

    const clientWithCallback = setupRealtimeTest({
      accessToken: async () => {
        callCount++
        return customToken
      },
    })

    const channel_topic = 'conversation:test'
    const realtime_channel_topic = `realtime:${channel_topic}`

    // Set initial auth
    await clientWithCallback.client.setAuth()

    // Create and subscribe to first channel
    const channel1 = clientWithCallback.client.channel(channel_topic, {
      config: { private: true },
    })

    channel1.subscribe()

    await vi.waitFor(() =>
      expect(clientWithCallback.emitters.message).toBeCalledWith(
        realtime_channel_topic,
        'phx_join',
        {
          ...DEFAULT_PHX_JOIN_PAYLOAD,
          access_token: customToken,
        }
      )
    )

    // Remove and recreate
    await clientWithCallback.client.removeChannel(channel1)

    await vi.waitFor(() => {
      expect(clientWithCallback.emitters.message).toBeCalledWith(
        realtime_channel_topic,
        'phx_leave',
        {}
      )
    })

    const channel2 = clientWithCallback.client.channel(channel_topic, {
      config: { private: true },
    })

    channel2.subscribe()

    await vi.waitFor(() =>
      expect(clientWithCallback.emitters.message).toBeCalledWith(
        realtime_channel_topic,
        'phx_join',
        {
          ...DEFAULT_PHX_JOIN_PAYLOAD,
          access_token: customToken,
        }
      )
    )

    clientWithCallback.cleanup()
  })

  test('preserves token when subscribing to different topics', async () => {
    const testSetup = setupRealtimeTest()

    const customToken = utils.generateJWT('1h')
    await testSetup.client.setAuth(customToken)

    // Subscribe to first topic
    const channel1 = testSetup.client.channel('topic1', { config: { private: true } })

    channel1.subscribe()

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toBeCalledWith('realtime:topic1', 'phx_join', {
        ...DEFAULT_PHX_JOIN_PAYLOAD,
        access_token: customToken,
      })
    )

    await testSetup.client.removeChannel(channel1)

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toBeCalledWith('realtime:topic1', 'phx_leave', {})
    )

    // Subscribe to DIFFERENT topic

    const channel2 = testSetup.client.channel('topic2', { config: { private: true } })

    channel2.subscribe()

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toBeCalledWith('realtime:topic2', 'phx_join', {
        ...DEFAULT_PHX_JOIN_PAYLOAD,
        access_token: customToken,
      })
    )

    testSetup.cleanup()
    testSetup.client.removeAllChannels()
  })

  test('handles accessToken callback errors gracefully during subscribe', async () => {
    const errorMessage = 'Token fetch failed during subscribe'
    const token = 'initial_token'
    let calledOnce = false

    const accessToken = vi.fn(() => {
      if (!calledOnce) {
        calledOnce = true
        return Promise.resolve(token)
      }
      return Promise.reject(new Error(errorMessage))
    })

    const logSpy = vi.fn()

    const testSetup = setupRealtimeTest({
      accessToken,
      logger: logSpy,
    })

    // First subscribe should work
    await testSetup.client.setAuth()
    const channel1 = testSetup.client.channel('test', { config: { private: true } })
    channel1.subscribe()

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toBeCalledWith('realtime:test', 'phx_join', {
        ...DEFAULT_PHX_JOIN_PAYLOAD,
        access_token: token,
      })
    )

    expect(testSetup.client.accessTokenValue).toBe(token)

    // Remove and resubscribe - callback will fail but should fall back
    await testSetup.client.removeChannel(channel1)

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toBeCalledWith('realtime:test', 'phx_leave', {})
    )

    const channel2 = testSetup.client.channel('test', { config: { private: true } })
    channel2.subscribe()

    await vi.waitFor(() =>
      expect(testSetup.emitters.message).toBeCalledWith('realtime:test', 'phx_join', {
        ...DEFAULT_PHX_JOIN_PAYLOAD,
        access_token: token,
      })
    )

    // Verify error was logged
    expect(logSpy).toHaveBeenCalledWith(
      'error',
      'Error fetching access token from callback',
      expect.any(Error)
    )

    // Verify subscription still succeeded with cached token
    expect(testSetup.client.accessTokenValue).toBe(token)

    testSetup.cleanup()
  })
})
