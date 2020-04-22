import assert from 'assert'
import { PostgrestClient } from '../../lib'

const rootUrl = 'http://localhost:3000'

describe('MultiSchema', () => {
  it('should be able to read data from the other schema', async () => {
    let client = new PostgrestClient(rootUrl, { schema: 'personal' })
    let { body } = await client.from('users').select('username').eq('username', 'leroyjenkins')

    let mainClient = new PostgrestClient(rootUrl)
    let { body: mainBody } = await mainClient
      .from('users')
      .select('username')
      .eq('username', 'leroyjenkins')

    assert.equal(body.length, 1)
    assert.equal(mainBody.length, 0)
    assert.deepEqual(body, [{ username: 'leroyjenkins' }])
  })

  it('should be able to write data on the other schema', async () => {
    let client = new PostgrestClient(rootUrl, { schema: 'personal' })
    let { body } = await client
      .from('users')
      .update({ status: 'OFFLINE' })
      .eq('username', 'dragarcia')

    let mainClient = new PostgrestClient(rootUrl)
    let { body: mainBody } = await mainClient
      .from('users')
      .select('status')
      .eq('username', 'dragarcia')

    assert.equal(body[0].status, 'OFFLINE')
    assert.equal(mainBody[0].status, 'ONLINE')
  })

  it('should return an error if a non-existent schema is provided for reading data', async () => {
    var res
    try {
      let client = new PostgrestClient(rootUrl, { schema: 'private' })
      res = await client.from('channels').select('*')
    } catch (error) {
      res = error
    }

    assert.equal(
      JSON.parse(res.response.text).message,
      'The schema must be one of the following: public, personal'
    )
  })

  it('should return an error if a non-existent schema is provided for writing data', async () => {
    var res
    try {
      let client = new PostgrestClient(rootUrl, { schema: 'private' })
      res = await client.from('channels').update({ slug: 'private' }).eq('slug', 'random')
    } catch (error) {
      res = error
    }

    assert.equal(
      JSON.parse(res.response.text).message,
      'The schema must be one of the following: public, personal'
    )
  })

  it('should return the value of a function specific to the other schema', async () => {
    let client = new PostgrestClient(rootUrl, { schema: 'personal' })
    let { body } = await client.rpc('get_status', { name_param: 'leroyjenkins' })

    assert.equal(body, 'ONLINE')
  })

  it('should return an error if a schema is provided with a non-existent stored procedure', async () => {
    var res
    try {
      let client = new PostgrestClient(rootUrl, { schema: 'personal' })
      res = await client.rpc('get_information', { name_param: 'leroyjenkins' })
    } catch (error) {
      res = error
    }

    assert.equal(
      JSON.parse(res.response.text).message,
      'function personal.get_information(name_param => text) does not exist'
    )
  })

  it('should return an error if a non-existent schema is provided for a stored procedure', async () => {
    var res
    try {
      let client = new PostgrestClient(rootUrl, { schema: 'private' })
      res = await client.rpc('get_status', { name_param: 'leroyjenkins' })
    } catch (error) {
      res = error
    }

    assert.equal(
      JSON.parse(res.response.text).message,
      'The schema must be one of the following: public, personal'
    )
  })
})
