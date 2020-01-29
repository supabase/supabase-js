import assert from 'assert'
import Request from '../lib/Request'

describe('Request', () => {
  it.skip('will only ever accept json', () => {
    const { req } = new Request('GET', '/')
    assert.equal(req._headers.accept, 'application/json')
  })

  it.skip('will authorize in auth() using a token', () => {
    const { req } = new Request('GET', '/').auth('token')
    assert.equal(req._headers.authorization, 'Bearer token')
  })

  it.skip('will authorize in auth() using a basic auth object', () => {
    const user = 'user'
    const pass = 'pass'
    const authHeader = new Buffer(`${user}:${pass}`).toString('base64')
    const { req } = new Request('GET', '/').auth({ user, pass })
    assert.equal(req._headers.authorization, `Basic ${authHeader}`)
  })

  it('will translate match() key/values to filter', () => {
    const { qs } = new Request('GET', '/').match({ key1: 'value1', key2: 'value2' })
    assert.deepEqual(qs, { key1: 'eq.value1', key2: 'eq.value2' })
  })

  it('won‘t assign to the passed match() filter', () => {
    const match = { key1: 'value1', key2: 'value2' }
    const { qs } = new Request('GET', '/').match(match)
    assert.deepEqual(qs, { key1: 'eq.value1', key2: 'eq.value2' })
    assert.deepEqual(match, { key1: 'value1', key2: 'value2' })
  })

  it.skip('will return a promise from end()', () => {
    const request = new Request('GET', '/')
    assert(request.end() instanceof Promise)
  })

  it('can be resolved', done => {
    const request = new Request('GET', '/')
    Promise.resolve(request).catch(() => done())
  })

  it('can be used in an async/await context', async () => {
    try {
      await new Request('GET', '/')
      throw new Error('Another error should be thrown')
    }
    catch (error) {
      if (error.code !== 'ECONNREFUSED') {
        throw error
      }
    }
  })
})