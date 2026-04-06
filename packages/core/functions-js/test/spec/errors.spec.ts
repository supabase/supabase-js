import 'jest'

import {
  FunctionsError,
  FunctionsFetchError,
  FunctionsRelayError,
  FunctionsHttpError,
} from '../../src/types'

describe('FunctionsError serialization', () => {
  test('FunctionsError serializes message with JSON.stringify', () => {
    const err = new FunctionsError('something went wrong', 'FunctionsError', { requestId: 'abc' })
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('something went wrong')
    expect(serialized.name).toBe('FunctionsError')
    expect(serialized.context).toEqual({ requestId: 'abc' })
  })

  test('FunctionsFetchError serializes message with JSON.stringify', () => {
    const err = new FunctionsFetchError({ requestId: 'abc' })
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('Failed to send a request to the Edge Function')
    expect(serialized.name).toBe('FunctionsFetchError')
    expect(serialized.context).toEqual({ requestId: 'abc' })
  })

  test('FunctionsRelayError serializes message with JSON.stringify', () => {
    const err = new FunctionsRelayError({ region: 'us-east-1' })
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('Relay Error invoking the Edge Function')
    expect(serialized.name).toBe('FunctionsRelayError')
    expect(serialized.context).toEqual({ region: 'us-east-1' })
  })

  test('FunctionsHttpError serializes message with JSON.stringify', () => {
    const err = new FunctionsHttpError({ status: 500 })
    const serialized = JSON.parse(JSON.stringify(err))
    expect(serialized.message).toBe('Edge Function returned a non-2xx status code')
    expect(serialized.name).toBe('FunctionsHttpError')
    expect(serialized.context).toEqual({ status: 500 })
  })
})
