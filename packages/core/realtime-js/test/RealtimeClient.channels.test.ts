import { beforeEach, afterEach, expect, describe, test, vi } from 'vitest'
import type { Client } from 'mock-socket'
import {
  type TestSetup,
  phxReply,
  setupRealtimeTest,
  waitForChannelSubscribed,
} from './helpers/setup'

import RealtimeChannel from '../src/RealtimeChannel'
let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest()
})

afterEach(() => {
  testSetup.cleanup()
})

describe('channel', () => {
  test('throws error on replay for a public channel', () => {
    expect(() => {
      testSetup.client.channel('topic', {
        config: { broadcast: { replay: { since: 0 } } },
      })
    }).toThrow(
      "tried to use replay on public channel 'realtime:topic'. It must be a private channel."
    )
  })

  test('returns channel with private channel using replay', () => {
    const channel = testSetup.client.channel('topic', {
      config: { private: true, broadcast: { replay: { since: 0 } } },
    })

    expect(channel.socket).toBe(testSetup.client)
    expect(channel.topic).toBe('realtime:topic')
    expect(channel.params).toStrictEqual({
      config: {
        broadcast: { replay: { since: 0 } },
        presence: { key: '', enabled: false },
        private: true,
      },
    })
  })

  test('returns channel with given topic and params for a private channel', () => {
    const channel = testSetup.client.channel('topic', { config: { private: true } })

    expect(channel.socket).toBe(testSetup.client)
    expect(channel.topic).toBe('realtime:topic')
    expect(channel.params).toStrictEqual({
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        private: true,
      },
    })
  })

  test('does not repeat channels to sockets channels list', () => {
    expect(testSetup.client.getChannels().length).toBe(0)

    const channel = testSetup.client.channel('topic')
    testSetup.client.channel('topic') // should be ignored

    expect(testSetup.client.getChannels().length).toBe(1)

    const [foundChannel] = testSetup.client.channels
    expect(foundChannel).toBe(channel)
  })

  test('removes channel from phoenix-js socket', async () => {
    const channel = testSetup.client.channel('topic')

    expect(testSetup.client.getChannels().length).toBe(1)
    expect(testSetup.client.socketAdapter.getSocket().channels.length).toBe(1)

    await testSetup.client.removeChannel(channel)

    expect(testSetup.client.getChannels().length).toBe(0)
    expect(testSetup.client.socketAdapter.getSocket().channels.length).toBe(0)
  })

  test('removes all channels', async () => {
    const disconnectStub = vi.spyOn(testSetup.client, 'disconnect')

    testSetup.client.channel('chan1').subscribe()
    testSetup.client.channel('chan2').subscribe()

    expect(testSetup.client.getChannels().length).toBe(2)

    await testSetup.client.removeAllChannels()

    expect(testSetup.client.getChannels().length).toBe(0)
    expect(disconnectStub).toHaveBeenCalled()
  })

  test('removes all channels from phoenix-js socket', async () => {
    testSetup.client.channel('chan1').subscribe()
    testSetup.client.channel('chan2').subscribe()

    expect(testSetup.client.getChannels().length).toBe(2)
    expect(testSetup.client.socketAdapter.getSocket().channels.length).toBe(2)

    await testSetup.client.removeAllChannels()

    expect(testSetup.client.socketAdapter.getSocket().channels.length).toBe(0)
  })

  test('allows to create second channel with given topic after first one unsubscribed', async () => {
    const channel1 = testSetup.client.channel('topic').subscribe()
    await waitForChannelSubscribed(channel1)

    expect(testSetup.client.getChannels().length).toBe(1)
    await channel1.unsubscribe()

    expect(testSetup.client.getChannels().length).toBe(0)

    const channel2 = testSetup.client.channel('topic').subscribe()
    await waitForChannelSubscribed(channel2)

    expect(channel2).not.toBe(channel1)
  })

  test.each([
    ['ok', 'ok', 0],
    ['timeout', 'timed out', 0],
    ['error', 'error', 1],
  ])(
    'channels length should be $2 after unsubscribe returns $1',
    async (stub, status, expected) => {
      const channel = testSetup.client.channel('topic').subscribe()
      expect(testSetup.client.getChannels().length).toBe(1)
      // force channel.trigger to call bindings with custom message
      channel.channelAdapter.getChannel().onMessage = () => ({ status: stub })

      const result = await testSetup.client.removeChannel(channel)

      expect(testSetup.client.getChannels().length).toBe(expected)
      expect(result).toBe(status)
    }
  )
})

describe('deferred disconnect', () => {
  test('does not disconnect immediately when last channel removed via removeChannel', async () => {
    testSetup.cleanup()
    testSetup = setupRealtimeTest({ useFakeTimers: true })
    const disconnectSpy = vi.spyOn(testSetup.client, 'disconnect')

    const channel = testSetup.client.channel('topic')
    await testSetup.client.removeChannel(channel)

    expect(disconnectSpy).not.toHaveBeenCalled()
  })

  test('disconnects after disconnectOnEmptyChannelsAfterMs when channels stay empty', async () => {
    testSetup.cleanup()
    testSetup = setupRealtimeTest({ useFakeTimers: true, disconnectOnEmptyChannelsAfterMs: 200 })
    const disconnectSpy = vi.spyOn(testSetup.client, 'disconnect')

    const channel = testSetup.client.channel('topic')
    await testSetup.client.removeChannel(channel)

    expect(disconnectSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(disconnectSpy).toHaveBeenCalledOnce()
  })

  test('cancels pending disconnect when a new channel is created before timer fires', async () => {
    testSetup.cleanup()
    testSetup = setupRealtimeTest({ useFakeTimers: true, disconnectOnEmptyChannelsAfterMs: 200 })
    const disconnectSpy = vi.spyOn(testSetup.client, 'disconnect')

    const channel = testSetup.client.channel('topic')
    await testSetup.client.removeChannel(channel)

    // Create new channel before timer fires
    testSetup.client.channel('new-topic')

    vi.advanceTimersByTime(300)
    expect(disconnectSpy).not.toHaveBeenCalled()
  })

  test('direct channel.unsubscribe() also triggers deferred disconnect', async () => {
    testSetup.cleanup()
    testSetup = setupRealtimeTest({ useFakeTimers: true, disconnectOnEmptyChannelsAfterMs: 200 })
    testSetup.connect()
    await testSetup.socketConnected()

    const disconnectSpy = vi.spyOn(testSetup.client, 'disconnect')
    const channel = testSetup.client.channel('topic')
    channel.subscribe()
    await waitForChannelSubscribed(channel)

    await channel.unsubscribe()

    expect(disconnectSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(disconnectSpy).toHaveBeenCalledOnce()
  })

  test('disconnectOnEmptyChannelsAfterMs: 0 disconnects immediately', async () => {
    testSetup.cleanup()
    testSetup = setupRealtimeTest({ disconnectOnEmptyChannelsAfterMs: 0 })
    const disconnectSpy = vi.spyOn(testSetup.client, 'disconnect')

    const channel = testSetup.client.channel('topic')
    await testSetup.client.removeChannel(channel)

    expect(disconnectSpy).toHaveBeenCalledOnce()
  })

  test('removeAllChannels still disconnects immediately', async () => {
    testSetup.cleanup()
    testSetup = setupRealtimeTest({ useFakeTimers: true, disconnectOnEmptyChannelsAfterMs: 200 })
    const disconnectSpy = vi.spyOn(testSetup.client, 'disconnect')

    testSetup.client.channel('chan1').subscribe()
    testSetup.client.channel('chan2').subscribe()

    await testSetup.client.removeAllChannels()

    expect(disconnectSpy).toHaveBeenCalledOnce()
  })

  describe('subscribing while the deferred disconnect is closing the socket', () => {
    let joinedOver: Client
    const joinedTopics = () =>
      testSetup.emitters.message.mock.calls
        .filter(([, event]) => event === 'phx_join')
        .map(([topic]) => topic)

    beforeEach(async () => {
      testSetup.cleanup()
      testSetup = setupRealtimeTest({
        useFakeTimers: true,
        disconnectOnEmptyChannelsAfterMs: 200,
        socketHandlers: {
          phx_join: (socket, message) => {
            joinedOver = socket
            socket.send(phxReply(message, { status: 'ok', response: { postgres_changes: [] } }))
          },
          phx_leave: (socket, message) => socket.send(phxReply(message, { status: 'ok' })),
        },
      })
      const first = testSetup.client.channel('first').subscribe()
      await waitForChannelSubscribed(first)
      await testSetup.client.removeChannel(first)
      vi.advanceTimersByTime(200)
      expect(testSetup.client.isDisconnecting()).toBe(true)
    })

    test('joins the channel on a new connection once the close completes', async () => {
      const statuses: string[] = []
      const channel = testSetup.client.channel('replacement').subscribe((status) => {
        statuses.push(status)
      })

      await waitForChannelSubscribed(channel)
      expect(statuses.at(-1)).toBe('SUBSCRIBED')
      expect(testSetup.emitters.connected).toHaveBeenCalledTimes(2)
      expect(joinedTopics()).toContain('realtime:replacement')

      // The old connection's close leaves the new one intact: heartbeats keep it open, and a
      // drop of it is still noticed and reconnected.
      await vi.advanceTimersByTimeAsync(60_000)
      expect(channel.state).toBe('joined')
      expect(testSetup.emitters.connected).toHaveBeenCalledTimes(2)
      joinedOver.close({ code: 3000, reason: 'dropped', wasClean: false })
      await vi.advanceTimersByTimeAsync(1_000)
      await vi.waitFor(() => expect(testSetup.emitters.connected).toHaveBeenCalledTimes(3))
      await waitForChannelSubscribed(channel)
    })

    test('joins every channel subscribed during the close on one new connection', async () => {
      const channels = ['a', 'b'].map((topic) => testSetup.client.channel(topic).subscribe())

      await Promise.all(channels.map(waitForChannelSubscribed))
      expect(testSetup.emitters.connected).toHaveBeenCalledTimes(2)
      expect(joinedTopics()).toEqual(expect.arrayContaining(['realtime:a', 'realtime:b']))
    })

    test('stays disconnected when disconnect() is called after the subscribe', async () => {
      testSetup.client.channel('replacement').subscribe()
      await testSetup.client.disconnect()

      await testSetup.socketClosed()
      await vi.advanceTimersByTimeAsync(10_000)
      expect(testSetup.client.connectionState()).toBe('closed')
      expect(testSetup.emitters.connected).toHaveBeenCalledOnce()
    })
  })
})

describe('leaveOpenTopic', () => {
  test('enforces client to subscribe to unique topics', async () => {
    const logSpy = vi.fn()
    testSetup.cleanup()
    testSetup = setupRealtimeTest({
      logger: logSpy,
    })
    testSetup.connect()
    await testSetup.socketConnected()
    const channel1 = new RealtimeChannel('realtime:topic', { config: {} }, testSetup.client)
    const channel2 = new RealtimeChannel('realtime:topic', { config: {} }, testSetup.client)
    channel1.subscribe()
    channel2.subscribe()

    expect(logSpy).toHaveBeenCalledWith(
      'transport',
      'leaving duplicate topic "realtime:topic"',
      undefined
    )

    expect(testSetup.client.socketAdapter.getSocket().channels.length).toBe(1)
    expect(testSetup.client.socketAdapter.getSocket().channels[0].topic).toBe('realtime:topic')
  })
})
