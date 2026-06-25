import 'jest'
import { nanoid } from 'nanoid'
import { sign } from 'jsonwebtoken'

import { FunctionsClient } from '../../src/index'

import { Relay, runRelay } from '../relay/container'
import { log } from '../utils/jest-custom-reporter'

describe('timeout tests (slow function)', () => {
  let relay: Relay
  const jwtSecret = nanoid(10)
  const apiKey = sign({ name: 'anon' }, jwtSecret)

  beforeAll(async () => {
    relay = await runRelay('slow', jwtSecret)
  })

  afterAll(async () => {
    if (relay) {
      await relay.stop()
    }
  })

  test('invoke slow function without timeout should succeed', async () => {
    /**
     * @feature timeout
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('invoke slow without timeout')
    const { data, error } = await fclient.invoke<string>('slow', {})

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Slow Response'`)
    expect(data).toEqual('Slow Response')
  })

  test('invoke slow function with short timeout should fail', async () => {
    /**
     * @feature timeout
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('invoke slow with 1000ms timeout (function takes 3000ms)')
    const { data, error } = await fclient.invoke<string>('slow', {
      timeout: 1000,
    })

    log('assert error occurred')
    expect(error).not.toBeNull()
    expect(error?.name).toEqual('FunctionsFetchError')
    expect(data).toBeNull()
  })

  test('invoke slow function with long timeout should succeed', async () => {
    /**
     * @feature timeout
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('invoke slow with 5000ms timeout (function takes 3000ms)')
    const { data, error } = await fclient.invoke<string>('slow', {
      timeout: 5000,
    })

    log('assert no error')
    expect(error).toBeNull()
    log(`assert ${data} is equal to 'Slow Response'`)
    expect(data).toEqual('Slow Response')
  })

  test('invoke slow function with timeout and custom AbortSignal', async () => {
    /**
     * @feature timeout
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    const abortController = new AbortController()

    log('invoke slow with both timeout and AbortSignal')
    const invokePromise = fclient.invoke<string>('slow', {
      timeout: 5000, // 5 second timeout
      signal: abortController.signal,
    })

    // Abort after 500ms
    setTimeout(() => {
      log('aborting request via AbortController')
      abortController.abort()
    }, 500)

    const { data, error } = await invokePromise

    log('assert error occurred from abort')
    expect(error).not.toBeNull()
    expect(error?.name).toEqual('FunctionsFetchError')
    expect(data).toBeNull()
  })
})
