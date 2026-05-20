import assert from 'assert'
import { describe, test, beforeEach, afterEach, vi, expect } from 'vitest'
import type RealtimeChannel from '../src/RealtimeChannel'
import { REALTIME_AI_AGENT_EVENTS, REALTIME_LISTEN_TYPES } from '../src/RealtimeChannel'
import { setupRealtimeTest, waitForChannelSubscribed, type TestSetup } from './helpers/setup'

let testSetup: TestSetup

describe('AI Agent pipeline', () => {
  let channel: RealtimeChannel

  beforeEach(() => {
    testSetup = setupRealtimeTest()
    channel = testSetup.client.channel('agent:support:123', {
      config: {
        private: true,
        broadcast: { self: true },
        ai: { enabled: true, agent: 'support-bot' },
      },
    })
  })

  afterEach(() => {
    channel.unsubscribe()
    testSetup.cleanup()
  })

  function triggerAgentBroadcast(event: string, payload: object) {
    channel.channelAdapter.getChannel().trigger('ai_event', {
      type: 'ai_agent',
      event,
      payload,
    })
  }

  describe('config', () => {
    test('includes ai config in join payload', async () => {
      testSetup.connect()
      channel.subscribe()
      await waitForChannelSubscribed(channel)

      expect(testSetup.emitters.message).toHaveBeenCalledWith(
        expect.any(String),
        'phx_join',
        expect.objectContaining({
          config: expect.objectContaining({
            ai: { enabled: true, agent: 'support-bot' },
          }),
        })
      )
    })

    test('includes session_id in ai config when provided', async () => {
      const channelWithSession = testSetup.client.channel('agent:support:456', {
        config: {
          private: true,
          ai: { enabled: true, agent: 'support-bot', session_id: 'abc-123' },
        },
      })

      testSetup.connect()
      channelWithSession.subscribe()
      await waitForChannelSubscribed(channelWithSession)

      expect(testSetup.emitters.message).toHaveBeenCalledWith(
        expect.any(String),
        'phx_join',
        expect.objectContaining({
          config: expect.objectContaining({
            ai: { enabled: true, agent: 'support-bot', session_id: 'abc-123' },
          }),
        })
      )

      channelWithSession.unsubscribe()
    })

    test('omits ai config when not set', async () => {
      const plainChannel = testSetup.client.channel('plain-channel')
      testSetup.connect()
      plainChannel.subscribe()
      await waitForChannelSubscribed(plainChannel)

      const joinCall = testSetup.emitters.message.mock.calls.find(
        ([, event]) => event === 'phx_join'
      )
      assert.ok(joinCall)
      assert.strictEqual(joinCall[2].config.ai, undefined)

      plainChannel.unsubscribe()
    })
  })

  describe('on() routing', () => {
    test('receives agent_text_delta with unwrapped payload', () => {
      const spy = vi.fn()
      channel.on(
        REALTIME_LISTEN_TYPES.AI_AGENT,
        { event: REALTIME_AI_AGENT_EVENTS.TEXT_DELTA },
        spy
      )

      triggerAgentBroadcast('agent_text_delta', { delta: 'Hello' })

      expect(spy).toHaveBeenCalledWith({ delta: 'Hello' })
    })

    test('receives agent_session_started with session_id', () => {
      const spy = vi.fn()
      channel.on(
        REALTIME_LISTEN_TYPES.AI_AGENT,
        { event: REALTIME_AI_AGENT_EVENTS.SESSION_STARTED },
        spy
      )

      triggerAgentBroadcast('agent_session_started', { session_id: 'sess-xyz' })

      expect(spy).toHaveBeenCalledWith({ session_id: 'sess-xyz' })
    })

    test('receives agent_done with stop_reason', () => {
      const spy = vi.fn()
      channel.on(REALTIME_LISTEN_TYPES.AI_AGENT, { event: REALTIME_AI_AGENT_EVENTS.DONE }, spy)

      triggerAgentBroadcast('agent_done', { stop_reason: 'end_turn' })

      expect(spy).toHaveBeenCalledWith({ stop_reason: 'end_turn' })
    })

    test('receives agent_error with reason', () => {
      const spy = vi.fn()
      channel.on(REALTIME_LISTEN_TYPES.AI_AGENT, { event: REALTIME_AI_AGENT_EVENTS.ERROR }, spy)

      triggerAgentBroadcast('agent_error', { reason: 'stream_failed' })

      expect(spy).toHaveBeenCalledWith({ reason: 'stream_failed' })
    })

    test('receives agent_tool_call_done with all fields', () => {
      const spy = vi.fn()
      channel.on(
        REALTIME_LISTEN_TYPES.AI_AGENT,
        { event: REALTIME_AI_AGENT_EVENTS.TOOL_CALL_DONE },
        spy
      )

      triggerAgentBroadcast('agent_tool_call_done', {
        tool_call_id: 'call-1',
        name: 'get_weather',
        arguments: '{"city":"Lisbon"}',
      })

      expect(spy).toHaveBeenCalledWith({
        tool_call_id: 'call-1',
        name: 'get_weather',
        arguments: '{"city":"Lisbon"}',
      })
    })

    test('receives agent_usage with token counts', () => {
      const spy = vi.fn()
      channel.on(REALTIME_LISTEN_TYPES.AI_AGENT, { event: REALTIME_AI_AGENT_EVENTS.USAGE }, spy)

      triggerAgentBroadcast('agent_usage', { input_tokens: 120, output_tokens: 45 })

      expect(spy).toHaveBeenCalledWith({ input_tokens: 120, output_tokens: 45 })
    })

    test('filters by event — wrong event does not trigger callback', () => {
      const spy = vi.fn()
      channel.on(
        REALTIME_LISTEN_TYPES.AI_AGENT,
        { event: REALTIME_AI_AGENT_EVENTS.TEXT_DELTA },
        spy
      )

      triggerAgentBroadcast('agent_done', { stop_reason: 'end_turn' })

      expect(spy).not.toHaveBeenCalled()
    })

    test('wildcard receives all agent events', () => {
      const spy = vi.fn()
      channel.on(REALTIME_LISTEN_TYPES.AI_AGENT, { event: '*' }, spy)

      triggerAgentBroadcast('agent_text_delta', { delta: 'a' })
      triggerAgentBroadcast('agent_done', { stop_reason: 'end_turn' })
      triggerAgentBroadcast('agent_error', { reason: 'stream_failed' })

      expect(spy).toHaveBeenCalledTimes(3)
    })

    test('ai_agent wildcard also matches non-agent broadcast events', () => {
      const agentSpy = vi.fn()
      channel.on(REALTIME_LISTEN_TYPES.AI_AGENT, { event: '*' }, agentSpy)

      triggerAgentBroadcast('cursor-pos', { x: 1, y: 2 })

      expect(agentSpy).toHaveBeenCalledWith({ x: 1, y: 2 })
    })

    test('broadcast listener does not receive ai_event messages', () => {
      const broadcastSpy = vi.fn()
      channel.on('broadcast', { event: '*' }, broadcastSpy)

      triggerAgentBroadcast('agent_text_delta', { delta: 'hi' })

      expect(broadcastSpy).not.toHaveBeenCalled()
    })

    test('multiple ai_agent listeners each receive events independently', () => {
      const textSpy = vi.fn()
      const doneSpy = vi.fn()

      channel.on(
        REALTIME_LISTEN_TYPES.AI_AGENT,
        { event: REALTIME_AI_AGENT_EVENTS.TEXT_DELTA },
        textSpy
      )
      channel.on(REALTIME_LISTEN_TYPES.AI_AGENT, { event: REALTIME_AI_AGENT_EVENTS.DONE }, doneSpy)

      triggerAgentBroadcast('agent_text_delta', { delta: 'hello' })
      triggerAgentBroadcast('agent_done', { stop_reason: 'end_turn' })

      expect(textSpy).toHaveBeenCalledTimes(1)
      expect(doneSpy).toHaveBeenCalledTimes(1)
      expect(textSpy).not.toHaveBeenCalledWith({ stop_reason: 'end_turn' })
    })
  })

  describe('sendAgentInput()', () => {
    beforeEach(async () => {
      testSetup.connect()
      await testSetup.socketConnected()
    })

    test('sends text input as broadcast agent_input event', () => {
      channel.subscribe()
      channel.state = 'joined'
      const pushSpy = vi.spyOn(channel.channelAdapter.getChannel(), 'push')

      channel.sendAgentInput({ text: 'What is the weather?' })

      expect(pushSpy).toHaveBeenCalledWith(
        'broadcast',
        { type: 'broadcast', event: 'agent_input', payload: { text: 'What is the weather?' } },
        expect.any(Number)
      )
    })

    test('sends tool result as broadcast agent_input event', () => {
      channel.subscribe()
      channel.state = 'joined'
      const pushSpy = vi.spyOn(channel.channelAdapter.getChannel(), 'push')

      channel.sendAgentInput({
        tool_result: { tool_call_id: 'call-1', content: '{"temp":22}' },
      })

      expect(pushSpy).toHaveBeenCalledWith(
        'broadcast',
        {
          type: 'broadcast',
          event: 'agent_input',
          payload: { tool_result: { tool_call_id: 'call-1', content: '{"temp":22}' } },
        },
        expect.any(Number)
      )
    })
  })

  describe('cancelAgent()', () => {
    beforeEach(async () => {
      testSetup.connect()
      await testSetup.socketConnected()
    })

    test('sends agent_cancel broadcast event', () => {
      channel.subscribe()
      channel.state = 'joined'
      const pushSpy = vi.spyOn(channel.channelAdapter.getChannel(), 'push')

      channel.cancelAgent()

      expect(pushSpy).toHaveBeenCalledWith(
        'broadcast',
        { type: 'broadcast', event: 'agent_cancel', payload: {} },
        expect.any(Number)
      )
    })
  })
})
