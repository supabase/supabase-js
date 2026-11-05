import assert from 'assert'
import { describe, expect, test, vi } from 'vitest'
import { WebSocket as MockWebSocket } from 'mock-socket'
import { DEFAULT_VERSION } from '../src/lib/constants'
import { setupRealtimeTest, waitForChannelSubscribed } from './helpers/setup'
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

describe('auth before reconnect', () => {
  const initialToken = utils.generateJWT('1h')
  const refreshedToken = utils.generateJWT('2h')

  function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  /**
   * Connects with `initialToken` and a joined channel. Startup calls the callback more than
   * once, so `accessToken` is reset only after it has settled: each test scripts the answers
   * for the reconnect alone. `transportConnect` is the one call every reconnect goes through,
   * so spying on it says whether the socket reopened without waiting for a frame to arrive.
   */
  async function setupJoinedClient() {
    const accessToken = vi.fn<() => Promise<string | null>>(() => Promise.resolve(initialToken))
    const testSetup = setupRealtimeTest({ accessToken })
    const channel = testSetup.client.channel('auth-before-reconnect')
    channel.subscribe()
    await waitForChannelSubscribed(channel)
    await testSetup.client.setAuth()
    expect(testSetup.client.accessTokenValue).toBe(initialToken)

    accessToken.mockReset()
    testSetup.emitters.message.mockClear()
    const socket = testSetup.client.socketAdapter.getSocket()
    const transportConnect = vi.spyOn(socket, 'transportConnect' as never)

    const joinTokens = () =>
      testSetup.emitters.message.mock.calls
        .filter(([, event]) => event === 'phx_join')
        .map(([, , payload]) => payload.access_token)

    return { ...testSetup, accessToken, channel, socket, transportConnect, joinTokens }
  }

  test('rejoins with the refreshed token when no auth call was in flight', async () => {
    const testSetup = await setupJoinedClient()
    const refresh = deferred<string>()
    testSetup.accessToken.mockReturnValueOnce(refresh.promise)
    testSetup.accessToken.mockResolvedValue(refreshedToken)

    testSetup.client.reconnectTimer!.callback()
    await vi.waitFor(() => expect(testSetup.accessToken).toHaveBeenCalledTimes(1))

    // Without the awaited refresh the socket reopens in the same tick as this call, so this
    // holds on any machine speed, and the join below cannot race the callback's answer.
    expect(testSetup.transportConnect).not.toHaveBeenCalled()

    refresh.resolve(refreshedToken)

    await vi.waitFor(() => expect(testSetup.joinTokens()).toEqual([refreshedToken]))
    await waitForChannelSubscribed(testSetup.channel)
    expect(testSetup.client.accessTokenValue).toBe(refreshedToken)

    testSetup.cleanup()
  })

  test('asks the callback once before the rejoin', async () => {
    const testSetup = await setupJoinedClient()
    testSetup.accessToken.mockResolvedValue(refreshedToken)

    // Read on arrival: the join reply makes its own setAuth() call right after.
    let callsAtJoin = 0
    testSetup.emitters.message.mockImplementation((_topic, event) => {
      if (event === 'phx_join') {
        callsAtJoin = testSetup.accessToken.mock.calls.length
      }
    })

    testSetup.client.reconnectTimer!.callback()

    await vi.waitFor(() => expect(testSetup.joinTokens()).toEqual([refreshedToken]))
    expect(callsAtJoin).toBe(1)

    testSetup.cleanup()
  })

  test('reconnects with the cached token when the callback never settles', async () => {
    const testSetup = await setupJoinedClient()
    testSetup.accessToken.mockReturnValueOnce(new Promise(() => {}))
    // Set after the join, so a slow machine cannot time the join itself out.
    testSetup.socket.timeout = 50

    testSetup.client.reconnectTimer!.callback()

    await vi.waitFor(() => expect(testSetup.transportConnect).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(testSetup.joinTokens().at(-1)).toBe(initialToken))
    await waitForChannelSubscribed(testSetup.channel)

    // The next reconnect asks again instead of waiting on the promise that hung.
    testSetup.accessToken.mockReset()
    testSetup.accessToken.mockResolvedValue(refreshedToken)
    testSetup.emitters.message.mockClear()

    testSetup.client.reconnectTimer!.callback()

    await vi.waitFor(() => expect(testSetup.joinTokens().at(-1)).toBe(refreshedToken))

    testSetup.cleanup()
  })

  test('reconnects with the cached token when the callback rejects', async () => {
    const testSetup = await setupJoinedClient()
    testSetup.accessToken.mockRejectedValueOnce(new Error('no network yet'))
    testSetup.accessToken.mockResolvedValue(initialToken)

    testSetup.client.reconnectTimer!.callback()

    await vi.waitFor(() => expect(testSetup.joinTokens()).toEqual([initialToken]))

    testSetup.cleanup()
  })

  test.each([
    ['no auth call', false],
    ['an auth call', true],
  ])('stays closed when disconnect() lands in the wait, with %s in flight', async (_, inFlight) => {
    const testSetup = await setupJoinedClient()
    const refresh = deferred<string>()
    testSetup.accessToken.mockReturnValue(refresh.promise)

    const earlierAuth = inFlight ? testSetup.client.setAuth() : Promise.resolve()
    testSetup.client.reconnectTimer!.callback()
    await vi.waitFor(() => expect(testSetup.socket.conn).toBeNull())

    await testSetup.client.disconnect()
    refresh.resolve(refreshedToken)
    await earlierAuth
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(testSetup.transportConnect).not.toHaveBeenCalled()
    expect(testSetup.client.isConnected()).toBe(false)

    // The client is not stuck: an explicit connect() still works.
    testSetup.client.connect()
    await vi.waitFor(() => expect(testSetup.client.isConnected()).toBe(true))

    testSetup.cleanup()
  })

  test.each([
    ['answers', (earlier: ReturnType<typeof deferred<string>>) => earlier.resolve(initialToken)],
    ['fails', (earlier: ReturnType<typeof deferred<string>>) => earlier.reject(new Error('late'))],
  ])('keeps the token it fetched when an earlier call %s later', async (_, settle) => {
    const testSetup = await setupJoinedClient()
    const earlier = deferred<string>()
    testSetup.accessToken.mockReturnValueOnce(earlier.promise)
    testSetup.accessToken.mockResolvedValue(refreshedToken)

    // A heartbeat's refresh is still out when the socket drops.
    const earlierAuth = testSetup.client.setAuth()
    testSetup.client.reconnectTimer!.callback()

    await vi.waitFor(() => expect(testSetup.joinTokens()).toEqual([refreshedToken]))

    settle(earlier)
    await earlierAuth
    expect(testSetup.client.accessTokenValue).toBe(refreshedToken)

    testSetup.cleanup()
  })

  test('leaves a manual token alone when there is no callback', async () => {
    const testSetup = setupRealtimeTest()
    await testSetup.client.setAuth(initialToken)
    const channel = testSetup.client.channel('auth-before-reconnect')
    channel.subscribe()
    await waitForChannelSubscribed(channel)
    testSetup.emitters.message.mockClear()

    testSetup.client.reconnectTimer!.callback()

    const { message } = testSetup.emitters
    const join = expect.objectContaining({ access_token: initialToken })
    await vi.waitFor(() => expect(message).toHaveBeenCalledWith(channel.topic, 'phx_join', join))
    expect(testSetup.client.accessTokenValue).toBe(initialToken)
    expect(testSetup.client._isManualToken()).toBe(true)

    testSetup.cleanup()
  })
})
