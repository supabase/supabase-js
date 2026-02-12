import 'jest'
import { nanoid } from 'nanoid'
import { sign } from 'jsonwebtoken'

import { FunctionsClient } from '../../src/index'

import { Relay, runRelay } from '../relay/container'
import { attach, log } from '../utils/jest-custom-reporter'
import { getCustomFetch } from '../utils/fetch'

describe('basic tests (hello function)', () => {
  let relay: Relay
  const jwtSecret = nanoid(10)
  const apiKey = sign({ name: 'anon' }, jwtSecret)

  beforeAll(async () => {
    relay = await runRelay('hello', jwtSecret)
  })

  afterAll(async () => {
    if (relay) {
      await relay.stop()
    }
  })

  test('invoke hello with auth header', async () => {
    /**
     * @feature auth
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('invoke hello')
    const { data, error, response } = await fclient.invoke<string>('hello', {})

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Hello World'`)
    expect(data).toEqual('Hello World')
    log('assert response object is present')
    expect(response).toBeDefined()
    expect(response).toBeInstanceOf(Response)
  })

  test('invoke hello with setAuth', async () => {
    /**
     * @feature auth
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    attach('setAuth', apiKey, 'text/plain')
    fclient.setAuth(apiKey)

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('hello', {})

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Hello World'`)
    expect(data).toEqual('Hello World')
  })

  test('invoke hello with setAuth wrong key', async () => {
    /**
     * @feature errors
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')
    attach('setAuth with wrong jwt', wrongKey, 'text/plain')
    fclient.setAuth(wrongKey)

    log('invoke hello')
    const { data, error, response } = await fclient.invoke<string>('hello', {})

    log('check error')
    expect(error).not.toBeNull()
    expect(error?.message).toEqual('Relay Error invoking the Edge Function')
    expect(data).toBeNull()
    log('assert response object is present in error case')
    expect(response).toBeDefined()
  })

  test('invoke hello: auth override by setAuth wrong key', async () => {
    /**
     * @feature auth
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')
    attach('setAuth with wrong jwt', wrongKey, 'text/plain')
    fclient.setAuth(wrongKey)

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('hello', {})

    log('check error')
    expect(error).not.toBeNull()
    expect(error?.message).toEqual('Relay Error invoking the Edge Function')
    expect(data).toBeNull()
  })

  test('invoke hello: auth override by setAuth right key', async () => {
    /**
     * @feature auth
     */
    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')

    log('create FunctionsClient with wrong jwt')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${wrongKey}`,
      },
    })

    attach('setAuth with right jwt', apiKey, 'text/plain')
    fclient.setAuth(apiKey)

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('hello', {})

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Hello World'`)
    expect(data).toEqual('Hello World')
  })

  test('invoke hello with auth header in invoke', async () => {
    /**
     * @feature auth
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)

    log('invoke hello with Authorization header')
    const { data, error } = await fclient.invoke<string>('hello', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Hello World'`)
    expect(data).toEqual('Hello World')
  })

  test('invoke hello with auth header override in invoke', async () => {
    /**
     * @feature auth
     */
    log('create FunctionsClient with wrong jwt')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)

    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')
    attach('setAuth with wrong jwt', wrongKey, 'text/plain')
    fclient.setAuth(wrongKey)

    log('invoke hello with Authorization header')
    const { data, error } = await fclient.invoke<string>('hello', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Hello World'`)
    expect(data).toEqual('Hello World')
  })

  test('invoke hello with wrong auth header overridden in invoke', async () => {
    /**
     * @feature auth
     */
    log('create FunctionsClient with wrong jwt')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')
    log('invoke hello with wrong Authorization header')
    const { data, error } = await fclient.invoke<string>('hello', {
      headers: {
        Authorization: `Bearer ${wrongKey}`,
      },
    })

    log('check error')
    expect(error).not.toBeNull()
    expect(error?.message).toEqual('Relay Error invoking the Edge Function')
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
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      customFetch: getCustomFetch(
        `http://localhost:${relay.container.getMappedPort(8081)}/${'hello'}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      ),
    })

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('', {})

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Hello World'`)
    expect(data).toEqual('Hello World')
  })

  test('invoke with custom fetch GET method', async () => {
    /**
     * @feature fetch
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      customFetch: getCustomFetch(
        `http://localhost:${relay.container.getMappedPort(8081)}/${'hello'}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      ),
    })

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('', {})

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Hello World'`)
    expect(data).toEqual('Hello World')
  })

  test('invoke hello with custom fetch override header', async () => {
    /**
     * @feature fetch
     */
    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${wrongKey}`,
      },
      customFetch: getCustomFetch(
        `http://localhost:${relay.container.getMappedPort(8081)}/${'hello'}`,
        {
          method: 'Post',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      ),
    })

    log('invoke hello with Authorization header')
    const { data, error } = await fclient.invoke<string>('hello', {})

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Hello World'`)
    expect(data).toEqual('Hello World')
  })
})
