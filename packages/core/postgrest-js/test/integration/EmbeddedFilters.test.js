import assert from 'assert'
import { PostgrestClient } from '../../lib'

const rootUrl = 'http://localhost:3000'

describe('Embedded Filters', () => {
  it('should be able to support filters', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client
      .from('users')
      .select('*,messages(*)')
      .eq('username', 'supabot')
      .eq('messages.channel_id', 1)

    assert.equal(body.length, 1)
    assert.equal(body[0].messages[0].message, 'Hello World 👋')
  })

  it('should be able to support order()', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client
      .from('users')
      .select('*,messages(*)')
      .eq('username', 'supabot')
      .order('messages.channel_id')

    assert.equal(
      body[0].messages[0].message,
      'Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.'
    )
    assert.equal(body[0].messages[1].message, 'Hello World 👋')
  })

  it('should be able to support limit()', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client
      .from('users')
      .select('*,messages(*)')
      .eq('username', 'supabot')
      .limit(1, 'messages')

    assert.equal(body.length, 1)
    assert.equal(body[0].messages[0].message, 'Hello World 👋')
  })

  it('should be able to support offset()', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client
      .from('users')
      .select('*,messages(*)')
      .eq('username', 'supabot')
      .offset(1, 'messages')

    assert.equal(body.length, 1)
    assert.equal(
      body[0].messages[0].message,
      'Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.'
    )
  })
})
