import 'mocha'
import { assert } from 'chai'
import { nanoid } from 'nanoid'
import { sign } from 'jsonwebtoken'

import { FunctionsClient } from '../../src/index'

import { Relay, runRelay } from '../relay/container'
import { log } from '../utils/allure'

describe('HelloTest', () => {
  let relay: Relay
  let fclient: FunctionsClient
  const jwtSecret = nanoid(10)
  let apiKey = sign({ name: 'anon' }, jwtSecret)

  before(async () => {
    relay = await runRelay('hello', jwtSecret)
    fclient = new FunctionsClient(`http://localhost:${relay.container.getMappedPort(8081)}`, {
      Authorization: `Bearer ${apiKey}`,
    })
  })

  after(async () => {
    relay && relay.container && (await relay.container.stop())
  })

  it('set up relay with hello function and invoke it', async () => {
    log('invoke hello')
    const { data, error } = await fclient.invoke('hello', { responseType: 'text' })

    log('assert no error')
    assert.isNull(error)
    log(`assert ${data} is equal to 'Hello World'`)
    assert.equal(data, 'Hello World')
  })
})
