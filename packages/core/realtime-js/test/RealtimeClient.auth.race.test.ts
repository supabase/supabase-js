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
