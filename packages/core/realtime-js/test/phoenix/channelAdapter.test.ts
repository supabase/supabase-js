import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import ChannelAdapter from '../../src/phoenix/channelAdapter'
import { phxReply, setupRealtimeTest, TestSetup, waitForChannelSubscribed } from '../helpers/setup'
import RealtimeChannel from '../../src/RealtimeChannel'
import { MAX_PUSH_BUFFER_SIZE } from '../../src/lib/constants'

const defaultTimeout = 1000
const logSpy = vi.fn()

let testSetup: TestSetup
let channel: RealtimeChannel
let channelAdapter: ChannelAdapter

beforeEach(() => {
  testSetup = setupRealtimeTest({
    timeout: defaultTimeout,
    useFakeTimers: true,
    logger: logSpy,
    socketHandlers: {
      phx_join: (socket, message) => {
        socket.send(phxReply(message, { status: 'ok', response: { postgres_changes: [] } }))
      },
    },
  })

  channel = testSetup.client.channel('test')
  channelAdapter = channel.channelAdapter
})

afterEach(() => {
  logSpy.mockClear()
  testSetup.cleanup()
})

describe('push', () => {
  test('throws error when pushed before joining ', () => {
    vi.spyOn(channelAdapter.getChannel(), 'push').mockImplementation(() => {
      throw new Error('Some error')
    })
    expect(() => {
      channelAdapter.push('event', { payload: true })
    }).toThrowError(
      "tried to push 'event' to 'realtime:test' before joining. Use channel.subscribe() before pushing events"
    )
  })

  test('should maintain buffer within size limit', async () => {
    channel.subscribe()
    await waitForChannelSubscribed(channel)
    testSetup.disconnect()
    await testSetup.socketClosed()

    logSpy.mockClear()

    // Fill buffer to capacity
    for (let i = 0; i < MAX_PUSH_BUFFER_SIZE + 5; i++) {
      channel.channelAdapter.push('test', { data: `message-${i}` })
    }

    // Buffer should not exceed max size
    expect(channel.channelAdapter.getChannel().pushBuffer.length).toBe(MAX_PUSH_BUFFER_SIZE)

    // Should have logged about discarding old pushes
    expect(logSpy).toHaveBeenCalledWith(
      'channel',
      'discarded push due to buffer overflow: test',
      expect.any(Object)
    )
    expect(logSpy).toHaveBeenCalledTimes(5)
  })

  test('should destroy oldest push when buffer is full', async () => {
    channel.subscribe()
    await waitForChannelSubscribed(channel)
    testSetup.disconnect()
    await testSetup.socketClosed()

    logSpy.mockClear()

    // Add one push to get a reference for spying
    channel.channelAdapter.push('test', { data: 'first' })

    // Fill buffer beyond capacity
    for (let i = 0; i < MAX_PUSH_BUFFER_SIZE; i++) {
      channel.channelAdapter.push('test', { data: `message-${i}` })
    }

    // First push should have been destroyed
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledWith('channel', expect.any(String), { data: 'first' })
    expect(channel.channelAdapter.getChannel().pushBuffer.length).toBe(MAX_PUSH_BUFFER_SIZE)
  })
})

describe('updateJoinPayload', () => {
  test('changes joinPush payload function', () => {
    expect(channelAdapter.joinPush.payload()).toStrictEqual({
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        private: false,
      },
    })
    const newPayload = { config: {} }

    channelAdapter.updateJoinPayload(newPayload)

    expect(channel.joinPush.payload()).toStrictEqual(newPayload)
  })

  test('preserves old data', () => {
    const newPayload = { access_token: 'access_token' }

    channelAdapter.updateJoinPayload(newPayload)

    expect(channel.joinPush.payload()).toStrictEqual({
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        private: false,
      },
      access_token: 'access_token',
    })
  })
})
