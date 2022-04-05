import 'jest'
import { nanoid } from 'nanoid'
import { sign } from 'jsonwebtoken'
import { ContentType } from 'allure-js-commons'

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
    relay && relay.container && (await relay.container.stop())
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
    const { data, error } = await fclient.invoke<string>('hello', { responseType: 'text' })

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Hello World'`)
    expect(data).toEqual('Hello World')
  })

  test('invoke hello with setAuth', async () => {
    /**
     * @feature auth
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    attach('setAuth', apiKey, ContentType.TEXT)
    fclient.setAuth(apiKey)

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('hello', { responseType: 'text' })

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
    attach('setAuth with wrong jwt', wrongKey, ContentType.TEXT)
    fclient.setAuth(wrongKey)

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('hello', { responseType: 'text' })

    log('check error')
    expect(error).not.toBeNull()
    expect(error?.message).toEqual('Invalid JWT')
    expect(data).toBeNull()
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
    attach('setAuth with wrong jwt', wrongKey, ContentType.TEXT)
    fclient.setAuth(wrongKey)

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('hello', { responseType: 'text' })

    log('check error')
    expect(error).not.toBeNull()
    expect(error?.message).toEqual('Invalid JWT')
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

    attach('setAuth with right jwt', apiKey, ContentType.TEXT)
    fclient.setAuth(apiKey)

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('hello', { responseType: 'text' })

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
      responseType: 'text',
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
    attach('setAuth with wrong jwt', wrongKey, ContentType.TEXT)
    fclient.setAuth(wrongKey)

    log('invoke hello with Authorization header')
    const { data, error } = await fclient.invoke<string>('hello', {
      responseType: 'text',
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
      responseType: 'text',
      headers: {
        Authorization: `Bearer ${wrongKey}`,
      },
    })

    log('check error')
    expect(error).not.toBeNull()
    expect(error?.message).toEqual('Invalid JWT')
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
    const { data, error } = await fclient.invoke<string>('missing', { responseType: 'text' })

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
    const fclient = new FunctionsClient(
      `http://localhost:${relay.container.getMappedPort(8081)}`, {
        customFetch: getCustomFetch(
          `http://localhost:${relay.container.getMappedPort(8081)}/${'hello'}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })
      }
    )

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('', { responseType: 'text' })

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Hello World'`)
    expect(data).toEqual('Hello World')
  })

  test('invoke with custom fetch wrong method', async () => {
    /**
     * @feature fetch
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(
      `http://localhost:${relay.container.getMappedPort(8081)}`, {
        customFetch: getCustomFetch(
          `http://localhost:${relay.container.getMappedPort(8081)}/${'hello'}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })
      }
    )

    log('invoke hello')
    const { data, error } = await fclient.invoke<string>('', { responseType: 'text' })

    log('check error')
    expect(error).not.toBeNull()
    log(`assert ${error?.message} is equal to 'Only POST and OPTIONS requests are supported'`)
    expect(error?.message).toEqual('Only POST and OPTIONS requests are supported')
    expect(data).toBeNull()
  })

  test('invoke hello with custom fetch override header', async () => {
    /**
     * @feature fetch
     */
    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')
    log('create FunctionsClient')
    const fclient = new FunctionsClient(
      `http://localhost:${relay.container.getMappedPort(8081)}`, {
        headers: {
          Authorization: `Bearer ${wrongKey}`,
        },
        customFetch: getCustomFetch(`http://localhost:${relay.container.getMappedPort(8081)}/${'hello'}`, {
          method: 'Post',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })
      }
    )

    log('invoke hello with Authorization header')
    const { data, error } = await fclient.invoke<string>('hello', {
      responseType: 'text',
    })

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Hello World'`)
    expect(data).toEqual('Hello World')
  })
})
