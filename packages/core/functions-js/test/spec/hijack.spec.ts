import 'jest'
import { nanoid } from 'nanoid'
import { sign } from 'jsonwebtoken'

import { FunctionsClient } from '../../src/index'

import { Relay, runRelay } from '../relay/container'
import { attach, log } from '../utils/jest-custom-reporter'

describe('hijack connection', () => {
  let relay: Relay
  const jwtSecret = nanoid(10)
  const apiKey = sign({ name: 'anon' }, jwtSecret)
  const func = 'hijack'

  beforeAll(async () => {
    relay = await runRelay(func, jwtSecret)
  })

  afterAll(async () => {
    if (relay) {
      await relay.stop()
    }
  })

  test('invoke func', async () => {
    /**
     * @feature hijack
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    log('invoke func')
    const { data, error } = await fclient.invoke(func, {})

    log('assert error to be "Connection Upgrade is not supported"')
    expect(error).not.toBeNull()
  })
})
