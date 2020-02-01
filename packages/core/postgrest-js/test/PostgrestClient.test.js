import assert from 'assert'
import { PostgrestClient } from '../lib'

const rootUrl = 'https://api.example.com'
const queryParams = { apiKey: 'some-key', 'other-param': 'foobar' }

describe('PostgrestClient', () => {
  it('Initialise', () => assert.equal(new PostgrestClient(rootUrl).restUrl, `${rootUrl}`))

  it('With optional query params', () =>
    assert.equal(new PostgrestClient(rootUrl, { queryParams} ).queryString, `apiKey=some-key&other-param=foobar`))

  it('from(some_table)', () =>
    assert.equal(new PostgrestClient(rootUrl).from('some_table').url, `${rootUrl}/some_table`))

  it('rpc(stored_procedure)', () =>
    assert.equal(
      new PostgrestClient(rootUrl).rpc('stored_procedure').url,
      `${rootUrl}/rpc/stored_procedure`
    ))
})
