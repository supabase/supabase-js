import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { testBuilders, EnhancedTestSetup } from './helpers/setup'

let testSetup: EnhancedTestSetup

beforeEach(() => {
  testSetup = testBuilders.standardClient()
})

afterEach(() => {
  testSetup.cleanup()
})

describe('channel', () => {
  let channel
  test('throws error on replay for a public channel', () => {
    expect(() => {
      channel = testSetup.socket.channel('topic', {
        config: { broadcast: { replay: { since: 0 } } },
      })
    }).toThrow(
      "tried to use replay on public channel 'realtime:topic'. It must be a private channel."
    )
  })

  test('returns channel with private channel using replay', () => {
    channel = testSetup.socket.channel('topic', {
      config: { private: true, broadcast: { replay: { since: 0 } } },
    })

    assert.deepStrictEqual(channel.socket, testSetup.socket)
    assert.equal(channel.topic, 'realtime:topic')
    assert.deepEqual(channel.params, {
      config: {
        broadcast: { replay: { since: 0 } },
        presence: { key: '', enabled: false },
        private: true,
      },
    })
  })

  test('returns channel with given topic and params', () => {
    channel = testSetup.socket.channel('topic')

    assert.deepStrictEqual(channel.socket, testSetup.socket)
    assert.equal(channel.topic, 'realtime:topic')
    assert.deepEqual(channel.params, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        private: false,
      },
    })
  })

  test('returns channel with given topic and params for a private channel', () => {
    channel = testSetup.socket.channel('topic', { config: { private: true } })

    assert.deepStrictEqual(channel.socket, testSetup.socket)
    assert.equal(channel.topic, 'realtime:topic')
    assert.deepEqual(channel.params, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        private: true,
      },
    })
  })

  test('adds channel to sockets channels list', () => {
    assert.equal(testSetup.socket.getChannels().length, 0)

    channel = testSetup.socket.channel('topic')

    assert.equal(testSetup.socket.getChannels().length, 1)

    const [foundChannel] = testSetup.socket.channels
    assert.deepStrictEqual(foundChannel, channel)
  })

  test('does not repeat channels to sockets channels list', () => {
    assert.equal(testSetup.socket.getChannels().length, 0)

    channel = testSetup.socket.channel('topic')
    testSetup.socket.channel('topic') // should be ignored

    assert.equal(testSetup.socket.getChannels().length, 1)

    const [foundChannel] = testSetup.socket.channels
    assert.deepStrictEqual(foundChannel, channel)
  })

  test('gets all channels', () => {
    assert.equal(testSetup.socket.getChannels().length, 0)

    const chan1 = testSetup.socket.channel('chan1')
    const chan2 = testSetup.socket.channel('chan2')

    assert.deepEqual(testSetup.socket.getChannels(), [chan1, chan2])
  })

  test('removes a channel', async () => {
    const connectStub = vi.spyOn(testSetup.socket, 'connect')
    const disconnectStub = vi.spyOn(testSetup.socket, 'disconnect')

    channel = testSetup.socket.channel('topic').subscribe()

    assert.equal(testSetup.socket.getChannels().length, 1)
    expect(connectStub).toHaveBeenCalled()

    await testSetup.socket.removeChannel(channel)

    assert.equal(testSetup.socket.getChannels().length, 0)
    expect(disconnectStub).toHaveBeenCalled()
  })

  test('does not remove other channels when removing one', async () => {
    const connectStub = vi.spyOn(testSetup.socket, 'connect')
    const disconnectStub = vi.spyOn(testSetup.socket, 'disconnect')
    const channel1 = testSetup.socket.channel('chan1').subscribe()
    const channel2 = testSetup.socket.channel('chan2').subscribe()

    channel1.subscribe()
    channel2.subscribe()
    assert.equal(testSetup.socket.getChannels().length, 2)
    expect(connectStub).toHaveBeenCalled()

    await testSetup.socket.removeChannel(channel1)

    assert.equal(testSetup.socket.getChannels().length, 1)
    expect(disconnectStub).not.toHaveBeenCalled()
    assert.deepStrictEqual(testSetup.socket.getChannels()[0], channel2)
  })

  test('removes all channels', async () => {
    const disconnectStub = vi.spyOn(testSetup.socket, 'disconnect')

    testSetup.socket.channel('chan1').subscribe()
    testSetup.socket.channel('chan2').subscribe()

    assert.equal(testSetup.socket.getChannels().length, 2)

    await testSetup.socket.removeAllChannels()

    assert.equal(testSetup.socket.getChannels().length, 0)
    expect(disconnectStub).toHaveBeenCalled()
  })
})

describe('leaveOpenTopic', () => {
  let channel1
  let channel2

  afterEach(() => {
    channel1.unsubscribe()
    channel2.unsubscribe()
  })

  test('enforces client to subscribe to unique topics', () => {
    channel1 = testSetup.socket.channel('topic')
    channel2 = testSetup.socket.channel('topic')
    channel1.subscribe()
    try {
      channel2.subscribe()
    } catch (e) {
      console.error(e)
      assert.equal(
        e,
        `tried to subscribe multiple times. 'subscribe' can only be called a single time per channel instance`
      )
    }

    assert.equal(testSetup.socket.getChannels().length, 1)
    assert.equal(testSetup.socket.getChannels()[0].topic, 'realtime:topic')
  })
})

describe('remove', () => {
  test('removes given channel from channels', () => {
    const channel1 = testSetup.socket.channel('topic-1')
    const channel2 = testSetup.socket.channel('topic-2')

    vi.spyOn(channel1, '_joinRef').mockReturnValue('1')
    vi.spyOn(channel2, '_joinRef').mockReturnValue('2')

    testSetup.socket._remove(channel1)

    assert.equal(testSetup.socket.getChannels().length, 1)

    const [foundChannel] = testSetup.socket.channels
    assert.deepStrictEqual(foundChannel, channel2)
  })
})
