import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import RealtimeClient from '../src/RealtimeClient'
import { setupRealtimeTest, cleanupRealtimeTest, TestSetup } from './helpers/setup'

let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest()
})

afterEach(() => {
  cleanupRealtimeTest(testSetup)
})

describe('Callback Error Handling', () => {
  test('should handle errors in state change callbacks', async () => {
    const logSpy = vi.spyOn(testSetup.socket, 'log')

    // Add a callback that throws an error
    testSetup.socket.stateChangeCallbacks.open.push(() => {
      throw new Error('Test callback error')
    })

    // Add a normal callback that should still work
    let normalCallbackCalled = false
    testSetup.socket.stateChangeCallbacks.open.push(() => {
      normalCallbackCalled = true
    })

    // Trigger the callbacks through _triggerStateCallbacks
    testSetup.socket._triggerStateCallbacks('open', {})

    // Verify error was logged
    expect(logSpy).toHaveBeenCalledWith('error', 'error in open callback', expect.any(Error))

    // Verify normal callback still executed
    expect(normalCallbackCalled).toBe(true)

    logSpy.mockRestore()
  })

  test('should handle errors when triggering state callbacks fails entirely', async () => {
    const logSpy = vi.spyOn(testSetup.socket, 'log')

    // Force an error in the outer try-catch by corrupting the callbacks array
    const originalCallbacks = testSetup.socket.stateChangeCallbacks.close
    // @ts-ignore - Deliberately setting to null to trigger outer error
    testSetup.socket.stateChangeCallbacks.close = null

    // Trigger the callbacks
    testSetup.socket._triggerStateCallbacks('close', {})

    // Verify error was logged
    expect(logSpy).toHaveBeenCalledWith(
      'error',
      'error triggering close callbacks',
      expect.any(Error)
    )

    // Restore original callbacks
    testSetup.socket.stateChangeCallbacks.close = originalCallbacks
    logSpy.mockRestore()
  })
})

describe('log operations', () => {
  test('calls the logger with the correct arguments', () => {
    const mockLogger = vi.fn()
    testSetup.socket = new RealtimeClient(testSetup.url, {
      logger: mockLogger,
      params: { apikey: '123456789' },
    })

    testSetup.socket.log('testKind', 'testMessage', { testData: 'test' })

    expect(mockLogger).toHaveBeenCalledWith('testKind', 'testMessage', {
      testData: 'test',
    })
  })

  test('changing log_level sends proper params in URL', () => {
    testSetup.socket = new RealtimeClient(testSetup.url, {
      log_level: 'warn',
      params: { apikey: '123456789' },
    })

    assert.equal(testSetup.socket.logLevel, 'warn')
    assert.equal(
      testSetup.socket.endpointURL(),
      `${testSetup.url}/websocket?apikey=123456789&log_level=warn&vsn=1.0.0`
    )
  })

  test('changing logLevel sends proper params in URL', () => {
    testSetup.socket = new RealtimeClient(testSetup.url, {
      logLevel: 'warn',
      params: { apikey: '123456789' },
    })

    assert.equal(testSetup.socket.logLevel, 'warn')
    assert.equal(
      testSetup.socket.endpointURL(),
      `${testSetup.url}/websocket?apikey=123456789&log_level=warn&vsn=1.0.0`
    )
  })
})
