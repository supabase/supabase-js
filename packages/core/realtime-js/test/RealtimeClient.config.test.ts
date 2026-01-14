import assert from 'assert'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import RealtimeClient from '../src/RealtimeClient'
import { setupRealtimeTest, TestSetup, DEFAULT_API_KEY } from './helpers/setup'
import { VSN_1_0_0, VSN_2_0_0 } from '../src/lib/constants'
import Serializer from '../src/lib/serializer'

let testSetup: TestSetup

beforeEach(() => {
  testSetup = setupRealtimeTest()
})

afterEach(() => {
  testSetup.cleanup()
})

describe('endpointURL', () => {
  test('returns endpoint for given full url', () => {
    assert.equal(
      testSetup.client.endpointURL(),
      `${testSetup.wssUrl}?apikey=${DEFAULT_API_KEY}&vsn=1.0.0`
    )
  })

  test('returns endpoint with parameters', () => {
    const client = new RealtimeClient(testSetup.realtimeUrl, {
      params: { foo: 'bar', apikey: DEFAULT_API_KEY },
    })
    assert.equal(
      client.endpointURL(),
      `${testSetup.wssUrl}?foo=bar&apikey=${DEFAULT_API_KEY}&vsn=1.0.0`
    )
  })

  test('returns endpoint with apikey', () => {
    const client = new RealtimeClient(testSetup.realtimeUrl, {
      params: { apikey: DEFAULT_API_KEY },
    })
    assert.equal(client.endpointURL(), `${testSetup.wssUrl}?apikey=${DEFAULT_API_KEY}&vsn=1.0.0`)
  })

  test('returns endpoint with valid vsn', () => {
    const client = new RealtimeClient(testSetup.realtimeUrl, {
      params: { apikey: DEFAULT_API_KEY },
      vsn: '2.0.0',
    })
    assert.equal(client.endpointURL(), `${testSetup.wssUrl}?apikey=${DEFAULT_API_KEY}&vsn=2.0.0`)
  })

  test('errors out with unsupported version', () => {
    expect(
      () =>
        new RealtimeClient(testSetup.realtimeUrl, {
          params: { apikey: DEFAULT_API_KEY },
          vsn: '4.0.0',
        })
    ).toThrow(/Unsupported serializer/)
  })
})

describe('encode and decode', () => {
  const exampleMsg = { join_ref: '0', ref: '1', topic: 't', event: 'e', payload: { foo: 1 } }

  let encodedMsg: any
  let decodedMsg: any

  beforeEach(() => {
    encodedMsg = null
    decodedMsg = null
  })

  test('are set to JSON if version is 1.0.0', () => {
    const client = new RealtimeClient(testSetup.realtimeUrl, {
      vsn: VSN_1_0_0,
      params: { apikey: DEFAULT_API_KEY },
    })

    const encodedExample = JSON.stringify(exampleMsg)
    client.encode(exampleMsg, (encoded) => (encodedMsg = encoded))
    expect(encodedMsg).toStrictEqual(encodedExample)

    const decodedExample = JSON.parse(encodedExample)
    client.decode(encodedExample, (decoded) => (decodedMsg = decoded))
    expect(decodedMsg).toStrictEqual(decodedExample)
  })

  test('are set to serializer if version is 2.0.0', () => {
    const client = new RealtimeClient(testSetup.realtimeUrl, {
      vsn: VSN_2_0_0,
      params: { apikey: DEFAULT_API_KEY },
    })

    let encodedExample: string = ''
    let decodedExample: Object = {}

    const serializer = new Serializer()

    serializer.encode(exampleMsg, (encoded) => (encodedExample = encoded as string))
    client.encode(exampleMsg, (encoded) => (encodedMsg = encoded as string))
    expect(encodedMsg).toStrictEqual(encodedExample)

    serializer.decode(encodedExample, (decoded: Object) => (decodedExample = decoded))
    client.decode(encodedExample, (decoded) => (decodedMsg = decoded))
    expect(decodedMsg).toStrictEqual(decodedExample)
  })
})
