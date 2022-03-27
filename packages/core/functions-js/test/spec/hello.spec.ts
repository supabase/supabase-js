import 'mocha'
import { assert } from 'chai'
import { nanoid } from 'nanoid'
import { sign } from 'jsonwebtoken'
import { ContentType } from 'allure2-js-commons'

import { FunctionsClient } from '../../src/index'

import { Relay, runRelay } from '../relay/container'
import { attach, log } from '../utils/allure'
import { getCustomFetch } from '../utils/fetch'

describe('basic tests (hello function)', () => {
  let relay: Relay
  const jwtSecret = nanoid(10)
  const apiKey = sign({ name: 'anon' }, jwtSecret)

  before(async () => {
    relay = await runRelay('hello', jwtSecret)
  })

  after(async () => {
    relay && relay.container && (await relay.container.stop())
  })

  it('invoke hello with auth header', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      Authorization: `Bearer ${apiKey}`,
    })

    log('invoke hello')
    const { data, error } = await fclient.invoke('hello', { responseType: 'text' })

    log('assert no error')
    assert.isNull(error)
    log(`assert ${data} is equal to 'Hello World'`)
    assert.equal(data, 'Hello World')
  })

  it('invoke hello with setAuth', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    attach('setAuth', apiKey, ContentType.TEXT)
    fclient.setAuth(apiKey)

    log('invoke hello')
    const { data, error } = await fclient.invoke('hello', { responseType: 'text' })

    log('assert no error')
    assert.isNull(error)
    log(`assert ${data} is equal to 'Hello World'`)
    assert.equal(data, 'Hello World')
  })

  it('invoke hello with setAuth wrong key', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')
    attach('setAuth with wrong jwt', wrongKey, ContentType.TEXT)
    fclient.setAuth(wrongKey)

    log('invoke hello')
    const { data, error } = await fclient.invoke('hello', { responseType: 'text' })

    log('check error')
    assert.isNotNull(error)
    // todo check error
    log(`assert ${data} is equal to 'Invalid JWT'`)
    assert.equal(data, 'Invalid JWT')
  })

  it('invoke hello: auth override by setAuth wrong key', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      Authorization: `Bearer ${apiKey}`,
    })
    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')
    attach('setAuth with wrong jwt', wrongKey, ContentType.TEXT)
    fclient.setAuth(wrongKey)

    log('invoke hello')
    const { data, error } = await fclient.invoke('hello', { responseType: 'text' })

    log('check error')
    assert.isNotNull(error)
    // todo check error
    log(`assert ${data} is equal to 'Invalid JWT'`)
    assert.equal(data, 'Invalid JWT')
  })

  it('invoke hello: auth override by setAuth right key', async () => {
    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')

    log('create FunctionsClient with wrong jwt')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      Authorization: `Bearer ${wrongKey}`,
    })

    attach('setAuth with right jwt', apiKey, ContentType.TEXT)
    fclient.setAuth(apiKey)

    log('invoke hello')
    const { data, error } = await fclient.invoke('hello', { responseType: 'text' })

    log('assert no error')
    assert.isNull(error)
    log(`assert ${data} is equal to 'Hello World'`)
    assert.equal(data, 'Hello World')
  })

  it('invoke hello with auth header in invoke', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)

    log('invoke hello with Authorization header')
    const { data, error } = await fclient.invoke('hello', {
      responseType: 'text',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('assert no error')
    assert.isNull(error)
    log(`assert ${data} is equal to 'Hello World'`)
    assert.equal(data, 'Hello World')
  })

  it('invoke hello with auth header override in invoke', async () => {
    log('create FunctionsClient with wrong jwt')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)

    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')
    attach('setAuth with wrong jwt', wrongKey, ContentType.TEXT)
    fclient.setAuth(wrongKey)

    log('invoke hello with Authorization header')
    const { data, error } = await fclient.invoke('hello', {
      responseType: 'text',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('assert no error')
    assert.isNull(error)
    log(`assert ${data} is equal to 'Hello World'`)
    assert.equal(data, 'Hello World')
  })

  it('invoke hello with wrong auth header overridden in invoke', async () => {
    log('create FunctionsClient with wrong jwt')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      Authorization: `Bearer ${apiKey}`,
    })

    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')
    log('invoke hello with wrong Authorization header')
    const { data, error } = await fclient.invoke('hello', {
      responseType: 'text',
      headers: {
        Authorization: `Bearer ${wrongKey}`,
      },
    })

    log('check error')
    assert.isNotNull(error)
    // todo check error
    log(`assert ${data} is equal to 'Invalid JWT'`)
    assert.equal(data, 'Invalid JWT')
  })

  it('invoke missing function', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      Authorization: `Bearer ${apiKey}`,
    })

    log('invoke hello')
    const { data, error } = await fclient.invoke('missing', { responseType: 'text' })

    log('check error')
    assert.isNotNull(error)
    // todo check error and data
  })

  it('invoke with custom fetch', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(
      `http://localhost:${relay.container.getMappedPort(8081)}`,
      {},
      getCustomFetch(`http://localhost:${relay.container.getMappedPort(8081)}/${'hello'}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })
    )

    log('invoke hello')
    const { data, error } = await fclient.invoke('', { responseType: 'text' })

    log('assert no error')
    assert.isNull(error)
    log(`assert ${data} is equal to 'Hello World'`)
    assert.equal(data, 'Hello World')
  })

  it('invoke with custom fetch wrong method', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(
      `http://localhost:${relay.container.getMappedPort(8081)}`,
      {},
      getCustomFetch(`http://localhost:${relay.container.getMappedPort(8081)}/${'hello'}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })
    )

    log('invoke hello')
    const { data, error } = await fclient.invoke('', { responseType: 'text' })

    log('check error')
    assert.isNotNull(error)
    // todo check error
    log(`assert ${data} is equal to 'Only POST requests are supported'`)
    assert.equal(data, 'Only POST requests are supported')
  })

  it('invoke hello with custom fetch override header', async () => {
    const wrongKey = sign({ name: 'anon' }, 'wrong_jwt')
    log('create FunctionsClient')
    const fclient = new FunctionsClient(
      `http://localhost:${relay.container.getMappedPort(8081)}`,
      {
        Authorization: `Bearer ${wrongKey}`,
      },
      getCustomFetch(`http://localhost:${relay.container.getMappedPort(8081)}/${'hello'}`, {
        method: 'Post',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })
    )

    log('invoke hello with Authorization header')
    const { data, error } = await fclient.invoke('hello', {
      responseType: 'text',
    })

    log('assert no error')
    assert.isNull(error)
    log(`assert ${data} is equal to 'Hello World'`)
    assert.equal(data, 'Hello World')
  })
})
