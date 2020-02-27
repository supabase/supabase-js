import assert from 'assert'
import Request from '../../lib/Request'

describe('Request', () => {
  it('will only ever accept json', () => {
    const req = new Request('GET', '/')
    assert.equal(req._header.accept, 'application/json')
  })

  it('will authorize in auth() using a token', () => {
    const req = new Request('GET', '/').auth('token')
    assert.equal(req._header.authorization, 'Bearer token')
  })

  it('will authorize in auth() using a basic auth object', () => {
    const user = 'user'
    const pass = 'pass'
    const authHeader = new Buffer.from(`${user}:${pass}`).toString('base64')
    const req = new Request('GET', '/').auth({ user, pass })
    assert.equal(req._header.authorization, `Basic ${authHeader}`)
  })

  it('will translate match() key/values to filter', () => {
    const { _query } = new Request('GET', '/').match({ key1: 'value1', key2: 'value2' })
    assert.deepEqual(_query, [ 'key1=eq.value1', 'key2=eq.value2' ])
  })

  it('won‘t assign to the passed match() filter', () => {
    const match = { key1: 'value1', key2: 'value2' }
    const { _query } = new Request('GET', '/').match(match)
    assert.deepEqual(_query, [ 'key1=eq.value1', 'key2=eq.value2' ])
    assert.deepEqual(match, { key1: 'value1', key2: 'value2' })
  })

  it('will return a promise from end()', () => {
    const request = new Request('GET', '/')
      .end()
      .then(x => {})
      .catch(e => {})
    assert(request instanceof Promise)
  })

  it('can be resolved', done => {
    const request = new Request('GET', '/')
    Promise.resolve(request).catch(() => done())
  })

  it('can be used in an async/await context', async () => {
    try {
      await new Request('GET', '/')
      throw new Error('Another error should be thrown')
    } catch (error) {
      if (error.code !== 'ECONNREFUSED') {
        throw error
      }
    }
  })
})
