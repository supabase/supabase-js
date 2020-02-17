import assert from 'assert'
import { PostgrestClient } from '../../lib'

const rootUrl = 'http://localhost:3000'

describe('PostgrestClient', () => {
  it('should return basic data', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client
      .from('users')
      .select(`id`)
      .eq('username', 'kiwicopple')
    assert.equal(body.length, 1)
    assert.deepEqual(body, [{ id: 2 }])
  })

  it('should return relational joins', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client
      .from('channels')
      .select(`slug, messages(message)`)
      .eq('slug', 'public')
    let hasCorrectMessages = body[0].messages.some(x => x.message == 'Hello World 👋')
    assert.equal(body[0].slug, 'public')
    assert.equal(true, hasCorrectMessages)
  })

  it('should be able to insert data', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('messages')
      .insert([{ message: 'Test message 0', channel_id: 1, user_id: 2 }])
    assert.equal(201, res.status)
  })

  it('should be able to insert data in the form of an object and return the object', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('messages')
      .insert({ message: 'Test message 1', channel_id: 1, user_id: 3 })
    assert.equal('Test message 1', res.body[0].message)
  })

  it('should be able to insert an array of data and return the array', async () => {
    let client = new PostgrestClient(rootUrl)
    let payload = [
      { message: 'Test message 2', channel_id: 1, user_id: 4 },
      { message: 'Test message 3', channel_id: 1, user_id: 4 },
    ]

    let res = await client.from('messages').insert(payload)

    assert.equal(payload.length, res.body.length)
    assert.equal('Test message 2', res.body[0].message)
    assert.equal('Test message 3', res.body[1].message)
  })

  it('should not be able to update messages without any filters used', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('messages')
      .update({ message: 'Updated test message x', channel_id: 1, user_id: 2 })

    assert.equal(400, res.status)
    assert.equal('.update() cannot be invoked without any filters.', res.statusText)
  })

  it('should not accept an array when updating messages', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('messages')
      .gt('user_id', 2)
      .update([
        { message: 'Updated test message xx', channel_id: 1, user_id: 4 },
        { message: 'Updated test message xxx', channel_id: 1, user_id: 4 },
      ])

    assert.equal(400, res.status)
    assert.equal('Data type should be an object.', res.statusText)
  })

  it('should be able to update messages', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('messages')
      .eq('message', 'Test message 0')
      .update({ message: 'Updated test message 1', channel_id: 1, user_id: 2 })

    assert.equal(200, res.status)
    assert.equal('Updated test message 1', res.body[0].message)
  })

  it('should be able to update multiple messages', async () => {
    let client = new PostgrestClient(rootUrl)

    let readRes = await client
      .from('messages')
      .gt('user_id', 2)
      .select('*')

    let res = await client
      .from('messages')
      .gt('user_id', 2)
      .update({ message: 'Updated test message 2' })

    assert.equal(readRes.body.length, res.body.length)
    res.body.forEach(item => {
      assert.equal('Updated test message 2', item.message)
    })
  })

  it('should not be able to delete messages without any filters used', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client.from('messages').delete()

    assert.equal(400, res.status)
    assert.equal('.delete() cannot be invoked without any filters.', res.statusText)
  })

  it('should be able to delete messages when any form of filters are used', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('messages')
      .not('user_id', 1)
      .delete()

    assert.equal(204, res.status)
  })
})
