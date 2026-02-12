import 'jest'
import { sign } from 'jsonwebtoken'

import { FunctionsClient } from '@supabase/functions-js'

import {
  createFunctionsClient,
  createServiceRoleFunctionsClient,
  createFunctionsClientWithKey,
  getFunctionsInfo,
} from '../../helpers/functions-client'

describe('basic tests (hello function)', () => {
  const { anonKey } = getFunctionsInfo()
  // Create a wrong key for testing auth failures
  const wrongKey = sign({ name: 'anon' }, 'wrong_jwt_secret', { expiresIn: '1h' })

  test('invoke hello with auth header', async () => {
    /**
     * @feature auth
     */
    const fclient = createFunctionsClient()

    const { data, error, response } = await fclient.invoke<string>('hello', {})

    expect(error).toBeNull()
    expect(data).toEqual('Hello World')
    expect(response).toBeDefined()
    expect(response).toBeInstanceOf(Response)
  })

  test('invoke hello with setAuth', async () => {
    /**
     * @feature auth
     */
    const fclient = createFunctionsClient()
    fclient.setAuth(anonKey)

    const { data, error } = await fclient.invoke<string>('hello', {})

    expect(error).toBeNull()
    expect(data).toEqual('Hello World')
  })

  test('invoke hello with setAuth wrong key', async () => {
    /**
     * @feature errors
     */
    const fclient = createFunctionsClient()
    fclient.setAuth(wrongKey)

    const { data, error, response } = await fclient.invoke<string>('hello', {})

    expect(error).not.toBeNull()
    // Note: Error message may differ from Testcontainers relay
    expect(error?.message).toBeDefined()
    expect(data).toBeNull()
    expect(response).toBeDefined()
  })

  test('invoke hello: auth override by setAuth wrong key', async () => {
    /**
     * @feature auth
     */
    const fclient = createFunctionsClient()
    fclient.setAuth(wrongKey)

    const { data, error } = await fclient.invoke<string>('hello', {})

    expect(error).not.toBeNull()
    expect(error?.message).toBeDefined()
    expect(data).toBeNull()
  })

  test('invoke hello: auth override by setAuth right key', async () => {
    /**
     * @feature auth
     */
    const fclient = createFunctionsClientWithKey(wrongKey)
    fclient.setAuth(anonKey)

    const { data, error } = await fclient.invoke<string>('hello', {})

    expect(error).toBeNull()
    expect(data).toEqual('Hello World')
  })

  test('invoke hello with auth header in invoke', async () => {
    /**
     * @feature auth
     */
    const fclient = createFunctionsClient()

    const { data, error } = await fclient.invoke<string>('hello', {
      headers: {
        Authorization: `Bearer ${anonKey}`,
      },
    })

    expect(error).toBeNull()
    expect(data).toEqual('Hello World')
  })

  test('invoke hello with auth header override in invoke', async () => {
    /**
     * @feature auth
     */
    const fclient = createFunctionsClient()
    fclient.setAuth(wrongKey)

    const { data, error } = await fclient.invoke<string>('hello', {
      headers: {
        Authorization: `Bearer ${anonKey}`,
      },
    })

    expect(error).toBeNull()
    expect(data).toEqual('Hello World')
  })

  test('invoke hello with wrong auth header overridden in invoke', async () => {
    /**
     * @feature auth
     */
    const fclient = createFunctionsClient()

    const { data, error } = await fclient.invoke<string>('hello', {
      headers: {
        Authorization: `Bearer ${wrongKey}`,
      },
    })

    expect(error).not.toBeNull()
    expect(error?.message).toBeDefined()
    expect(data).toBeNull()
  })

  it.skip('invoke missing function', async () => {
    /**
     * @feature errors
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('missing', {})

    log('check error')
    expect(error).not.toBeNull()
    expect(error?.message).toEqual('Invalid JWT')
    expect(data).toBeNull()
  })

  test('invoke with custom fetch', async () => {
    /**
     * @feature fetch
     */
    const { url } = getFunctionsInfo()
    const customFetch = (url: string, options?: RequestInit) => {
      // Custom fetch that always calls 'hello' function
      const helloUrl = `${url}/hello`.replace(/\/+/g, '/')
      return fetch(helloUrl, {
        ...options,
        method: 'POST',
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${anonKey}`,
        },
      })
    }

    const fclient = createFunctionsClient({ customFetch })

    const { data, error } = await fclient.invoke<string>('', {})

    expect(error).toBeNull()
    expect(data).toEqual('Hello World')
  })

  test('invoke with custom fetch GET method', async () => {
    /**
     * @feature fetch
     */
    const { url } = getFunctionsInfo()
    const customFetch = (url: string, options?: RequestInit) => {
      // Custom fetch that always calls 'hello' function with GET
      const helloUrl = `${url}/hello`.replace(/\/+/g, '/')
      return fetch(helloUrl, {
        ...options,
        method: 'GET',
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${anonKey}`,
        },
      })
    }

    const fclient = createFunctionsClient({ customFetch })

    const { data, error } = await fclient.invoke<string>('', {})

    expect(error).toBeNull()
    expect(data).toEqual('Hello World')
  })

  test('invoke hello with custom fetch override header', async () => {
    /**
     * @feature fetch
     */
    const { url } = getFunctionsInfo()
    const customFetch = (url: string, options?: RequestInit) => {
      // Custom fetch that overrides with correct auth
      const helloUrl = `${url}/hello`.replace(/\/+/g, '/')
      return fetch(helloUrl, {
        ...options,
        method: 'POST',
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${anonKey}`,
        },
      })
    }

    const fclient = createFunctionsClientWithKey(wrongKey, { customFetch })

    const { data, error } = await fclient.invoke<string>('hello', {})

    expect(error).toBeNull()
    expect(data).toEqual('Hello World')
  })
})
