import { PostgrestClient } from '../src/index'
import { Database } from './types'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)

test('basic select table', async () => {
  const res = await postgrest.from('users').select()
  expect(res).toMatchSnapshot()
})

test('basic select view', async () => {
  const res = await postgrest.from('updatable_view').select()
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Array [
        Object {
          "non_updatable_column": 1,
          "username": "supabot",
        },
        Object {
          "non_updatable_column": 1,
          "username": "kiwicopple",
        },
        Object {
          "non_updatable_column": 1,
          "username": "awailas",
        },
        Object {
          "non_updatable_column": 1,
          "username": "dragarcia",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('rpc', async () => {
  const res = await postgrest.rpc('get_status', { name_param: 'supabot' })
  expect(res).toMatchSnapshot()
})

test('rpc returns void', async () => {
  const res = await postgrest.rpc('void_func')
  expect(res).toMatchSnapshot()
})

test('custom headers', async () => {
  const postgrest = new PostgrestClient<Database>(REST_URL, { headers: { apikey: 'foo' } })
  expect((postgrest.from('users').select() as any).headers['apikey']).toEqual('foo')
})

describe('custom prefer headers with ', () => {
  test('insert', async () => {
    const postgrest = new PostgrestClient<Database>(REST_URL, {
      headers: { Prefer: 'tx=rollback' },
    })
    const postgrestFilterBuilder = postgrest
      .from('users')
      .insert({ username: 'dragarcia' })
      .select() as any
    expect(postgrestFilterBuilder.headers['Prefer']).toContain('tx=rollback')
    expect(postgrestFilterBuilder.headers['Prefer']).toContain('return=')
  })
  test('update', async () => {
    const postgrest = new PostgrestClient<Database>(REST_URL, {
      headers: { Prefer: 'tx=rollback' },
    })
    const postgrestFilterBuilder = postgrest
      .from('users')
      .update({ username: 'dragarcia' })
      .select() as any
    expect(postgrestFilterBuilder.headers['Prefer']).toContain('tx=rollback')
    expect(postgrestFilterBuilder.headers['Prefer']).toContain('return=')
  })
  test('upsert', async () => {
    const postgrest = new PostgrestClient<Database>(REST_URL, {
      headers: { Prefer: 'tx=rollback' },
    })
    const postgrestFilterBuilder = postgrest
      .from('users')
      .upsert({ username: 'dragarcia' })
      .select() as any
    expect(postgrestFilterBuilder.headers['Prefer']).toContain('tx=rollback')
    expect(postgrestFilterBuilder.headers['Prefer']).toContain('return=')
  })
  test('delete', async () => {
    const postgrest = new PostgrestClient<Database>(REST_URL, {
      headers: { Prefer: 'tx=rollback' },
    })
    const postgrestFilterBuilder = postgrest.from('users').delete().select() as any
    expect(postgrestFilterBuilder.headers['Prefer']).toContain('tx=rollback')
    expect(postgrestFilterBuilder.headers['Prefer']).toContain('return=')
  })
})

test('switch schema', async () => {
  const postgrest = new PostgrestClient<Database, 'personal'>(REST_URL, { schema: 'personal' })
  const res = await postgrest.from('users').select()
  expect(res).toMatchSnapshot()
})

test('on_conflict insert', async () => {
  const res = await postgrest
    .from('users')
    .upsert({ username: 'dragarcia' }, { onConflict: 'username' })
    .select()
  expect(res).toMatchSnapshot()
})

test('ignoreDuplicates upsert', async () => {
  const res = await postgrest
    .from('users')
    .upsert({ username: 'dragarcia' }, { onConflict: 'username', ignoreDuplicates: true })
    .select()
  expect(res).toMatchSnapshot()
})

describe('basic insert, update, delete', () => {
  test('basic insert', async () => {
    let res = await postgrest
      .from('messages')
      .insert({ message: 'foo', username: 'supabot', channel_id: 1 })
      .select()
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test('upsert', async () => {
    let res = await postgrest
      .from('messages')
      .upsert({ id: 3, message: 'foo', username: 'supabot', channel_id: 2 })
      .select()
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test('bulk insert', async () => {
    let res = await postgrest
      .from('messages')
      .insert([
        { message: 'foo', username: 'supabot', channel_id: 1 },
        { message: 'foo', username: 'supabot', channel_id: 1 },
      ])
      .select()
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test('basic update', async () => {
    let res = await postgrest
      .from('messages')
      .update({ channel_id: 2 })
      .eq('message', 'foo')
      .select()
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test('basic delete', async () => {
    let res = await postgrest.from('messages').delete().eq('message', 'foo').select()
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })
})

test('table invalid type', async () => {
  // @ts-expect-error table invalid type
  postgrest.from(42)
})

test('throwOnError throws errors instead of returning them', async () => {
  let isErrorCaught = false

  try {
    await postgrest.from('missing_table').select().throwOnError()
  } catch (error) {
    expect(error).toMatchSnapshot()
    isErrorCaught = true
  }

  expect(isErrorCaught).toBe(true)
})

// test('throwOnError setting at the client level - query', async () => {
//   let isErrorCaught = false
//   const postgrest_ = new PostgrestClient<Database>(REST_URL, { throwOnError: true })

//   try {
//     // @ts-expect-error missing table
//     await postgrest_.from('missing_table').select()
//   } catch (error) {
//     expect(error).toMatchSnapshot()
//     isErrorCaught = true
//   }

//   expect(isErrorCaught).toBe(true)
// })

// test('throwOnError setting at the client level - rpc', async () => {
//   let isErrorCaught = false
//   const postgrest_ = new PostgrestClient<Database>(REST_URL, { throwOnError: true })

//   try {
//     // @ts-expect-error missing function
//     await postgrest_.rpc('missing_fn').select()
//   } catch (error) {
//     expect(error).toMatchSnapshot()
//     isErrorCaught = true
//   }

//   expect(isErrorCaught).toBe(true)
// })

// test('throwOnError can be disabled per call', async () => {
//   let isErrorCaught = false
//   const postgrest_ = new PostgrestClient<Database>(REST_URL, { throwOnError: true })
//   // @ts-expect-error missing table
//   const { error } = await postgrest_.from('missing_table').select().throwOnError(false)

//   expect(error).toMatchSnapshot()
//   expect(isErrorCaught).toBe(false)
// })

test('connection error w/o throwing', async () => {
  const postgrest = new PostgrestClient<Database>('http://foo.invalid')
  let isErrorCaught = false
  await postgrest
    .from('users')
    .select()
    .then(undefined, () => {
      isErrorCaught = true
    })
  expect(isErrorCaught).toBe(false)
})

test('connection error w/ throwOnError', async () => {
  const postgrest = new PostgrestClient<Database>('http://foo.invalid')
  let isErrorCaught = false
  await postgrest
    .from('users')
    .select()
    .throwOnError()
    .then(undefined, () => {
      isErrorCaught = true
    })
  expect(isErrorCaught).toBe(true)
})

test('maybeSingle w/ throwOnError', async () => {
  let passes = true
  await postgrest
    .from('messages')
    .select()
    .eq('message', 'i do not exist')
    .throwOnError()
    .maybeSingle()
    .then(undefined, () => {
      passes = false
    })
  expect(passes).toEqual(true)
})

test('custom type', async () => {
  const { data: users, error } = await postgrest.from('users').select().eq('username', 'supabot')

  if (error) {
    throw new Error(error.message)
  }

  const user = users[0]
  // Autocomplete should show properties of user after '.'
  user?.username
})

test("don't mutate PostgrestClient.headers", async () => {
  await postgrest.from('users').select().limit(1).single()
  const { error } = await postgrest.from('users').select()
  expect(error).toMatchSnapshot()
})

test('allow ordering on JSON column', async () => {
  const { data } = await postgrest
    .from('users')
    .select()
    .order('data->something' as any)
  expect(data).toMatchSnapshot()
})

test('Prefer: return=minimal', async () => {
  const { data } = await postgrest.from('users').insert({ username: 'bar' })
  expect(data).toMatchSnapshot()

  await postgrest.from('users').delete().eq('username', 'bar')
})

test('select with head:true', async () => {
  const res = await postgrest.from('users').select('*', { head: true })
  expect(res).toMatchSnapshot()
})

test('select with head:true, count:exact', async () => {
  const res = await postgrest.from('users').select('*', { head: true, count: 'exact' })
  expect(res).toMatchSnapshot()
})

test('select with head:true, count:planned', async () => {
  const res = await postgrest.from('users').select('*', { head: true, count: 'planned' })
  expect(res).toMatchSnapshot({
    count: expect.any(Number),
  })
})

test('select with head:true, count:estimated', async () => {
  const res = await postgrest.from('users').select('*', { head: true, count: 'estimated' })
  expect(res).toMatchSnapshot({
    count: expect.any(Number),
  })
})

test('select with count:exact', async () => {
  const res = await postgrest.from('users').select('*', { count: 'exact' })
  expect(res).toMatchSnapshot()
})

test("rpc with count: 'exact'", async () => {
  const res = await postgrest.rpc('get_status', { name_param: 'supabot' }, { count: 'exact' })
  expect(res).toMatchSnapshot()
})

test('rpc with head:true, count:exact', async () => {
  const res = await postgrest.rpc(
    'get_status',
    { name_param: 'supabot' },
    { head: true, count: 'exact' }
  )
  expect(res).toMatchSnapshot()
})

describe("insert, update, delete with count: 'exact'", () => {
  test("insert with count: 'exact'", async () => {
    let res = await postgrest
      .from('messages')
      .insert({ message: 'foo', username: 'supabot', channel_id: 1 }, { count: 'exact' })
      .select()
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test("upsert with count: 'exact'", async () => {
    let res = await postgrest
      .from('messages')
      .upsert({ id: 3, message: 'foo', username: 'supabot', channel_id: 2 }, { count: 'exact' })
      .select()
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test("bulk insert with count: 'exact'", async () => {
    let res = await postgrest
      .from('messages')
      .insert(
        [
          { message: 'foo', username: 'supabot', channel_id: 1 },
          { message: 'foo', username: 'supabot', channel_id: 1 },
        ],
        { count: 'exact' }
      )
      .select()
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test("update with count: 'exact'", async () => {
    let res = await postgrest
      .from('messages')
      .update({ channel_id: 2 }, { count: 'exact' })
      .eq('message', 'foo')
      .select()
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })

  test("basic delete count: 'exact'", async () => {
    let res = await postgrest
      .from('messages')
      .delete({ count: 'exact' })
      .eq('message', 'foo')
      .select()
    expect(res).toMatchSnapshot()

    res = await postgrest.from('messages').select()
    expect(res).toMatchSnapshot()
  })
})

test('insert includes columns param', async () => {
  const client = postgrest.from('users').insert([{ foo: 1 }, { bar: 2 }] as any)
  expect((client as any).url.searchParams.get('columns')).toMatchInlineSnapshot(
    `"\\"foo\\",\\"bar\\""`
  )
})

test('insert w/ empty body has no columns param', async () => {
  const client = postgrest.from('users').insert([{}, {}] as any)
  expect((client as any).url.searchParams.has('columns')).toBeFalsy()
})

test('select with no match', async () => {
  const res = await postgrest.from('users').select().eq('username', 'missing')
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": null,
      "data": Array [],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('cannot update non-updatable views', () => {
  // @ts-expect-error TS2345
  postgrest.from('non_updatable_view').update({})
})

test('cannot update non-updatable columns', () => {
  // @ts-expect-error TS2322
  postgrest.from('updatable_view').update({ non_updatable_column: 0 })
})
