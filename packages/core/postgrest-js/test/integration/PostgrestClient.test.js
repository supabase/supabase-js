import assert from 'assert'
import { PostgrestClient } from '../../lib'

const rootUrl = 'http://localhost:3000'

describe('PostgrestClient', () => {
  it('should return basic data', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client
      .from('users')
      .select(`username`)
      .eq('status', 'OFFLINE')
    assert.equal(body.length, 1)
    assert.deepEqual(body, [{ username: 'kiwicopple' }])
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
      .insert([{ message: 'Test message 0', channel_id: 1, username: 'kiwicopple' }])
    assert.equal(201, res.status)
  })

  it('should be able to insert data in the form of an object and return the object', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('messages')
      .insert({ message: 'Test message 1', channel_id: 1, username: 'awailas' })
    assert.equal('Test message 1', res.body[0].message)
  })

  it('should be able to insert an array of data and return the array', async () => {
    let client = new PostgrestClient(rootUrl)
    let payload = [
      { message: 'Test message 2', channel_id: 1, username: 'dragarcia' },
      { message: 'Test message 3', channel_id: 1, username: 'dragarcia' },
    ]

    let res = await client.from('messages').insert(payload)

    assert.equal(payload.length, res.body.length)
    assert.equal('Test message 2', res.body[0].message)
    assert.equal('Test message 3', res.body[1].message)
  })

  it('should be able to upsert an array of data and return the array', async () => {
    let client = new PostgrestClient(rootUrl)
    let payload = [
      { username: 'dragarcia', status: 'OFFLINE'},
      { username: 'supabot2', status: 'ONLINE'}
    ]

    let res = await client
      .from('users')
      .insert(payload, {upsert:true})

    assert.equal(payload.length, res.body.length)
  })

  it('should be able to upsert data that exists in the database', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('users')
      .insert({ username: 'dragarcia', status: 'ONLINE'}, {upsert:true})

    assert.equal('dragarcia', res.body[0].username)
    assert.equal('ONLINE', res.body[0].status)
  })

  it('should be able to upsert data that does not exist in the database', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('users')
      .insert({ username: 'supabot3', status: 'ONLINE'}, {upsert:true})

    assert.equal('supabot3', res.body[0].username)
    assert.equal('ONLINE', res.body[0].status)
  })

  it('should not be able to update messages without any filters used', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('messages')
      .update({ message: 'Updated test message x', channel_id: 1, username: 'kiwicopple' })

    assert.equal(400, res.status)
    assert.equal('.update() cannot be invoked without any filters.', res.statusText)
  })

  it('should not accept an array when updating messages', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('messages')
      .eq('username', 'dragarcia')
      .update([
        { message: 'Updated test message xx', channel_id: 1, username: 'dragarcia' },
        { message: 'Updated test message xxx', channel_id: 1, username: 'dragarcia' },
      ])

    assert.equal(400, res.status)
    assert.equal('Data type should be an object.', res.statusText)
  })

  it('should be able to update messages', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client
      .from('messages')
      .eq('message', 'Test message 0')
      .update({ message: 'Updated test message 1', channel_id: 1, username: 'kiwicopple' })

    assert.equal(200, res.status)
    assert.equal('Updated test message 1', res.body[0].message)
  })

  it('should be able to update multiple messages', async () => {
    let client = new PostgrestClient(rootUrl)

    let readRes = await client
      .from('messages')
      .neq('username', 'supabot')
      .select('*')

    let res = await client
      .from('messages')
      .not('username', 'eq', 'supabot')
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
      .neq('username', 'supabot')
      .delete()

    await client
      .from('users')
      .in('username', ['supabot2','supabot3'])
      .delete()

    assert.equal(204, res.status)
  })

  it('should be able to execute stored procedures', async () => {
    let client = new PostgrestClient(rootUrl)
    let {body} = await client
      .rpc('get_status', {name_param: 'leroyjenkins'})

    assert.equal(body, null)
  })

  it('should be able to chain filters', () =>{
    let client = new PostgrestClient(rootUrl)
    let rest =  client
      .from('messages')
      .eq('username', 'supabot')
      .neq('message', 'hello world')
      .gte('channel_id', 1)
      .select('*')
      
    let queries = rest._query

    assert.equal(queries.length, 3)
    assert.equal(queries[0], 'username=eq.supabot')
    assert.equal(queries[1], 'message=neq.hello world')
    assert.equal(queries[2], 'channel_id=gte.1')
  })
})
