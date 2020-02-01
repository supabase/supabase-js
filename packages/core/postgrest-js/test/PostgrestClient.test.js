import assert from 'assert'
import { PostgrestClient } from '../lib'

const rootUrl = 'https://world.supabase.co/rest/v1'
const queryParams = { apikey: 'public-key-bOYapLADERfE' }

describe('PostgrestClient', () => {
  it('Initialise', () => assert.equal(new PostgrestClient(rootUrl).restUrl, `${rootUrl}`))

  it('With optional query params', () => {
    assert.equal(
      new PostgrestClient(rootUrl, { queryParams: { ...queryParams, 'other-param': 'foobar' } })
        .queryString,
      `apikey=public-key-bOYapLADERfE&other-param=foobar`
    )
  })

  it('from(some_table)', () =>
    assert.equal(new PostgrestClient(rootUrl).from('some_table').url, `${rootUrl}/some_table`))

  it('rpc(stored_procedure)', () =>
    assert.equal(
      new PostgrestClient(rootUrl).rpc('stored_procedure').url,
      `${rootUrl}/rpc/stored_procedure`
    ))

  it('should return basic data', async () => {
    let client = new PostgrestClient(rootUrl, { queryParams })
    let { body } = await client
      .from('countries')
      .select(`id`)
      .eq('name', 'New Zealand')
    assert.equal(body.length, 1)
    assert.deepEqual(body, [{ id: 554 }])
  })

  it('should return realtional joins', async () => {
    let client = new PostgrestClient(rootUrl, { queryParams })
    let { body } = await client
      .from('countries')
      .select(`id, cities(*)`)
      .eq('name', 'New Zealand')
    let hasCorrectCities = body[0].cities.some(x => x.name == 'Auckland')
    assert.equal(body[0].id, 554)
    assert.equal(true, hasCorrectCities)
  })

})
