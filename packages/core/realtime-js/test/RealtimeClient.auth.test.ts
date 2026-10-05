import assert from 'assert'
import { describe, expect, test, vi } from 'vitest'
import { WebSocket as MockWebSocket } from 'mock-socket'
import { DEFAULT_VERSION } from '../src/lib/constants'
import { setupRealtimeTest } from './helpers/setup'
import { utils, authHelpers as testHelpers } from './helpers/auth'

describe('token setting and updates', () => {
  test("sets access token, updates channels' join payload, and pushes token to channels", async () => {
    const testSetup = setupRealtimeTest()
    const {
      channels: [channel1, channel2, channel3],
    } = await testHelpers.setupAuthTestChannels(testSetup.client)

    testSetup.emitters.message.mockClear()

    const token = utils.generateJWT('1h')
    await testSetup.client.setAuth(token)

    assert.strictEqual(testSetup.client.accessTokenValue, token)

    await testHelpers.assertPushes(token, testSetup.emitters.message, [
      'test-topic1',
      'test-topic3',
    ])

    // Check joinPush payload
    expect(channel1.joinPush.payload()).toStrictEqual({
      config: expect.any(Object),
      access_token: token,
      version: DEFAULT_VERSION,
    })

    expect(channel2.joinPush.payload()).toStrictEqual({
      config: expect.any(Object),
      access_token: token,
      version: DEFAULT_VERSION,
    })

    expect(channel3.joinPush.payload()).toStrictEqual({
      config: expect.any(Object),
      access_token: token,
      version: DEFAULT_VERSION,
    })

    testSetup.cleanup()
  })

  test("does not send message if token hasn't changed", async () => {
    const testSetup = setupRealtimeTest()
    const channel = await testHelpers.setupAuthTestChannel(testSetup.client)

    testSetup.emitters.message.mockClear()

    const token = utils.generateJWT('4h')
    assert.notEqual(token, channel.socket.accessTokenValue)

    await testSetup.client.setAuth(token)
    await testSetup.client.setAuth(token)

    await testHelpers.assertPushes(token, testSetup.emitters.message, ['test-topic'])

    assert.strictEqual(testSetup.client.accessTokenValue, token)
    testSetup.cleanup()
  })

  test("sets access token, updates channels' join payload, and pushes token to channels if is not a jwt", async () => {
    const testSetup = setupRealtimeTest()
    await testHelpers.setupAuthTestChannels(testSetup.client)

    testSetup.emitters.message.mockClear()

    const new_token = 'sb-key'
    await testSetup.client.setAuth(new_token)

    assert.strictEqual(testSetup.client.accessTokenValue, new_token)

    await testHelpers.assertPushes(new_token, testSetup.emitters.message, [
      'test-topic1',
      'test-topic3',
    ])

    testSetup.cleanup()
  })

  test("sets access token using callback, updates channels' join payload", async () => {
    const new_token = utils.generateJWT('3h')

    const testSetup = setupRealtimeTest({
      accessToken: () => Promise.resolve(new_token),
    })

    const {
      channels: [channel1, channel2, channel3],
    } = await testHelpers.setupAuthTestChannels(testSetup.client)

    testSetup.emitters.message.mockClear()

    await vi.waitFor(() => assert.strictEqual(testSetup.client.accessTokenValue, new_token))

    expect(channel1.joinPush.payload()).toStrictEqual({
      config: expect.any(Object),
      access_token: new_token,
      version: DEFAULT_VERSION,
    })

    expect(channel2.joinPush.payload()).toStrictEqual({
      config: expect.any(Object),
      access_token: new_token,
      version: DEFAULT_VERSION,
    })

    expect(channel3.joinPush.payload()).toStrictEqual({
      config: expect.any(Object),
      access_token: new_token,
      version: DEFAULT_VERSION,
    })

    testSetup.cleanup()
  })

  test("clears joined channels' auth payload when the access token callback returns null", async () => {
    const token = utils.generateJWT('3h')
    let currentToken: string | null = token
    const testSetup = setupRealtimeTest({
      accessToken: () => Promise.resolve(currentToken),
    })
    const channel = await testHelpers.setupAuthTestChannel(testSetup.client)

    await vi.waitFor(() => expect(testSetup.client.accessTokenValue).toBe(token))

    currentToken = null
    await testSetup.client.setAuth()

    expect(testSetup.client.accessTokenValue).toBeNull()
    expect(channel.joinPush.payload()).toStrictEqual({
      config: expect.any(Object),
      access_token: null,
      version: DEFAULT_VERSION,
    })

    testSetup.emitters.message.mockClear()
    channel.channelAdapter.getChannel().rejoin()
    await vi.waitFor(() => expect(testSetup.emitters.message).toHaveBeenCalled())
    const [topic, event, payload] = testSetup.emitters.message.mock.calls.at(-1)!
    expect(topic).toBe('realtime:test-topic')
    expect(event).toBe('phx_join')
    expect(payload).toStrictEqual({
      config: expect.any(Object),
      access_token: null,
      version: DEFAULT_VERSION,
    })

    testSetup.cleanup()
  })

  test('ignores stale access token callback results after sign-out', async () => {
    const token = utils.generateJWT('3h')
    const tokenResolvers: Array<(token: string | null) => void> = []
    const testSetup = setupRealtimeTest({
      accessToken: () =>
        new Promise((resolve) => {
          tokenResolvers.push(resolve)
        }),
    })
    const channel = testSetup.client.channel('test-topic')

    await testSetup.client.setAuth(token)

    const staleAuth = testSetup.client.setAuth()
    const signOutAuth = testSetup.client.setAuth()
    expect(tokenResolvers).toHaveLength(2)

    tokenResolvers[1](null)
    await signOutAuth

    expect(testSetup.client.accessTokenValue).toBeNull()

    tokenResolvers[0](token)
    await staleAuth

    expect(testSetup.client.accessTokenValue).toBeNull()
    expect(channel.joinPush.payload()).toStrictEqual({
      config: expect.any(Object),
      access_token: null,
      version: DEFAULT_VERSION,
    })

    testSetup.cleanup()
  })

  test('keeps callback auth enabled after an explicit token supersedes a pending result', async () => {
    const staleToken = utils.generateJWT('1h')
    const explicitToken = utils.generateJWT('2h')
    const refreshedToken = utils.generateJWT('3h')
    let resolveToken!: (token: string | null) => void
    const testSetup = setupRealtimeTest({
      accessToken: () =>
        new Promise((resolve) => {
          resolveToken = resolve
        }),
    })

    const staleAuth = testSetup.client.setAuth()
    await testSetup.client.setAuth(explicitToken)
    resolveToken(staleToken)
    await staleAuth

    expect(testSetup.client.accessTokenValue).toBe(explicitToken)
    expect(testSetup.client._isManualToken()).toBe(false)

    const refreshedAuth = testSetup.client.setAuth()
    resolveToken(refreshedToken)
    await refreshedAuth

    expect(testSetup.client.accessTokenValue).toBe(refreshedToken)

    testSetup.cleanup()
  })

  test('keeps the latest auth request tracked when a stale request resolves first', async () => {
    const staleToken = utils.generateJWT('1h')
    const latestToken = utils.generateJWT('2h')
    const tokenResolvers: Array<(token: string | null) => void> = []
    const accessToken = () => new Promise<string | null>((resolve) => tokenResolvers.push(resolve))
    const testSetup = setupRealtimeTest({ accessToken })

    const staleAuth = testSetup.client.setAuth()
    const latestAuth = testSetup.client.setAuth()
    tokenResolvers[0](staleToken)
    await staleAuth

    testSetup.connect()
    expect(tokenResolvers).toHaveLength(2)

    tokenResolvers[1](latestToken)
    await latestAuth
    expect(testSetup.client.accessTokenValue).toBe(latestToken)

    testSetup.cleanup()
  })

  test('does not track stale auth work after a callback re-enters setAuth', async () => {
    const explicitToken = utils.generateJWT('2h')
    let resolveStaleToken!: (token: string | null) => void
    const accessToken = vi.fn(() => {
      if (accessToken.mock.calls.length === 1) {
        void testSetup.client.setAuth(explicitToken)
        return new Promise<string | null>((resolve) => {
          resolveStaleToken = resolve
        })
      }
      return Promise.resolve(explicitToken)
    })
    const testSetup = setupRealtimeTest({ accessToken })

    const staleAuth = testSetup.client.setAuth()
    expect(testSetup.client.accessTokenValue).toBe(explicitToken)
    await Promise.resolve()

    testSetup.connect()
    expect(accessToken).toHaveBeenCalledTimes(2)

    resolveStaleToken(null)
    await staleAuth
    expect(testSetup.client.accessTokenValue).toBe(explicitToken)

    testSetup.cleanup()
  })

  test("overrides access token, updates channels' join payload, and pushes token to channels", async () => {
    const testSetup = setupRealtimeTest()

    await testHelpers.setupAuthTestChannels(testSetup.client)

    testSetup.emitters.message.mockClear()

    const new_token = 'override'
    testSetup.client.setAuth(new_token)

    assert.strictEqual(testSetup.client.accessTokenValue, new_token)

    await testHelpers.assertPushes(new_token, testSetup.emitters.message, [
      'test-topic1',
      'test-topic3',
    ])

    testSetup.cleanup()
  })
})

describe('auth during connection states', () => {
  test('handles setAuth errors gracefully during connection', async () => {
    const errorMessage = 'Token fetch failed'
    const accessToken = vi.fn(() => Promise.reject(new Error(errorMessage)))
    const logSpy = vi.fn()

    const testSetup = setupRealtimeTest({
      transport: MockWebSocket,
      accessToken,
      logger: logSpy,
      params: { apikey: '123456789' },
    })

    testSetup.connect()

    // Verify that the error was logged with more specific message
    await vi.waitFor(() =>
      expect(logSpy).toHaveBeenCalledWith(
        'error',
        'Error fetching access token from callback',
        expect.any(Error)
      )
    )

    // Verify that the connection was still established despite the error
    assert.ok(testSetup.client.socketAdapter.getSocket().conn, 'connection should still exist')
    testSetup.cleanup()
  })

  test('updates auth token during heartbeat', async () => {
    const initialToken = utils.generateJWT('1h')
    const newToken = utils.generateJWT('3h')

    // Use a mutable token that we can change between heartbeats
    let currentToken = initialToken
    const heartbeatSetup = setupRealtimeTest({
      accessToken: () => Promise.resolve(currentToken),
    })

    heartbeatSetup.connect()

    // Wait for connection to establish
    await heartbeatSetup.socketConnected()

    // Verify initial token is set
    assert.equal(heartbeatSetup.client.accessTokenValue, initialToken)

    // Change the token that the callback will return
    currentToken = newToken

    heartbeatSetup.emitters.message.mockClear()

    await heartbeatSetup.client.sendHeartbeat()

    await vi.waitFor(() => {
      expect(heartbeatSetup.emitters.message).toHaveBeenCalledWith('phoenix', 'heartbeat', {})
    })

    // Verify the token was updated during heartbeat
    assert.equal(heartbeatSetup.client.accessTokenValue, newToken)

    heartbeatSetup.cleanup()
  })

  test('uses new token after reconnect', async () => {
    const initialToken = utils.generateJWT('1h')
    const refreshedToken = utils.generateJWT('2h')
    const tokens = [initialToken, refreshedToken]
    let callCount = 0

    const accessToken = vi.fn(() => Promise.resolve(tokens[callCount++]))

    const testSetup = setupRealtimeTest({
      accessToken,
    })

    testSetup.connect()

    // Wait for initial token to be set
    await vi.waitFor(() => {
      expect(accessToken).toHaveBeenCalledTimes(1)
      expect(testSetup.client.accessTokenValue).toBe(initialToken)
    })
    accessToken.mockClear()

    testSetup.client.reconnectTimer!.callback()

    await testSetup.socketClosed()

    // Wait for the refreshed token to be set
    await vi.waitFor(() => {
      expect(accessToken).toHaveBeenCalledTimes(1)
      expect(testSetup.client.accessTokenValue).toBe(refreshedToken)
    })

    await testSetup.socketConnected()

    testSetup.cleanup()
  })
})
