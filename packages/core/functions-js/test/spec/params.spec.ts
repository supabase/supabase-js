import 'mocha'
import { assert } from 'chai'
import { nanoid } from 'nanoid'
import { sign } from 'jsonwebtoken'
import { ContentType } from 'allure2-js-commons'

import { FunctionsClient } from '../../src/index'

import { Relay, runRelay } from '../relay/container'
import { attach, log } from '../utils/allure'
import { MirrorResponse } from '../models/mirrorResponse'

describe('params reached to function', () => {
  let relay: Relay
  const jwtSecret = nanoid(10)
  const apiKey = sign({ name: 'anon' }, jwtSecret)

  before(async () => {
    relay = await runRelay('mirror', jwtSecret)
  })

  after(async () => {
    relay && relay.container && (await relay.container.stop())
  })

  it('invoke mirror', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      Authorization: `Bearer ${apiKey}`,
    })

    log('invoke mirror')
    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', { responseType: 'json' })

    log('assert no error')
    assert.isNull(error)

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    attach(
      'check data from function',
      `expected: ${JSON.stringify(expected)}\n actual: ${JSON.stringify(data)}`,
      ContentType.TEXT
    )
    assert.deepEqual(data, expected)
  })

  it('invoke mirror with client header', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      Authorization: `Bearer ${apiKey}`,
      CustomHeader: 'check me',
    })

    log('invoke mirror')
    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', { responseType: 'json' })

    log('assert no error')
    assert.isNull(error)

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    attach(
      'check data from function',
      `expected: ${JSON.stringify(expected)}\n actual: ${JSON.stringify(data)}`,
      ContentType.TEXT
    )
    assert.deepEqual(data, expected)
    attach(
      'check headers from function',
      `expected to include: ${['customheader', 'check me']}\n actual: ${JSON.stringify(
        data?.headers
      )}`,
      ContentType.TEXT
    )
    assert.isTrue(
      (data?.headers as [Array<string>]).filter(
        ([k, v]) => k === 'customheader' && v === 'check me'
      ).length > 0
    )
  })

  it('invoke mirror with invoke header', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)

    log('invoke mirror')
    const customHeader = nanoid()
    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      responseType: 'json',
      headers: {
        'custom-header': customHeader,
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('assert no error')
    assert.isNull(error)

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    attach(
      'check data from function',
      `expected: ${JSON.stringify(expected)}\n actual: ${JSON.stringify(data)}`,
      ContentType.TEXT
    )
    assert.deepEqual(data, expected)
    attach(
      'check headers from function',
      `expected to include: ${['custom-header', customHeader]}\n actual: ${JSON.stringify(
        data?.headers
      )}`,
      ContentType.TEXT
    )
    assert.isTrue(
      (data?.headers as [Array<string>]).filter(
        ([k, v]) => k === 'custom-header' && v === customHeader
      ).length > 0
    )
  })

  it('invoke mirror with body formData', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    attach('setAuth', apiKey, ContentType.TEXT)
    fclient.setAuth(apiKey)

    log('invoke mirror')
    var form = new URLSearchParams()
    form.append(nanoid(5), nanoid(10))
    form.append(nanoid(7), nanoid(5))
    form.append(nanoid(15), nanoid())
    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      responseType: 'json',
      body: form,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    })

    log('assert no error')
    assert.isNull(error)

    const body = []
    for (const e of form.entries()) {
      body.push(e)
    }
    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: body,
    }
    attach(
      'check data from function',
      `expected: ${JSON.stringify(expected)}\n actual: ${JSON.stringify(data)}`,
      ContentType.TEXT
    )
    assert.deepEqual(data, expected)
  })

  it('invoke mirror with body json', async () => {
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    attach('setAuth', apiKey, ContentType.TEXT)
    fclient.setAuth(apiKey)

    log('invoke mirror')
    const body = {
      one: nanoid(10),
      two: nanoid(5),
      three: nanoid(),
      num: 11,
      flag: false,
    }
    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      responseType: 'json',
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
      },
    })

    log('assert no error')
    assert.isNull(error)

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: body,
    }
    attach(
      'check data from function',
      `expected: ${JSON.stringify(expected)}\n actual: ${JSON.stringify(data)}`,
      ContentType.TEXT
    )
    assert.deepEqual(data, expected)
  })
})
