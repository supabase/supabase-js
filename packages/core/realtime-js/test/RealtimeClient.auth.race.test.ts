import { describe, expect, test, vi } from 'vitest'
import { setupRealtimeTest } from './helpers/setup'
import { utils } from './helpers/auth'

describe('subscribing while the accessToken callback is still in flight', () => {
  test('joins with the access token instead of falling back to the apikey', async () => {
    // supabase-js wires accessToken to auth.getSession(), which reads storage and
    // never resolves in the same tick as the subscribe() call that triggered
    // connect(). Joining before it settles sends no access_token at all, the
    // server falls back to the anon apikey, and an RLS policy reading a JWT claim
    // filters every row out while the channel still reports SUBSCRIBED.
    const token = utils.generateJWT('1h')
    const testSetup = setupRealtimeTest({
      accessToken: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        return token
      },
    })

    const topic = 'db-changes'
    const channel = testSetup.client.channel(topic, { config: { private: true } })

    channel.subscribe()

    await vi.waitFor(() => {
      const join = testSetup.emitters.message.mock.calls.find(
        ([channelTopic, event]) => channelTopic === `realtime:${topic}` && event === 'phx_join'
      )

      expect(join).toBeDefined()
      expect(join![2].access_token).toBe(token)
    })

    testSetup.cleanup()
  })

  test('still joins when the accessToken callback rejects', async () => {
    const testSetup = setupRealtimeTest({
      accessToken: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        throw new Error('session unavailable')
      },
    })

    const topic = 'db-changes'
    const channel = testSetup.client.channel(topic, { config: { private: true } })

    channel.subscribe()

    await vi.waitFor(() => {
      const join = testSetup.emitters.message.mock.calls.find(
        ([channelTopic, event]) => channelTopic === `realtime:${topic}` && event === 'phx_join'
      )

      expect(join).toBeDefined()
    })

    testSetup.cleanup()
  })
})

describe('a setAuth that lands while another is in flight', () => {
  test('joins with the token from the latest setAuth, not the superseded one', async () => {
    const firstToken = utils.generateJWT('1h')
    const secondToken = utils.generateJWT('2h')

    const gates: ((token: string) => void)[] = []
    const gateFor = (token: string) =>
      new Promise<string>((resolve) => gates.push(() => resolve(token)))

    let call = 0
    const testSetup = setupRealtimeTest({
      accessToken: async () => {
        call += 1
        return call === 1 ? gateFor(firstToken) : gateFor(secondToken)
      },
    })

    const topic = 'db-changes'
    const channel = testSetup.client.channel(topic, { config: { private: true } })

    channel.subscribe()
    await vi.waitFor(() => expect(gates.length).toBe(1))

    // A second setAuth supersedes the first while subscribe() is still waiting.
    const second = testSetup.client.setAuth()
    await vi.waitFor(() => expect(gates.length).toBe(2))

    // The superseded call settles first. Its token is dropped by the generation
    // check in _performAuth, so nothing has been applied at this point.
    gates[0]()
    await new Promise((resolve) => setTimeout(resolve, 10))

    gates[1]()
    await second

    await vi.waitFor(() => {
      const join = testSetup.emitters.message.mock.calls.find(
        ([channelTopic, event]) => channelTopic === `realtime:${topic}` && event === 'phx_join'
      )

      expect(join).toBeDefined()
      expect(join![2].access_token).toBe(secondToken)
    })

    testSetup.cleanup()
  })
})

describe('unsubscribing while the deferred join is still pending', () => {
  test('does not join a channel the caller already unsubscribed', async () => {
    // Deferring the join means subscribe() can return before phx_join is sent.
    // If the caller unsubscribes in that window - a logout, a component
    // unmounting - the deferred callback must not resurrect the channel.
    const token = utils.generateJWT('1h')
    const testSetup = setupRealtimeTest({
      accessToken: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        return token
      },
    })

    const topic = 'db-changes'
    const channel = testSetup.client.channel(topic, { config: { private: true } })

    channel.subscribe()
    await channel.unsubscribe()

    await new Promise((resolve) => setTimeout(resolve, 60))

    const join = testSetup.emitters.message.mock.calls.find(
      ([channelTopic, event]) => channelTopic === `realtime:${topic}` && event === 'phx_join'
    )

    expect(join).toBeUndefined()

    testSetup.cleanup()
  })

  test('does not join a channel the caller already removed', async () => {
    const token = utils.generateJWT('1h')
    const testSetup = setupRealtimeTest({
      accessToken: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        return token
      },
    })

    const topic = 'db-changes'
    const channel = testSetup.client.channel(topic, { config: { private: true } })

    channel.subscribe()
    await testSetup.client.removeChannel(channel)

    await new Promise((resolve) => setTimeout(resolve, 60))

    const join = testSetup.emitters.message.mock.calls.find(
      ([channelTopic, event]) => channelTopic === `realtime:${topic}` && event === 'phx_join'
    )

    expect(join).toBeUndefined()

    testSetup.cleanup()
  })
})
