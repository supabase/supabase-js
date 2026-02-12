import 'jest'

import { createFunctionsClient } from '../../helpers/functions-client'

describe('timeout tests (slow function)', () => {}

  test('invoke slow function without timeout should succeed', async () => {
    /**
     * @feature timeout
     */
    const fclient = createFunctionsClient()

    const { data, error } = await fclient.invoke<string>('slow', {})

    expect(error).toBeNull()
    expect(data).toEqual('Slow Response')
  })

  test('invoke slow function with short timeout should fail', async () => {
    /**
     * @feature timeout
     */
    const fclient = createFunctionsClient()

    const { data, error} = await fclient.invoke<string>('slow', {
      timeout: 1000,
    })

    expect(error).not.toBeNull()
    expect(error?.name).toEqual('FunctionsFetchError')
    expect(data).toBeNull()
  })

  test('invoke slow function with long timeout should succeed', async () => {
    /**
     * @feature timeout
     */
    const fclient = createFunctionsClient()

    const { data, error } = await fclient.invoke<string>('slow', {
      timeout: 5000,
    })

    expect(error).toBeNull()
    expect(data).toEqual('Slow Response')
  })

  test('invoke slow function with timeout and custom AbortSignal', async () => {
    /**
     * @feature timeout
     */
    const fclient = createFunctionsClient()

    const abortController = new AbortController()

    const invokePromise = fclient.invoke<string>('slow', {
      timeout: 5000, // 5 second timeout
      signal: abortController.signal,
    })

    // Abort after 500ms
    setTimeout(() => {
      abortController.abort()
    }, 500)

    const { data, error } = await invokePromise

    expect(error).not.toBeNull()
    expect(error?.name).toEqual('FunctionsFetchError')
    expect(data).toBeNull()
  })
})
