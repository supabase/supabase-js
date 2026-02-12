import { Blob } from 'buffer'
import querystring from 'querystring'

import 'jest'
import { nanoid } from 'nanoid'

import { FunctionsClient, FunctionRegion } from '@supabase/functions-js'
import { createFunctionsClient, getFunctionsInfo } from '../../helpers/functions-client'

// Helper to convert string to ArrayBuffer
function str2ab(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

// Mirror response type
type MirrorResponse = {
  url: string
  method: string
  headers?: Array<[string, string]>
  body?: any
}

describe('params reached to function', () => {
  const { anonKey } = getFunctionsInfo()

  test('invoke mirror', async () => {
    /**
     * @feature core
     */
    const fclient = createFunctionsClient()

    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {})

    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    expect(data).toEqual(expected)
  })

  test('invoke mirror with client header', async () => {
    /**
     * @feature headers
     */
    const fclient = createFunctionsClient({
      headers: {
        CustomHeader: 'check me',
      },
    })

    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {})

    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    expect(data).toEqual(expected)
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
    const fclient = createFunctionsClient()

    const customHeader = nanoid()
    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      headers: {
        'custom-header': customHeader,
      },
    })

    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    expect(data).toEqual(expected)
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
    const fclient = createFunctionsClient()

    const customHeader = nanoid()
    const validRegion = FunctionRegion.ApNortheast1

    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      headers: {
        'custom-header': customHeader,
      },
      region: validRegion,
    })

    expect(error).toBeNull()

    // Check that x-region header is present
    expect(
      (data?.headers as [Array<string>]).filter(([k, v]) => k === 'x-region' && v === validRegion)
        .length > 0
    ).toBe(true)

    // Check that the URL contains the forceFunctionRegion query parameter
    expect(data?.url).toContain(`forceFunctionRegion=${validRegion}`)
  })

  test('invoke with region overrides region in the client', async () => {
    /**
     * @feature headers
     */
    const fclient = createFunctionsClient({
      region: FunctionRegion.ApNortheast1,
    })

    const customHeader = nanoid()
    const validRegion = FunctionRegion.ApSoutheast1

    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      headers: {
        'custom-header': customHeader,
      },
      region: validRegion,
    })

    const expected = {
      url: `http://localhost:8000/mirror?forceFunctionRegion=${FunctionRegion.ApSoutheast1}`,
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    expect(data).toEqual(expected)
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
    const validRegion = FunctionRegion.ApSoutheast1
    const fclient = createFunctionsClient({
      region: validRegion,
    })

    const customHeader = nanoid()

    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      headers: {
        'custom-header': customHeader,
      },
      region: FunctionRegion.Any,
    })

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: '',
    }
    expect(data).toEqual(expected)
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
    const fclient = createFunctionsClient({
      region: FunctionRegion.ApNortheast1,
    })

    const customHeader = nanoid()

    const { data, error } = await fclient.invoke<MirrorResponse>('mirror', {
      headers: {
        'custom-header': customHeader,
      },
    })

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
    const fclient = createFunctionsClient()
    fclient.setAuth(anonKey)

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

    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: formData,
    }
    expect(data).toEqual(expected)
  })

  test('invoke mirror with body json', async () => {
    /**
     * @feature body
     */
    const fclient = createFunctionsClient()
    fclient.setAuth(anonKey)

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

    expect(error).toBeNull()

    const expected = {
      url: 'http://localhost:8000/mirror',
      method: 'POST',
      headers: data?.headers ?? [],
      body: body,
    }
    expect(data).toEqual(expected)
  })

  test('invoke mirror with body arrayBuffer', async () => {
    /**
     * @feature body
     */
    const fclient = createFunctionsClient()
    fclient.setAuth(anonKey)

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
    const fclient = createFunctionsClient()
    fclient.setAuth(anonKey)

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
    const fclient = createFunctionsClient()
    fclient.setAuth(anonKey)

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

    expect(error).toBeNull()

    const expected = {
      url: `http://localhost:8000/mirror?${queryParams.toString()}`,
      method: 'POST',
    }
    expect(data).toMatchObject(expected)
  })
})

describe('body stringify with custom headers', () => {
  test('should stringify object body when custom Content-Type is provided', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('ok'))
    const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })

    await client.invoke('test-fn', {
      body: { foo: 'bar' },
      headers: { 'Content-Type': 'application/json' },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: '{"foo":"bar"}', // not '[object Object]'
      })
    )
  })

  test('should stringify nested object body when custom headers are provided', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('ok'))
    const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })

    await client.invoke('test-fn', {
      body: { nested: { deep: { value: 123 } }, array: [1, 2, 3] },
      headers: { 'Content-Type': 'application/json', 'X-Custom': 'header' },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: '{"nested":{"deep":{"value":123}},"array":[1,2,3]}',
      })
    )
  })

  test('should not double-stringify string body when custom Content-Type is provided', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('ok'))
    const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })

    await client.invoke('test-fn', {
      body: '{"already":"stringified"}',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: '{"already":"stringified"}',
      })
    )
  })
})
