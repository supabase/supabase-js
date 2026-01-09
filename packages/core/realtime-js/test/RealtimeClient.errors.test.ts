import assert from 'assert'
import { describe, expect, test, vi } from 'vitest'
import { setupRealtimeTest } from './helpers/setup'

describe('log operations', () => {
  test('calls the logger with the correct arguments', () => {
    const mockLogger = vi.fn()
    const testSetup = setupRealtimeTest({
      logger: mockLogger,
      params: { apikey: '123456789' },
    })

    testSetup.client.log('testKind', 'testMessage', { testData: 'test' })

    expect(mockLogger).toHaveBeenCalledWith('testKind', 'testMessage', {
      testData: 'test',
    })

    testSetup.cleanup()
  })

  test('changing log_level sends proper params in URL', () => {
    const testSetup = setupRealtimeTest({
      log_level: 'warn',
      params: { apikey: '123456789' },
    })

    assert.equal(testSetup.client.logLevel, 'warn')

    const url = new URL(testSetup.client.endpointURL())
    assert.equal(url.searchParams.get("log_level"), "warn")

    testSetup.cleanup()
  })

  test('changing logLevel sends proper params in URL', () => {
    const testSetup = setupRealtimeTest({
      logLevel: 'warn',
      params: { apikey: '123456789' },
    })

    assert.equal(testSetup.client.logLevel, 'warn')

    const url = new URL(testSetup.client.endpointURL())
    assert.equal(url.searchParams.get("log_level"), "warn")

    testSetup.cleanup()
  })
})
