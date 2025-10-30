import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

import { AbortController } from 'node-abort-controller'

const postgrest = new PostgrestClient<Database>('http://localhost:3000')

test('order', async () => {
  const res = await postgrest.from('users').select().order('username', { ascending: false })
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
        {
          "age_range": "[25,35)",
          "catchphrase": "'bat' 'rat'",
          "data": null,
          "status": "ONLINE",
          "username": "awailas",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('order on multiple columns', async () => {
  const res = await postgrest
    .from('messages')
    .select()
    .order('channel_id', { ascending: false })
    .order('username', { ascending: false })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
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
          "id": 2,
          "message": "Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.",
          "username": "supabot",
        },
        {
          "channel_id": 1,
          "data": null,
          "id": 1,
          "message": "Hello World 👋",
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('limit', async () => {
  const res = await postgrest.from('users').select().limit(1)
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
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('range', async () => {
  const res = await postgrest.from('users').select().range(1, 3)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
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
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('single', async () => {
  const res = await postgrest.from('users').select().limit(1).single()
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

test('single on insert', async () => {
  const res = await postgrest.from('users').insert({ username: 'foo' }).select().single()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "age_range": null,
        "catchphrase": null,
        "data": null,
        "status": "ONLINE",
        "username": "foo",
      },
      "error": null,
      "status": 201,
      "statusText": "Created",
    }
  `)

  await postgrest.from('users').delete().eq('username', 'foo')
})

test('maybeSingle', async () => {
  const res = await postgrest.from('users').select().eq('username', 'goldstein').maybeSingle()
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

test('maybeSingle', async () => {
  const res = await postgrest
    .from('users')
    .insert([{ username: 'a' }, { username: 'b' }])
    .select()
    .maybeSingle()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": null,
      "error": {
        "code": "PGRST116",
        "details": "The result contains 2 rows",
        "hint": null,
        "message": "JSON object requested, multiple (or no) rows returned",
      },
      "status": 406,
      "statusText": "Not Acceptable",
    }
  `)
})

test('select on insert', async () => {
  const res = await postgrest.from('users').insert({ username: 'foo' }).select('status')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "status": "ONLINE",
        },
      ],
      "error": null,
      "status": 201,
      "statusText": "Created",
    }
  `)

  await postgrest.from('users').delete().eq('username', 'foo')
})

test('select on rpc', async () => {
  const res = await postgrest
    .rpc('get_username_and_status', { name_param: 'supabot' })
    .select('status')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "status": "ONLINE",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('csv', async () => {
  const res = await postgrest.from('users').select().csv()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": "username,data,age_range,status,catchphrase
    supabot,,"[1,2)",ONLINE,"'cat' 'fat'"
    kiwicopple,,"[25,35)",OFFLINE,"'bat' 'cat'"
    awailas,,"[25,35)",ONLINE,"'bat' 'rat'"
    jsonuser,"{""foo"": {""bar"": {""nested"": ""value""}, ""baz"": ""string value""}}","[20,30)",ONLINE,"'json' 'test'"
    dragarcia,,"[20,30)",ONLINE,"'fat' 'rat'"",
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('geojson', async () => {
  const res = await postgrest.from('shops').select().geojson()
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": {
        "features": [
          {
            "geometry": {
              "coordinates": [
                -71.10044,
                42.373695,
              ],
              "type": "Point",
            },
            "properties": {
              "address": "1369 Cambridge St",
              "id": 1,
            },
            "type": "Feature",
          },
        ],
        "type": "FeatureCollection",
      },
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('abort signal', async () => {
  const ac = new AbortController() as globalThis.AbortController
  ac.abort()
  const res = await postgrest.from('users').select().abortSignal(ac.signal)
  expect(res).toMatchInlineSnapshot(
    {
      error: {
        code: expect.any(String),
        details: expect.any(String),
        message: expect.stringMatching(/AbortError/),
      },
    },
    `
    {
      "count": null,
      "data": null,
      "error": {
        "code": Any<String>,
        "details": Any<String>,
        "hint": "",
        "message": StringMatching /AbortError/,
      },
      "status": 0,
      "statusText": "",
    }
  `
  )
})

test('explain with json/text format', async () => {
  const res1 = await postgrest.from('users').select().explain({ format: 'json' })
  expect(res1).toMatchInlineSnapshot(
    {
      data: [
        {
          Plan: expect.any(Object),
        },
      ],
    },
    `
    {
      "count": null,
      "data": [
        {
          "Plan": Any<Object>,
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `
  )

  const res2 = await postgrest.from('users').select().explain()
  expect(res2.data).toMatch(/Aggregate  \(cost=.*/)
})

test('explain with options', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .explain({ verbose: true, settings: true, format: 'json' })
  expect(res).toMatchInlineSnapshot(
    {
      data: [
        {
          Plan: expect.any(Object),
          'Query Identifier': expect.any(Number),
        },
      ],
    },
    `
    {
      "count": null,
      "data": [
        {
          "Plan": Any<Object>,
          "Query Identifier": Any<Number>,
          "Settings": {
            "effective_cache_size": "128MB",
            "search_path": ""public", "extensions"",
          },
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `
  )
})

test('rollback insert/upsert', async () => {
  //No row at the start
  const res1 = await postgrest.from('users').select().eq('username', 'soedirgo')
  expect(res1.data).toMatchInlineSnapshot(`[]`)

  //Insert the row and rollback
  const res2 = await postgrest
    .from('users')
    .insert({
      age_range: '[20,25)',
      catchphrase: "'cat' 'fat'",
      data: null,
      status: 'ONLINE',
      username: 'soedirgo',
    })
    .select()
    .rollback()
    .single()
  expect(res2.data).toMatchInlineSnapshot(`
    {
      "age_range": "[20,25)",
      "catchphrase": "'cat' 'fat'",
      "data": null,
      "status": "ONLINE",
      "username": "soedirgo",
    }
  `)

  //Upsert the row and rollback
  const res3 = await postgrest
    .from('users')
    .upsert({
      age_range: '[20,25)',
      catchphrase: "'cat' 'fat'",
      data: null,
      status: 'ONLINE',
      username: 'soedirgo',
    })
    .select()
    .rollback()
    .single()
  expect(res3.data).toMatchInlineSnapshot(`
    {
      "age_range": "[20,25)",
      "catchphrase": "'cat' 'fat'",
      "data": null,
      "status": "ONLINE",
      "username": "soedirgo",
    }
  `)

  //No row at the end
  const res4 = await postgrest.from('users').select().eq('username', 'soedirgo')
  expect(res4.data).toMatchInlineSnapshot(`[]`)
})

test('rollback update/rpc', async () => {
  const res1 = await postgrest.from('users').select('status').eq('username', 'dragarcia').single()
  expect(res1.data).toMatchInlineSnapshot(`
    {
      "status": "ONLINE",
    }
  `)

  const res2 = await postgrest
    .from('users')
    .update({ status: 'OFFLINE' })
    .eq('username', 'dragarcia')
    .select('status')
    .rollback()
    .single()
  expect(res2.data).toMatchInlineSnapshot(`
    {
      "status": "OFFLINE",
    }
  `)

  const res3 = await postgrest.rpc('offline_user', { name_param: 'dragarcia' }).rollback()
  expect(res3.data).toMatchInlineSnapshot(`"OFFLINE"`)

  const res4 = await postgrest.from('users').select('status').eq('username', 'dragarcia').single()
  expect(res4.data).toMatchInlineSnapshot(`
    {
      "status": "ONLINE",
    }
  `)
})

test('rollback delete', async () => {
  const res1 = await postgrest.from('users').select('username').eq('username', 'dragarcia').single()
  expect(res1.data).toMatchInlineSnapshot(`
    {
      "username": "dragarcia",
    }
  `)

  const res2 = await postgrest
    .from('users')
    .delete()
    .eq('username', 'dragarcia')
    .select('username')
    .rollback()
    .single()
  expect(res2.data).toMatchInlineSnapshot(`
    {
      "username": "dragarcia",
    }
  `)

  const res3 = await postgrest.from('users').select('username').eq('username', 'dragarcia').single()
  expect(res3.data).toMatchInlineSnapshot(`
    {
      "username": "dragarcia",
    }
  `)
})
