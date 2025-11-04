import { PostgrestClient } from '../src/index'
import { CustomUserDataType, Database } from './types.override'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)

test('basic select table', async () => {
  const res = await postgrest.from('users').select()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[1,2)",
          "catchphrase": "'cat' 'fat'",
          "data": null,
          "status": "ONLINE",
          "username": "supabot",
        },
        {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'cat'",
          "data": null,
          "status": "OFFLINE",
          "username": "kiwicopple",
        },
        {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "awailas",
        },
        {
          "age_range": "[20,30)",
          "catchphrase": "'fat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "dragarcia",
        },
        {
          "age_range": "[20,30)",
          "catchphrase": "'json' 'test'",
          "data": {
            "foo": {
              "bar": {
                "nested": "value",
              },
              "baz": "string value",
            },
          },
          "status": "ONLINE",
          "username": "jsonuser",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('basic select returns types override', async () => {
  const res = await postgrest.from('users').select().returns<{ status: 'ONLINE' | 'OFFLINE' }>()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[1,2)",
          "catchphrase": "'cat' 'fat'",
          "data": null,
          "status": "ONLINE",
          "username": "supabot",
        },
        {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'cat'",
          "data": null,
          "status": "OFFLINE",
          "username": "kiwicopple",
        },
        {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "awailas",
        },
        {
          "age_range": "[20,30)",
          "catchphrase": "'fat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "dragarcia",
        },
        {
          "age_range": "[20,30)",
          "catchphrase": "'json' 'test'",
          "data": {
            "foo": {
              "bar": {
                "nested": "value",
              },
              "baz": "string value",
            },
          },
          "status": "ONLINE",
          "username": "jsonuser",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('basic select returns from builder', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .eq('username', 'supabot')
    .single()
    .returns<{ status: 'ONLINE' | 'OFFLINE' }>()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "age_range": "[1,2)",
        "catchphrase": "'cat' 'fat'",
        "data": null,
        "status": "ONLINE",
        "username": "supabot",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('basic select overrideTypes from builder', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .eq('username', 'supabot')
    .single()
    .overrideTypes<{ status: 'ONLINE' | 'OFFLINE' }>()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "age_range": "[1,2)",
        "catchphrase": "'cat' 'fat'",
        "data": null,
        "status": "ONLINE",
        "username": "supabot",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('basic select with maybeSingle yielding more than one result', async () => {
  const res = await postgrest.from('users').select().maybeSingle()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "PGRST116",
        "details": "Results contain 5 rows, application/vnd.pgrst.object+json requires 1 row",
        "hint": null,
        "message": "JSON object requested, multiple (or no) rows returned",
      },
      "status": 406,
      "statusText": "Not Acceptable",
    }
  `)
})

test('basic select with single yielding more than one result', async () => {
  const res = await postgrest.from('users').select().single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "PGRST116",
        "details": "The result contains 5 rows",
        "hint": null,
        "message": "JSON object requested, multiple (or no) rows returned",
      },
      "status": 406,
      "statusText": "Not Acceptable",
    }
  `)
})

test('basic select view', async () => {
  const res = await postgrest.from('updatable_view').select()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "non_updatable_column": 1,
          "username": "supabot",
        },
        {
          "non_updatable_column": 1,
          "username": "kiwicopple",
        },
        {
          "non_updatable_column": 1,
          "username": "awailas",
        },
        {
          "non_updatable_column": 1,
          "username": "dragarcia",
        },
        {
          "non_updatable_column": 1,
          "username": "jsonuser",
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
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": "ONLINE",
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('rpc returns void', async () => {
  const res = await postgrest.rpc('void_func')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": null,
      "status": 204,
      "statusText": "No Content",
    }
  `)
})

test('custom headers', async () => {
  const postgrest = new PostgrestClient<Database>(REST_URL, { headers: { apikey: 'foo' } })
  expect((postgrest.from('users').select() as any).headers.get('apikey')).toEqual('foo')
})

test('custom headers on a per-call basis', async () => {
  const postgrest1 = new PostgrestClient<Database>(REST_URL, { headers: { apikey: 'foo' } })
  const postgrest2 = postgrest1.rpc('void_func').setHeader('apikey', 'bar')
  // Original client object isn't affected
  expect((postgrest1.from('users').select() as any).headers.get('apikey')).toEqual('foo')
  // Derived client object uses new header value
  expect((postgrest2 as any).headers.get('apikey')).toEqual('bar')
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
    expect(postgrestFilterBuilder.headers.get('Prefer')).toContain('tx=rollback')
    expect(postgrestFilterBuilder.headers.get('Prefer')).toContain('return=')
  })
  test('update', async () => {
    const postgrest = new PostgrestClient<Database>(REST_URL, {
      headers: { Prefer: 'tx=rollback' },
    })
    const postgrestFilterBuilder = postgrest
      .from('users')
      .update({ username: 'dragarcia' })
      .select() as any
    expect(postgrestFilterBuilder.headers.get('Prefer')).toContain('tx=rollback')
    expect(postgrestFilterBuilder.headers.get('Prefer')).toContain('return=')
  })
  test('upsert', async () => {
    const postgrest = new PostgrestClient<Database>(REST_URL, {
      headers: { Prefer: 'tx=rollback' },
    })
    const postgrestFilterBuilder = postgrest
      .from('users')
      .upsert({ username: 'dragarcia' })
      .select() as any
    expect(postgrestFilterBuilder.headers.get('Prefer')).toContain('tx=rollback')
    expect(postgrestFilterBuilder.headers.get('Prefer')).toContain('return=')
  })
  test('delete', async () => {
    const postgrest = new PostgrestClient<Database>(REST_URL, {
      headers: { Prefer: 'tx=rollback' },
    })
    const postgrestFilterBuilder = postgrest.from('users').delete().select() as any
    expect(postgrestFilterBuilder.headers.get('Prefer')).toContain('tx=rollback')
    expect(postgrestFilterBuilder.headers.get('Prefer')).toContain('return=')
  })
})

test('switch schema', async () => {
  const postgrest = new PostgrestClient<Database, { PostgrestVersion: '12' }, 'personal'>(
    REST_URL,
    {
      schema: 'personal',
    }
  )
  const res = await postgrest.from('users').select()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[1,2)",
          "data": null,
          "status": "ONLINE",
          "username": "supabot",
        },
        {
          "age_range": "[25,35)",
          "data": null,
          "status": "OFFLINE",
          "username": "kiwicopple",
        },
        {
          "age_range": "[25,35)",
          "data": null,
          "status": "ONLINE",
          "username": "awailas",
        },
        {
          "age_range": "[20,30)",
          "data": null,
          "status": "ONLINE",
          "username": "dragarcia",
        },
        {
          "age_range": "[20,40)",
          "data": null,
          "status": "ONLINE",
          "username": "leroyjenkins",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('dynamic schema', async () => {
  const postgrest = new PostgrestClient<Database>(REST_URL)
  const res = await postgrest.schema('personal').from('users').select()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[1,2)",
          "data": null,
          "status": "ONLINE",
          "username": "supabot",
        },
        {
          "age_range": "[25,35)",
          "data": null,
          "status": "OFFLINE",
          "username": "kiwicopple",
        },
        {
          "age_range": "[25,35)",
          "data": null,
          "status": "ONLINE",
          "username": "awailas",
        },
        {
          "age_range": "[20,30)",
          "data": null,
          "status": "ONLINE",
          "username": "dragarcia",
        },
        {
          "age_range": "[20,40)",
          "data": null,
          "status": "ONLINE",
          "username": "leroyjenkins",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('on_conflict insert', async () => {
  const res = await postgrest
    .from('users')
    .upsert({ username: 'dragarcia' }, { onConflict: 'username' })
    .select()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[20,30)",
          "catchphrase": "'fat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "dragarcia",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('ignoreDuplicates upsert', async () => {
  const res = await postgrest
    .from('users')
    .upsert({ username: 'dragarcia' }, { onConflict: 'username', ignoreDuplicates: true })
    .select()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [],
      "error": null,
      "status": 201,
      "statusText": "Created",
    }
  `)
})

describe('basic insert, update, delete', () => {
  test('basic insert', async () => {
    let res = await postgrest
      .from('messages')
      .insert({ message: 'foo', username: 'supabot', channel_id: 1 })
      .select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 5,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 201,
        "statusText": "Created",
      }
    `)

    res = await postgrest.from('messages').select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 3,
            "message": "Some message on channel wihtout details",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel wihtout details",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 5,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
  })

  test('upsert', async () => {
    let res = await postgrest
      .from('messages')
      .upsert({ id: 3, message: 'foo', username: 'supabot', channel_id: 2 })
      .select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)

    res = await postgrest.from('messages').select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel wihtout details",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 5,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
  })

  test('bulk insert', async () => {
    let res = await postgrest
      .from('messages')
      .insert([
        { message: 'foo', username: 'supabot', channel_id: 1 },
        { message: 'foo', username: 'supabot', channel_id: 1 },
      ])
      .select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 6,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 7,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 201,
        "statusText": "Created",
      }
    `)

    res = await postgrest.from('messages').select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel wihtout details",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 5,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 6,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 7,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
  })

  test('insert quoted column', async () => {
    let res = await postgrest
      .from('cornercase')
      .insert([{ 'column whitespace': 'foo', id: 1 }])
      .select('"column whitespace", id ')

    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": null,
        "error": {
          "code": "23505",
          "details": "Key (id)=(1) already exists.",
          "hint": null,
          "message": "duplicate key value violates unique constraint "cornercase_pkey"",
        },
        "status": 409,
        "statusText": "Conflict",
      }
    `)
  })

  test('basic update', async () => {
    let res = await postgrest
      .from('messages')
      .update({ channel_id: 2 })
      .eq('message', 'foo')
      .select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 2,
            "data": null,
            "id": 5,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 6,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 7,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)

    res = await postgrest.from('messages').select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel wihtout details",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 5,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 6,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 7,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
  })

  test('basic delete', async () => {
    let res = await postgrest.from('messages').delete().eq('message', 'foo').select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 2,
            "data": null,
            "id": 5,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 6,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 7,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)

    res = await postgrest.from('messages').select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel wihtout details",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
  })
})

test('throwOnError throws errors instead of returning them', async () => {
  let isErrorCaught = false

  try {
    // @ts-expect-error Argument of type '"missing_table"' is not assignable to parameter
    await postgrest.from('missing_table').select().throwOnError()
  } catch (error) {
    expect(error).toMatchInlineSnapshot(
      `[PostgrestError: relation "public.missing_table" does not exist]`
    )
    isErrorCaught = true
  }

  expect(isErrorCaught).toBe(true)
})

test('throwOnError throws errors which include stack', async () => {
  try {
    // @ts-expect-error Argument of type '"does_not_exist"' is not assignable to parameter
    await postgrest.from('does_not_exist').select().throwOnError()
  } catch (err) {
    expect(err instanceof Error).toBe(true)
    expect((err as Error).stack).not.toBeUndefined()
  }
})

// test('throwOnError setting at the client level - query', async () => {
//   let isErrorCaught = false
//   const postgrest_ = new PostgrestClient<Database>(REST_URL, { throwOnError: true })

//   try {
//     // @ts-expect-error! missing table
//     await postgrest_.from('missing_table').select()
//   } catch (error) {
//     expect(error).toMatchInlineSnapshot()
//     isErrorCaught = true
//   }

//   expect(isErrorCaught).toBe(true)
// })

// test('throwOnError setting at the client level - rpc', async () => {
//   let isErrorCaught = false
//   const postgrest_ = new PostgrestClient<Database>(REST_URL, { throwOnError: true })

//   try {
//     // @ts-expect-error! missing function
//     await postgrest_.rpc('missing_fn').select()
//   } catch (error) {
//     expect(error).toMatchInlineSnapshot()
//     isErrorCaught = true
//   }

//   expect(isErrorCaught).toBe(true)
// })

// test('throwOnError can be disabled per call', async () => {
//   let isErrorCaught = false
//   const postgrest_ = new PostgrestClient<Database>(REST_URL, { throwOnError: true })
//   // @ts-expect-error! missing table
//   const { error } = await postgrest_.from('missing_table').select().throwOnError(false)

//   expect(error).toMatchInlineSnapshot()
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

test("don't mutate PostgrestClient.headers", async () => {
  await postgrest.from('users').select().limit(1).single()
  const { error } = await postgrest.from('users').select()
  expect(error).toMatchInlineSnapshot(`null`)
})

test('allow ordering on JSON column', async () => {
  const { data } = await postgrest
    .from('users')
    .select()
    .order('data->something' as any)
  expect(data).toMatchInlineSnapshot(`
    [
      {
        "age_range": "[1,2)",
        "catchphrase": "'cat' 'fat'",
        "data": null,
        "status": "ONLINE",
        "username": "supabot",
      },
      {
        "age_range": "[25,35)",
        "catchphrase": "'bat' 'cat'",
        "data": null,
        "status": "OFFLINE",
        "username": "kiwicopple",
      },
      {
        "age_range": "[25,35)",
        "catchphrase": "'bat' 'rat'",
        "data": null,
        "status": "ONLINE",
        "username": "awailas",
      },
      {
        "age_range": "[20,30)",
        "catchphrase": "'json' 'test'",
        "data": {
          "foo": {
            "bar": {
              "nested": "value",
            },
            "baz": "string value",
          },
        },
        "status": "ONLINE",
        "username": "jsonuser",
      },
      {
        "age_range": "[20,30)",
        "catchphrase": "'fat' 'rat'",
        "data": null,
        "status": "ONLINE",
        "username": "dragarcia",
      },
    ]
  `)
})

test('Prefer: return=minimal', async () => {
  const { data } = await postgrest.from('users').insert({ username: 'bar' })
  expect(data).toMatchInlineSnapshot(`null`)

  await postgrest.from('users').delete().eq('username', 'bar')
})

test('select with head:true', async () => {
  const res = await postgrest.from('users').select('*', { head: true })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('select with head:true, count:exact', async () => {
  const res = await postgrest.from('users').select('*', { head: true, count: 'exact' })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": 5,
      "data": null,
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('select with head:true, count:planned', async () => {
  const res = await postgrest.from('users').select('*', { head: true, count: 'planned' })
  expect(res).toMatchInlineSnapshot(
    {
      count: expect.any(Number),
    },
    `
    {
      "count": Any<Number>,
      "data": null,
      "error": null,
      "status": 206,
      "statusText": "Partial Content",
    }
  `
  )
})

test('select with head:true, count:estimated', async () => {
  const res = await postgrest.from('users').select('*', { head: true, count: 'estimated' })
  expect(res).toMatchInlineSnapshot(
    {
      count: expect.any(Number),
    },
    `
    {
      "count": Any<Number>,
      "data": null,
      "error": null,
      "status": 206,
      "statusText": "Partial Content",
    }
  `
  )
})

test('select with count:exact', async () => {
  const res = await postgrest.from('users').select('*', { count: 'exact' })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": 5,
      "data": [
        {
          "age_range": "[1,2)",
          "catchphrase": "'cat' 'fat'",
          "data": null,
          "status": "ONLINE",
          "username": "supabot",
        },
        {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'cat'",
          "data": null,
          "status": "OFFLINE",
          "username": "kiwicopple",
        },
        {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "awailas",
        },
        {
          "age_range": "[20,30)",
          "catchphrase": "'json' 'test'",
          "data": {
            "foo": {
              "bar": {
                "nested": "value",
              },
              "baz": "string value",
            },
          },
          "status": "ONLINE",
          "username": "jsonuser",
        },
        {
          "age_range": "[20,30)",
          "catchphrase": "'fat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "dragarcia",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test("rpc with count: 'exact'", async () => {
  const res = await postgrest.rpc('get_status', { name_param: 'supabot' }, { count: 'exact' })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": 1,
      "data": "ONLINE",
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('rpc with head:true, count:exact', async () => {
  const res = await postgrest.rpc(
    'get_status',
    { name_param: 'supabot' },
    { head: true, count: 'exact' }
  )
  expect(res).toMatchInlineSnapshot(`
    {
      "count": 1,
      "data": null,
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('rpc with get:true, count:exact', async () => {
  const res = await postgrest.rpc(
    'get_status',
    { name_param: 'supabot' },
    { get: true, count: 'exact' }
  )
  expect(res).toMatchInlineSnapshot(`
    {
      "count": 1,
      "data": "ONLINE",
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('rpc with get:true, optional param', async () => {
  const res = await postgrest.rpc(
    'function_with_optional_param',
    { param: undefined },
    { get: true }
  )
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": "",
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('rpc with get:true, array param', async () => {
  const res = await postgrest.rpc(
    'function_with_array_param',
    { param: ['00000000-0000-0000-0000-000000000000'] },
    { get: true }
  )
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": null,
      "status": 204,
      "statusText": "No Content",
    }
  `)
})

test('rpc with dynamic schema', async () => {
  const res = await postgrest.schema('personal').rpc('get_status', { name_param: 'kiwicopple' })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": "OFFLINE",
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

describe("insert, update, delete with count: 'exact'", () => {
  test("insert with count: 'exact'", async () => {
    let res = await postgrest
      .from('messages')
      .insert({ message: 'foo', username: 'supabot', channel_id: 1 }, { count: 'exact' })
      .select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": 1,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 8,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 201,
        "statusText": "Created",
      }
    `)

    res = await postgrest.from('messages').select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel wihtout details",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 8,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
  })

  test("upsert with count: 'exact'", async () => {
    let res = await postgrest
      .from('messages')
      .upsert({ id: 3, message: 'foo', username: 'supabot', channel_id: 2 }, { count: 'exact' })
      .select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": 1,
        "data": [
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 201,
        "statusText": "Created",
      }
    `)

    res = await postgrest.from('messages').select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel wihtout details",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 8,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
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
    expect(res).toMatchInlineSnapshot(`
      {
        "count": 2,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 9,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 10,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 201,
        "statusText": "Created",
      }
    `)

    res = await postgrest.from('messages').select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel wihtout details",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 8,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 9,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 1,
            "data": null,
            "id": 10,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
  })

  test('bulk insert with column defaults', async () => {
    let res = await postgrest
      .from('channels')
      .insert([{ id: 100 }, { slug: 'test-slug' }], { defaultToNull: false })
      .select()
      .rollback()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "data": null,
            "id": 100,
            "slug": null,
          },
          {
            "data": null,
            "id": 5,
            "slug": "test-slug",
          },
        ],
        "error": null,
        "status": 201,
        "statusText": "Created",
      }
    `)
  })

  test('bulk upsert with column defaults', async () => {
    let res = await postgrest
      .from('channels')
      .upsert([{ id: 1 }, { slug: 'test-slug' }], { defaultToNull: false })
      .select()
      .rollback()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "data": null,
            "id": 1,
            "slug": null,
          },
          {
            "data": null,
            "id": 7,
            "slug": "test-slug",
          },
        ],
        "error": null,
        "status": 201,
        "statusText": "Created",
      }
    `)
  })

  test("update with count: 'exact'", async () => {
    let res = await postgrest
      .from('messages')
      .update({ channel_id: 2 }, { count: 'exact' })
      .eq('message', 'foo')
      .select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": 4,
        "data": [
          {
            "channel_id": 2,
            "data": null,
            "id": 8,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 9,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 10,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)

    res = await postgrest.from('messages').select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel wihtout details",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 8,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 9,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 10,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
  })

  test("basic delete count: 'exact'", async () => {
    let res = await postgrest
      .from('messages')
      .delete({ count: 'exact' })
      .eq('message', 'foo')
      .select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": 4,
        "data": [
          {
            "channel_id": 2,
            "data": null,
            "id": 8,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 3,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 9,
            "message": "foo",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 10,
            "message": "foo",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)

    res = await postgrest.from('messages').select()
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": [
          {
            "channel_id": 1,
            "data": null,
            "id": 1,
            "message": "Hello World 👋",
            "username": "supabot",
          },
          {
            "channel_id": 2,
            "data": null,
            "id": 2,
            "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
            "username": "supabot",
          },
          {
            "channel_id": 3,
            "data": null,
            "id": 4,
            "message": "Some message on channel wihtout details",
            "username": "supabot",
          },
        ],
        "error": null,
        "status": 200,
        "statusText": "OK",
      }
    `)
  })
})

test('insert includes columns param', async () => {
  const client = postgrest.from('users').insert([{ foo: 1 }, { bar: 2 }] as any)
  expect((client as any).url.searchParams.get('columns')).toMatchInlineSnapshot(`""foo","bar""`)
})

test('insert w/ empty body has no columns param', async () => {
  const client = postgrest.from('users').insert([{}, {}] as any)
  expect((client as any).url.searchParams.has('columns')).toBeFalsy()
})

test('select with no match', async () => {
  const res = await postgrest.from('users').select().eq('username', 'missing')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('update with no match - return=minimal', async () => {
  const res = await postgrest
    .from('users')
    .update({ data: '' as unknown as CustomUserDataType })
    .eq('username', 'missing')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": null,
      "status": 204,
      "statusText": "No Content",
    }
  `)
})

test('update with no match - return=representation', async () => {
  const res = await postgrest
    .from('users')
    .update({ data: '' as unknown as CustomUserDataType })
    .eq('username', 'missing')
    .select()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('!left join on one to one relation', async () => {
  const res = await postgrest.from('channel_details').select('channels!left(id)').limit(1).single()
  expect(Array.isArray(res.data?.channels)).toBe(false)
  // TODO: This should not be nullable
  expect(res.data?.channels?.id).not.toBeNull()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "channels": {
          "id": 1,
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('!left join on one to many relation', async () => {
  const res = await postgrest.from('users').select('messages!left(username)').limit(1).single()
  expect(Array.isArray(res.data?.messages)).toBe(true)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "messages": [
          {
            "username": "supabot",
          },
          {
            "username": "supabot",
          },
          {
            "username": "supabot",
          },
        ],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('!left join on one to 0-1 non-empty relation', async () => {
  const res = await postgrest
    .from('users')
    .select('user_profiles!left(username)')
    .eq('username', 'supabot')
    .limit(1)
    .single()
  expect(Array.isArray(res.data?.user_profiles)).toBe(true)
  expect(res.data?.user_profiles[0].username).not.toBeNull()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "user_profiles": [
          {
            "username": "supabot",
          },
        ],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('!left join on zero to one with null relation', async () => {
  const res = await postgrest
    .from('user_profiles')
    .select('*,users!left(*)')
    .eq('id', 2)
    .limit(1)
    .single()
  expect(Array.isArray(res.data?.users)).toBe(false)
  expect(res.data?.users).toBeNull()

  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "id": 2,
        "username": null,
        "users": null,
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('!left join on zero to one with valid relation', async () => {
  const res = await postgrest
    .from('user_profiles')
    .select('*,users!left(status)')
    .eq('id', 1)
    .limit(1)
    .single()
  expect(Array.isArray(res.data?.users)).toBe(false)
  // TODO: This should be nullable indeed
  expect(res.data?.users?.status).not.toBeNull()

  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "id": 1,
        "username": "supabot",
        "users": {
          "status": "ONLINE",
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('!left join on zero to one empty relation', async () => {
  const res = await postgrest
    .from('users')
    .select('user_profiles!left(username)')
    .eq('username', 'dragarcia')
    .limit(1)
    .single()
  expect(Array.isArray(res.data?.user_profiles)).toBe(true)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "user_profiles": [],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('join on 1-M relation', async () => {
  // TODO: This won't raise the proper types for "first_friend_of,..." results
  const res = await postgrest
    .from('users')
    .select(
      `first_friend_of:best_friends_first_user_fkey(*),
      second_friend_of:best_friends_second_user_fkey(*),
      third_wheel_of:best_friends_third_wheel_fkey(*)`
    )
    .eq('username', 'supabot')
    .limit(1)
    .single()
  expect(Array.isArray(res.data?.first_friend_of)).toBe(true)
  expect(Array.isArray(res.data?.second_friend_of)).toBe(true)
  expect(Array.isArray(res.data?.third_wheel_of)).toBe(true)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "first_friend_of": [
          {
            "first_user": "supabot",
            "id": 1,
            "second_user": "kiwicopple",
            "third_wheel": "awailas",
          },
          {
            "first_user": "supabot",
            "id": 2,
            "second_user": "awailas",
            "third_wheel": null,
          },
        ],
        "second_friend_of": [],
        "third_wheel_of": [],
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('join on 1-1 relation with nullables', async () => {
  const res = await postgrest
    .from('best_friends')
    .select(
      'first_user:users!best_friends_first_user_fkey(*), second_user:users!best_friends_second_user_fkey(*), third_wheel:users!best_friends_third_wheel_fkey(*)'
    )
    .order('id')
    .limit(1)
    .single()
  expect(Array.isArray(res.data?.first_user)).toBe(false)
  expect(Array.isArray(res.data?.second_user)).toBe(false)
  expect(Array.isArray(res.data?.third_wheel)).toBe(false)
  // TODO: This should return null only if the column is actually nullable thoses are not
  expect(res.data?.first_user?.username).not.toBeNull()
  expect(res.data?.second_user?.username).not.toBeNull()
  // TODO: This column however is nullable
  expect(res.data?.third_wheel?.username).not.toBeNull()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "first_user": {
          "age_range": "[1,2)",
          "catchphrase": "'cat' 'fat'",
          "data": null,
          "status": "ONLINE",
          "username": "supabot",
        },
        "second_user": {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'cat'",
          "data": null,
          "status": "OFFLINE",
          "username": "kiwicopple",
        },
        "third_wheel": {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "awailas",
        },
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('custom fetch function', async () => {
  const customFetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('[]'),
    })
  )

  const postgrestWithCustomFetch = new PostgrestClient<Database>(REST_URL, {
    fetch: customFetch,
  })

  await postgrestWithCustomFetch.from('users').select()

  expect(customFetch).toHaveBeenCalledWith(
    expect.stringContaining(REST_URL),
    expect.objectContaining({
      method: 'GET',
      headers: expect.any(Object),
    })
  )
})

test('uses native fetch when no custom fetch provided', async () => {
  // Spy on the global fetch to verify it's being called
  const fetchSpy = jest.spyOn(globalThis, 'fetch')

  const postgrestClient = new PostgrestClient<Database>(REST_URL)
  const result = await postgrestClient.from('users').select()

  // Verify native fetch was called
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining(REST_URL),
    expect.objectContaining({
      method: 'GET',
      headers: expect.any(Headers),
    })
  )

  // Verify the query succeeded
  expect(result.error).toBeNull()
  expect(result.data).toBeDefined()
  expect(Array.isArray(result.data)).toBe(true)
  expect(result.status).toBe(200)

  fetchSpy.mockRestore()
})

test('handles array error with 404 status', async () => {
  // Mock the fetch response to return an array error with 404
  const customFetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('[]'),
    })
  )

  const postgrestWithCustomFetch = new PostgrestClient<Database>(REST_URL, {
    fetch: customFetch,
  })

  const res = await postgrestWithCustomFetch.from('users').select()

  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('handles empty body with 404 status', async () => {
  // Mock the fetch response to return an empty body with 404
  const customFetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve(''),
    })
  )

  const postgrestWithCustomFetch = new PostgrestClient<Database>(REST_URL, {
    fetch: customFetch,
  })

  const res = await postgrestWithCustomFetch.from('users').select()

  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": null,
      "status": 204,
      "statusText": "No Content",
    }
  `)
})

test('maybeSingle handles zero rows error', async () => {
  const customFetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status: 406,
      statusText: 'Not Acceptable',
      text: () =>
        Promise.resolve(
          JSON.stringify({
            code: 'PGRST116',
            details: '0 rows',
            hint: null,
            message: 'JSON object requested, multiple (or no) rows returned',
          })
        ),
    })
  )

  const postgrestWithCustomFetch = new PostgrestClient<Database>(REST_URL, {
    fetch: customFetch,
  })

  const res = await postgrestWithCustomFetch.from('users').select().maybeSingle()

  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})
