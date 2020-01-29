import assert from 'assert'
import Api from '../lib/BaseApi'

const rootUrl = 'https://api.example.com'

describe('Api', () => {
  it.skip('will attach the api url to requests', () =>
    assert.equal(new Api(rootUrl).request('GET', '/path').url, `${rootUrl}/path`))
})
