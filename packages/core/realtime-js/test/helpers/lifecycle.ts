import { vi } from 'vitest'
import RealtimeClient from '../../src/RealtimeClient'

/**
 * Data-driven fixtures for lifecycle testing scenarios
 */
export const fixtures = {
  /**
   * Connection state fixtures with expected states
   */
  connectionStates: [
    {
      name: 'connecting',
      readyState: 0,
      expected: 'connecting',
      isConnected: false,
    },
    { name: 'open', readyState: 1, expected: 'open', isConnected: true },
    { name: 'closing', readyState: 2, expected: 'closing', isConnected: false },
    { name: 'closed', readyState: 3, expected: 'closed', isConnected: false },
    {
      name: 'unrecognized',
      readyState: 5678,
      expected: 'closed',
      isConnected: false,
    },
  ],

  /**
   * Channel state fixtures
   */
  channelStates: [
    { name: 'closed', state: 'closed', joinedOnce: false },
    { name: 'joining', state: 'joining', joinedOnce: true },
    { name: 'joined', state: 'joined', joinedOnce: true },
    { name: 'errored', state: 'errored', joinedOnce: true },
  ],

  /**
   * Channel configuration fixtures
   */
  channelConfigs: [
    {
      name: 'default config',
      config: {},
      expected: {
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        private: false,
      },
    },
    {
      name: 'private channel',
      config: { private: true },
      expected: {
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        private: true,
      },
    },
    {
      name: 'broadcast enabled',
      config: { broadcast: { ack: true, self: true } },
      expected: {
        broadcast: { ack: true, self: true },
        presence: { key: '', enabled: false },
        private: false,
      },
    },
    {
      name: 'presence with key',
      config: { presence: { key: 'user_id' } },
      expected: {
        broadcast: { ack: false, self: false },
        presence: { key: 'user_id', enabled: false },
        private: false,
      },
    },
  ],

  /**
   * Constructor option fixtures
   */
  constructorOptions: [
    {
      name: 'sets defaults',
      options: { params: { apikey: '123456789' } },
      expected: {
        channelsLength: 0,
        sendBufferLength: 0,
        ref: 0,
        transport: null,
        timeout: 10000,
        heartbeatIntervalMs: 25000,
      },
    },
    {
      name: 'overrides some defaults',
      options: {
        timeout: 40000,
        heartbeatIntervalMs: 60000,
        transport: null, // Will be set by test
        params: { one: 'two', apikey: '123456789' },
      },
      expected: {
        channelsLength: 0,
        sendBufferLength: 0,
        ref: 0,
        transport: null, // Will be overridden
        timeout: 40000,
        heartbeatIntervalMs: 60000,
      },
    },
    {
      name: 'sets heartbeatCallback',
      options: {
        params: { apikey: '123456789' },
        heartbeatCallback: () => {},
      },
      expected: {
        channelsLength: 0,
        sendBufferLength: 0,
        ref: 0,
        transport: null,
        timeout: 10000,
        heartbeatIntervalMs: 25000,
      },
    },
  ],
}

/**
 * Common test patterns for mocking with vitest - lifecycle specific
 */
export const mocks = {
  /**
   * Mock connection readyState
   */
  connectionState(socket: RealtimeClient, state: number) {
    return vi.spyOn(socket.conn!, 'readyState', 'get').mockReturnValue(state)
  },
}
