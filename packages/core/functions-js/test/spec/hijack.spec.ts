import { Blob } from 'buffer'
import querystring from 'querystring'

import 'jest'
import { nanoid } from 'nanoid'
import { sign } from 'jsonwebtoken'
import { ContentType } from 'allure-js-commons'

import { FunctionsClient } from '../../src/index'

import { Relay, runRelay } from '../relay/container'
import { attach, log } from '../utils/jest-custom-reporter'
import { MirrorResponse } from '../models/mirrorResponse'

describe('hijack connection', () => {
  let relay: Relay
  const jwtSecret = nanoid(10)
  const apiKey = sign({ name: 'anon' }, jwtSecret)
  const func = 'hijack'

  beforeAll(async () => {
    relay = await runRelay(func, jwtSecret)
  })

  afterAll(async () => {
    relay && relay.container && (await relay.container.stop())
  })

  test('invoke func', async () => {
    /**
     * @feature hijack
     */
    log('create FunctionsClient')
    const fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      Authorization: `Bearer ${apiKey}`,
    })

    log('invoke func')
    const { data, error } = await fclient.invoke(func, {
      responseType: 'text',
    })

    log('assert error to be "Connection Upgrade is not supported"')
    expect(error).not.toBeNull()
  })
})
