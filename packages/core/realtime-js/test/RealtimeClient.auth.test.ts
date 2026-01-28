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
    assert.deepEqual(channel1.joinPush.payload(), {
      access_token: token,
      version: DEFAULT_VERSION,
    })

    assert.deepEqual(channel2.joinPush.payload(), {
      access_token: token,
      version: DEFAULT_VERSION,
    })

    assert.deepEqual(channel3.joinPush.payload(), {
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

    vi.waitFor(() => assert.strictEqual(testSetup.client.accessTokenValue, new_token))

    assert.deepEqual(channel1.joinPush.payload(), {
      access_token: new_token,
      version: DEFAULT_VERSION,
    })

    assert.deepEqual(channel2.joinPush.payload(), {
      access_token: new_token,
      version: DEFAULT_VERSION,
    })

    assert.deepEqual(channel3.joinPush.payload(), {
      access_token: new_token,
      version: DEFAULT_VERSION,
    })

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
    await vi.waitFor(() => {
      expect(heartbeatSetup.emitters.connected).toBeCalled()
    })

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
      onConnectionCallback: (socket) => {
        console.log('CLOSING SOCKET')
        socket.close()
      },
    })

    testSetup.connect()

    // Wait for initial token to be set
    await vi.waitFor(() => {
      expect(accessToken).toHaveBeenCalledTimes(1)
      expect(testSetup.client.accessTokenValue).toBe(initialToken)
    })
    accessToken.mockClear()

    testSetup.client.reconnectTimer!.callback()

    // Wait for the refreshed token to be set
    await vi.waitFor(() => {
      expect(testSetup.client.accessTokenValue).toBe(refreshedToken)
      expect(accessToken).toHaveBeenCalledTimes(1)
    })

    testSetup.cleanup()
  })
})
