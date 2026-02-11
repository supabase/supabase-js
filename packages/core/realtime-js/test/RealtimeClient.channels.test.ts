import { beforeEach, afterEach, expect, describe, test, vi } from 'vitest'
import { type TestSetup, setupRealtimeTest, waitForChannelSubscribed } from './helpers/setup'
import { CHANNEL_STATES } from '../src/lib/constants'
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

  test('removes channel from phoenix-js socket', () => {
    const channel = testSetup.client.channel('topic')

    expect(testSetup.client.getChannels().length).toBe(1)
    expect(testSetup.client.socketAdapter.getSocket().channels.length).toBe(1)

    testSetup.client.removeChannel(channel)

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

describe('leaveOpenTopic', () => {
  test('enforces client to subscribe to unique topics', () => {
    const channel1 = testSetup.client.channel('topic')
    const channel2 = testSetup.client.channel('topic')
    channel1.subscribe()
    expect(channel2.subscribe).toThrow()

    expect(testSetup.client.getChannels().length).toBe(1)
    expect(testSetup.client.getChannels()[0].topic).toBe('realtime:topic')
  })
})
