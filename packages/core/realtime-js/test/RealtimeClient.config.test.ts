import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import RealtimeClient from '../src/RealtimeClient'
import { setupRealtimeTest, cleanupRealtimeTest, TestSetup } from './helpers/setup'

let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest()
})

afterEach(() => {
  cleanupRealtimeTest(testSetup)
})

describe('endpointURL', () => {
  test('returns endpoint for given full url', () => {
    assert.equal(
      testSetup.socket.endpointURL(),
      `${testSetup.url}/websocket?apikey=123456789&vsn=1.0.0`
    )
  })

  test('returns endpoint with parameters', () => {
    const socket = new RealtimeClient(testSetup.url, {
      params: { foo: 'bar', apikey: '123456789' },
    })
    assert.equal(
      socket.endpointURL(),
      `${testSetup.url}/websocket?foo=bar&apikey=123456789&vsn=1.0.0`
    )
  })

  test('returns endpoint with apikey', () => {
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
    })
    assert.equal(socket.endpointURL(), `${testSetup.url}/websocket?apikey=123456789&vsn=1.0.0`)
  })

  test('returns endpoint with valid vsn', () => {
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
      vsn: '2.0.0',
    })
    assert.equal(socket.endpointURL(), `${testSetup.url}/websocket?apikey=123456789&vsn=2.0.0`)
  })

  test('errors out with unsupported version', () => {
    expect(
      () => new RealtimeClient(testSetup.url, { params: { apikey: '123456789' }, vsn: '4.0.0' })
    ).toThrow(/Unsupported serializer/)
  })

  test('returns endpoint with no params (empty params object)', () => {
    const socket = new RealtimeClient(testSetup.url, {
      params: { apikey: '123456789' },
    })
    // Clear params after construction to test empty params scenario
    socket.params = {}
    assert.equal(socket.endpointURL(), `${testSetup.url}/websocket?vsn=1.0.0`)
  })
})
