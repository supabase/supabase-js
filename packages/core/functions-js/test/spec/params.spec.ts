import { Blob } from 'buffer'
import querystring from 'querystring'

import 'jest'
import { nanoid } from 'nanoid'
import { sign } from 'jsonwebtoken'

import { FunctionsClient } from '../../src/index'
import { FunctionRegion } from '../../src/types'
import { Relay, runRelay } from '../relay/container'
import { attach, log } from '../utils/jest-custom-reporter'
import { str2ab } from '../utils/binaries'
import { MirrorResponse } from '../models/mirrorResponse'

describe('params reached to function', () => {
  let relay: Relay
  const jwtSecret = nanoid(10)
  const apiKey = sign({ name: 'anon' }, jwtSecret)

  beforeAll(async () => {
    relay = await runRelay('mirror', jwtSecret)
  })

  afterAll(async () => {
    if (relay) {
      await relay.stop()
    }
  })

  test('invoke mirror', async () => {
    /**
     * @feature core
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('invoke mirror')
    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {})

    log('assert no error')
    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    attach(
      'check data from function',
      `expected: ${JSON.stringify(expected)}\n actual: ${JSON.stringify(data)}`,
      'text/plain'
    )
    expect(data).toEqual(expected)
  })

  test('invoke mirror with client header', async () => {
    /**
     * @feature headers
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        CustomHeader: 'check me',
      },
    })

    log('invoke mirror')
    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {})

    log('assert no error')
    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    attach(
      'check data from function',
      `expected: ${JSON.stringify(expected)}\n actual: ${JSON.stringify(data)}`,
      'text/plain'
    )
    expect(data).toEqual(expected)
    attach(
      'check headers from function',
      `expected to include: ${['customheader', 'check me']}\n actual: ${JSON.stringify(
        data?.headers
      )}`,
      'text/plain'
    )
    expect(
      (data?.headers as [Array<string>]).filter(
        ([k, v]) => k === 'customheader' && v === 'check me'
      ).length > 0
    ).toBe(true)
  })

  test('invoke mirror with invoke header', async () => {
    /**
     * @feature headers
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)

    log('invoke mirror')
    const customHeader = nanoid()
    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      headers: {
        'custom-header': customHeader,
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('assert no error')
    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    attach(
      'check data from function',
      `expected: ${JSON.stringify(expected)}\n actual: ${JSON.stringify(data)}`,
      'text/plain'
    )
    expect(data).toEqual(expected)
    attach(
      'check headers from function',
      `expected to include: ${['custom-header', customHeader]}\n actual: ${JSON.stringify(
        data?.headers
      )}`,
      'text/plain'
    )
    expect(
      (data?.headers as [Array<string>]).filter(
        ([k, v]) => k === 'custom-header' && v === customHeader
      ).length > 0
    ).toBe(true)
  })

  test('invoke mirror set valid region on request', async () => {
    /**
     * @feature headers
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)

    log('invoke mirror')
    const customHeader = nanoid()
    const validRegion = FunctionRegion.ApNortheast1

    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      headers: {
        'custom-header': customHeader,
        Authorization: `Bearer ${apiKey}`,
      },
      region: validRegion,
    })

    log('assert no error')
    expect(error).toBeNull()

    // Check that x-region header is present
    expect(
      (data?.headers as [Array<string>]).filter(([k, v]) => k === 'x-region' && v === validRegion)
        .length > 0
    ).toBe(true)

    // Check that the URL contains the forceFunctionRegion query parameter
    expect(data?.url).toContain(`forceFunctionRegion=${validRegion}`)

    attach(
      'check headers from function',
      `expected to include: ${['custom-header', customHeader]}\n actual: ${JSON.stringify(
        data?.headers
      )}`,
      'text/plain'
    )
  })

  test('invoke with region overrides region in the client', async () => {
    /**
     * @feature headers
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      region: FunctionRegion.ApNortheast1,
    })

    log('invoke mirror')
    const customHeader = nanoid()
    const validRegion = FunctionRegion.ApSoutheast1

    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      headers: {
        'custom-header': customHeader,
        Authorization: `Bearer ${apiKey}`,
      },
      region: validRegion,
    })

    log('assert no error')
    const expected = {
      url: `http://localhost:8000/mirror?forceFunctionRegion=${FunctionRegion.ApSoutheast1}`,
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    expect(data).toEqual(expected)
    attach(
      'check headers from function',
      `expected to include: ${['custom-header', customHeader]}\n actual: ${JSON.stringify(
        data?.headers
      )}`,
      'text/plain'
    )
    console.log(data?.headers)
    expect(
      (data?.headers as [Array<string>]).filter(([k, v]) => k === 'x-region' && v === validRegion)
        .length > 0
    ).toBe(true)
  })

  test('starts client with default region, invoke reverts to any (no x-region header)', async () => {
    /**
     * @feature headers
     */
    log('create FunctionsClient')
    const validRegion = FunctionRegion.ApSoutheast1
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      region: validRegion,
    })

    log('invoke mirror')
    const customHeader = nanoid()

    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      headers: {
        'custom-header': customHeader,
        Authorization: `Bearer ${apiKey}`,
      },
      region: FunctionRegion.Any,
    })

    log('assert no error')
    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    expect(data).toEqual(expected)
    attach(
      'check headers from function',
      `expected to include: ${['custom-header', customHeader]}\n actual: ${JSON.stringify(
        data?.headers
      )}`,
      'text/plain'
    )
    console.log(data?.headers)
    expect(
      (data?.headers as [Array<string>]).filter(([k, v]) => k === 'x-region' && v === validRegion)
        .length == 0
    ).toBe(true)
  })

  test('invoke region set only on the constructor', async () => {
    /**
     * @feature headers
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      region: FunctionRegion.ApNortheast1,
    })

    log('invoke mirror')
    const customHeader = nanoid()

    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      headers: {
        'custom-header': customHeader,
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('assert no error')
    expect(
      (data?.headers as [Array<string>]).filter(
        ([k, v]) => k === 'x-region' && v === FunctionRegion.ApNortheast1
      ).length > 0
    ).toBe(true)
  })

  test('invoke mirror with body formData', async () => {
    /**
     * @feature body
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    attach('setAuth', apiKey, 'text/plain')
    fclient.setAuth(apiKey)

    log('invoke mirror')
    var form = new FormData()
    const formData = [
      [nanoid(5), nanoid(10)],
      [nanoid(7), nanoid(5)],
      [nanoid(15), nanoid()],
    ]
    formData.forEach((e) => form.append(e[0], e[1]))

    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      body: form,
      headers: {
        'response-type': 'form',
      },
    })

    log('assert no error')
    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: formData,
    }
    attach(
      'check data from function',
      `expected: ${JSON.stringify(expected)}\n actual: ${JSON.stringify(data)}`,
      'text/plain'
    )
    expect(data).toEqual(expected)
  })

  test('invoke mirror with body json', async () => {
    /**
     * @feature body
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    attach('setAuth', apiKey, 'text/plain')
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
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        'response-type': 'json',
      },
    })

    log('assert no error')
    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: body,
    }
    attach(
      'check data from function',
      `expected: ${JSON.stringify(expected)}\n actual: ${JSON.stringify(data)}`,
      'text/plain'
    )
    expect(data).toEqual(expected)
  })

  test('invoke mirror with body arrayBuffer', async () => {
    /**
     * @feature body
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    attach('setAuth', apiKey, 'text/plain')
    fclient.setAuth(apiKey)

    log('invoke mirror')
    const body = {
      one: nanoid(10),
      two: nanoid(5),
      three: nanoid(),
      num: 11,
      flag: false,
    }
    const arrayBuffer = str2ab(JSON.stringify(body))
    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      body: arrayBuffer,
      headers: {
        'content-type': 'application/octet-stream',
        'response-type': 'arrayBuffer',
      },
    })

    log('assert no error')
    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      body: arrayBuffer,
    }
    expect(data).toMatchObject(expected)
  })

  test('invoke mirror with body blob', async () => {
    /**
     * @feature body
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    attach('setAuth', apiKey, 'text/plain')
    fclient.setAuth(apiKey)

    log('invoke mirror')
    const body = {
      one: nanoid(10),
      two: nanoid(5),
      three: nanoid(),
      num: 11,
      flag: false,
    }
    const bodyEncoded = str2ab(JSON.stringify(body))
    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      body: bodyEncoded,
      headers: {
        'content-type': 'application/octet-stream',
        'response-type': 'blob',
      },
    })

    log('assert no error')
    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      body: bodyEncoded,
    }
    expect(data).toMatchObject(expected)
  })

  test('invoke mirror with url params', async () => {
    /**
     * @feature body
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`)
    attach('setAuth', apiKey, 'text/plain')
    fclient.setAuth(apiKey)

    log('invoke mirror')
    const body = {
      one: nanoid(10),
      two: nanoid(5),
      three: nanoid(),
      num: '11',
      flag: 'false',
    }
    const queryParams = new URLSearchParams(body)
    const { data, error } = await fclient.invoke<MirrorResponse>(
      `mirror?${queryParams.toString()}`,
      {}
    )

    log('assert no error')
    expect(error).toBeNull()

    const expected = {
      url: `http://localhost:8000/mirror?${queryParams.toString()}`,
      method: 'POST',
    }
    expect(data).toMatchObject(expected)
  })
})
