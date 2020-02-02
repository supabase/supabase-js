import assert from 'assert'
import { PostgrestClient } from '../../lib'

const rootUrl = 'https://localhost:3000/'
// const queryParams = { apikey: 'public-key-bOYapLADERfE' }

describe('PostgrestClient', () => {
  it('Initialise', () => assert.equal(new PostgrestClient(rootUrl).restUrl, `${rootUrl}`))

  it('With optional query params', () => {
    assert.equal(
      new PostgrestClient(rootUrl, { queryParams: { 'some-param': 'foo', 'other-param': 'bar' } })
        .queryString,
      `some-param=foo&other-param=bar`
    )
  })

  it('from(some_table)', () =>
    assert.equal(new PostgrestClient(rootUrl).from('some_table').url, `${rootUrl}/some_table`))

  it('rpc(stored_procedure)', () =>
    assert.equal(
      new PostgrestClient(rootUrl).rpc('stored_procedure').url,
      `${rootUrl}/rpc/stored_procedure`
    ))

})
