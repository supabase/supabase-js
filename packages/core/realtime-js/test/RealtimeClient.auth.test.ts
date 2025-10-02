import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WebSocket as MockWebSocket } from 'mock-socket'
import RealtimeClient from '../src/RealtimeClient'
import { CHANNEL_STATES, DEFAULT_VERSION } from '../src/lib/constants'
import { testBuilders, EnhancedTestSetup, testSuites } from './helpers/setup'
import { utils, authHelpers as testHelpers, authBuilders } from './helpers/auth'

let testSetup: EnhancedTestSetup

beforeEach(() => {
  testSetup = testBuilders.standardClient()
})

afterEach(() => {
  testSetup.cleanup()
  testSetup.socket.removeAllChannels()
})

describe('token setting and updates', () => {
  test("sets access token, updates channels' join payload, and pushes token to channels", async () => {
    const channel1 = testSetup.socket.channel('test-topic1')
    const channel2 = testSetup.socket.channel('test-topic2')
    const channel3 = testSetup.socket.channel('test-topic3')

    channel1.state = CHANNEL_STATES.joined
    channel2.state = CHANNEL_STATES.closed
    channel3.state = CHANNEL_STATES.joined

    channel1.joinedOnce = true
    channel2.joinedOnce = false
    channel3.joinedOnce = true

    const pushStub1 = vi.spyOn(channel1, '_push')
    const pushStub2 = vi.spyOn(channel2, '_push')
    const pushStub3 = vi.spyOn(channel3, '_push')

    const payloadStub1 = vi.spyOn(channel1, 'updateJoinPayload')
    const payloadStub2 = vi.spyOn(channel2, 'updateJoinPayload')
    const payloadStub3 = vi.spyOn(channel3, 'updateJoinPayload')
    const token = utils.generateJWT('1h')
    await testSetup.socket.setAuth(token)

    assert.strictEqual(testSetup.socket.accessTokenValue, token)

    expect(pushStub1).toHaveBeenCalledWith('access_token', {
      access_token: token,
    })
    expect(pushStub2).not.toHaveBeenCalledWith('access_token', {
      access_token: token,
    })
    expect(pushStub3).toHaveBeenCalledWith('access_token', {
      access_token: token,
    })

    expect(payloadStub1).toHaveBeenCalledWith({
      access_token: token,
      version: DEFAULT_VERSION,
    })
    expect(payloadStub2).toHaveBeenCalledWith({
      access_token: token,
      version: DEFAULT_VERSION,
    })
    expect(payloadStub3).toHaveBeenCalledWith({
      access_token: token,
      version: DEFAULT_VERSION,
    })
  })

  test("does not send message if token hasn't changed", async () => {
    const channel = testHelpers.setupSingleAuthTestChannel(testSetup.socket)
    const payloadSpy = vi.spyOn(channel, 'updateJoinPayload')
    const token = utils.generateJWT('1h')

    await testSetup.socket.setAuth(token)
    await testSetup.socket.setAuth(token)

    assert.strictEqual(testSetup.socket.accessTokenValue, token)
    expect(payloadSpy).toHaveBeenCalledTimes(1)
    expect(payloadSpy).toHaveBeenCalledWith({
      access_token: token,
      version: DEFAULT_VERSION,
    })
  })

  test("sets access token, updates channels' join payload, and pushes token to channels if is not a jwt", async () => {
    const channels = testHelpers.setupAuthTestChannels(testSetup.socket)
    const spies = testHelpers.setupAuthTestSpies(channels)

    const new_token = 'sb-key'
    await testSetup.socket.setAuth(new_token)

    assert.strictEqual(testSetup.socket.accessTokenValue, new_token)
    testHelpers.assertAuthTestResults(new_token, spies, true)
  })

  test("sets access token using callback, updates channels' join payload, and pushes token to channels", async () => {
    const new_token = utils.generateJWT('1h')
    const new_socket = new RealtimeClient(testSetup.url, {
      transport: MockWebSocket,
      accessToken: () => Promise.resolve(new_token),
      params: { apikey: '123456789' },
    })

    const channels = testHelpers.setupAuthTestChannels(new_socket)
    const spies = testHelpers.setupAuthTestSpies(channels)

    await new_socket.setAuth()

    assert.strictEqual(new_socket.accessTokenValue, new_token)
    testHelpers.assertAuthTestResults(new_token, spies, true)
  })

  test("overrides access token, updates channels' join payload, and pushes token to channels", () => {
    const channels = testHelpers.setupAuthTestChannels(testSetup.socket)
    const spies = testHelpers.setupAuthTestSpies(channels)

    const new_token = 'override'
    testSetup.socket.setAuth(new_token)

    assert.strictEqual(testSetup.socket.accessTokenValue, new_token)
    testHelpers.assertAuthTestResults(new_token, spies, true)
  })
})

describe('auth during connection states', () => {
  test('handles setAuth errors gracefully during connection', async () => {
    const errorMessage = 'Token fetch failed'
    const accessToken = vi.fn(() => Promise.reject(new Error(errorMessage)))
    const logSpy = vi.fn()

    const socketWithError = new RealtimeClient(testSetup.url, {
      transport: MockWebSocket,
      accessToken,
      logger: logSpy,
      params: { apikey: '123456789' },
    })

    socketWithError.connect()

    await new Promise((resolve) => setTimeout(() => resolve(undefined), 100))

    // Verify that the error was logged
    expect(logSpy).toHaveBeenCalledWith('error', 'error setting auth in connect', expect.any(Error))

    // Verify that the connection was still established despite the error
    assert.ok(socketWithError.conn, 'connection should still exist')
    assert.equal(socketWithError.conn!.url, socketWithError.endpointURL())
  })

  test('updates auth token during heartbeat', async () => {
    const {
      beforeEach: setupConnected,
      afterEach: teardownConnected,
      getSetup,
    } = testSuites.clientWithConnection({ connect: true })

    setupConnected()
    const connectedSetup = getSetup()
    const token = utils.generateJWT('1h')
    const setAuthSpy = vi.spyOn(connectedSetup.socket, 'setAuth')
    const sendSpy = vi.spyOn(connectedSetup.socket.conn as WebSocket, 'send')

    const readyStateSpy = vi
      .spyOn(connectedSetup.socket.conn!, 'readyState', 'get')
      .mockReturnValue(1)
    const tokenSpy = vi
      .spyOn(connectedSetup.socket, 'accessTokenValue', 'get')
      .mockReturnValue(token)

    const heartbeatData = '{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"1"}'

    await connectedSetup.socket.sendHeartbeat()

    expect(sendSpy).toHaveBeenCalledWith(heartbeatData)
    expect(setAuthSpy).toHaveBeenCalled()
    expect(setAuthSpy).toHaveBeenCalledTimes(1)
    readyStateSpy.mockRestore()
    tokenSpy.mockRestore()
    teardownConnected()
  })

  test('uses new token after reconnect', async () => {
    const tokens = ['initial-token', 'refreshed-token']

    let callCount = 0
    const accessToken = vi.fn(() => Promise.resolve(tokens[callCount++]))

    const socket = new RealtimeClient(testSetup.url, {
      transport: MockWebSocket,
      accessToken,
      params: { apikey: '123456789' },
    })
    socket.connect()

    // Wait for the async setAuth call to complete
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(accessToken).toHaveBeenCalledTimes(1)
    expect(socket.accessTokenValue).toBe(tokens[0])

    // Call the callback and wait for async operations to complete
    await socket.reconnectTimer.callback()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(socket.accessTokenValue).toBe(tokens[1])
    expect(accessToken).toHaveBeenCalledTimes(2)
  })
})
