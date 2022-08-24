import { PostgrestClient } from '../src/index'
import { Database } from './types'

import { AbortController } from 'node-abort-controller'

const postgrest = new PostgrestClient<Database>('http://localhost:3000')

test('order', async () => {
  const res = await postgrest.from('users').select().order('username', { ascending: false })
  expect(res).toMatchSnapshot()
})

test('order on multiple columns', async () => {
  const res = await postgrest
    .from('messages')
    .select()
    .order('channel_id', { ascending: false })
    .order('username', { ascending: false })
  expect(res).toMatchSnapshot()
})

test('limit', async () => {
  const res = await postgrest.from('users').select().limit(1)
  expect(res).toMatchSnapshot()
})

test('range', async () => {
  const res = await postgrest.from('users').select().range(1, 3)
  expect(res).toMatchSnapshot()
})

test('single', async () => {
  const res = await postgrest.from('users').select().limit(1).single()
  expect(res).toMatchSnapshot()
})

test('single on insert', async () => {
  const res = await postgrest.from('users').insert({ username: 'foo' }).select().single()
  expect(res).toMatchSnapshot()

  await postgrest.from('users').delete().eq('username', 'foo')
})

test('maybeSingle', async () => {
  const res = await postgrest.from('users').select().eq('username', 'goldstein').maybeSingle()
  expect(res).toMatchSnapshot()
})

test('select on insert', async () => {
  const res = await postgrest.from('users').insert({ username: 'foo' }).select('status')
  expect(res).toMatchSnapshot()

  await postgrest.from('users').delete().eq('username', 'foo')
})

test('select on rpc', async () => {
  const res = await postgrest
    .rpc('get_username_and_status', { name_param: 'supabot' })
    .select('status')
  expect(res).toMatchSnapshot()
})

test('csv', async () => {
  const res = await postgrest.from('users').select().csv()
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": undefined,
      "data": "username,data,age_range,status,catchphrase
    supabot,,\\"[1,2)\\",ONLINE,\\"'cat' 'fat'\\"
    kiwicopple,,\\"[25,35)\\",OFFLINE,\\"'bat' 'cat'\\"
    awailas,,\\"[25,35)\\",ONLINE,\\"'bat' 'rat'\\"
    dragarcia,,\\"[20,30)\\",ONLINE,\\"'fat' 'rat'\\"",
      "error": undefined,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('abort signal', async () => {
  const ac = new AbortController()
  ac.abort()
  const res = await postgrest.from('users').select().abortSignal(ac.signal)
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": undefined,
      "data": undefined,
      "error": Object {
        "code": "",
        "details": "",
        "hint": "",
        "message": "FetchError: The user aborted a request.",
      },
      "status": 400,
      "statusText": "Bad Request",
    }
  `)
})

// test('geojson', async () => {
//   const res = await postgrest.from('shops').select().geojson()
//   expect(res).toMatchInlineSnapshot()
// })

test('explain with json/text format', async () => {
  const res1 = await postgrest.from('users').select().explain({ format: 'json' })
  expect(res1).toMatchInlineSnapshot(`
    Object {
      "count": undefined,
      "data": Array [
        Object {
          "Plan": Object {
            "Async Capable": false,
            "Node Type": "Aggregate",
            "Parallel Aware": false,
            "Partial Mode": "Simple",
            "Plan Rows": 1,
            "Plan Width": 112,
            "Plans": Array [
              Object {
                "Alias": "users",
                "Async Capable": false,
                "Node Type": "Seq Scan",
                "Parallel Aware": false,
                "Parent Relationship": "Outer",
                "Plan Rows": 510,
                "Plan Width": 132,
                "Relation Name": "users",
                "Startup Cost": 0,
                "Total Cost": 15.1,
              },
            ],
            "Startup Cost": 17.65,
            "Strategy": "Plain",
            "Total Cost": 17.68,
          },
        },
      ],
      "error": undefined,
      "status": 200,
      "statusText": "OK",
    }
  `)

  const res2 = await postgrest.from('users').select().explain()
  expect(res2.data).toMatch(
    `Aggregate  (cost=17.65..17.68 rows=1 width=112)
  ->  Seq Scan on users  (cost=0.00..15.10 rows=510 width=132)
`
  )
})

test('explain with options', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .explain({ verbose: true, settings: true, format: 'json' })
  expect(res).toMatchInlineSnapshot(`
    Object {
      "count": undefined,
      "data": Array [
        Object {
          "Plan": Object {
            "Async Capable": false,
            "Node Type": "Aggregate",
            "Output": Array [
              "NULL::bigint",
              "count(ROW(users.username, users.data, users.age_range, users.status, users.catchphrase))",
              "(COALESCE(json_agg(ROW(users.username, users.data, users.age_range, users.status, users.catchphrase)), '[]'::json))::character varying",
              "NULLIF(current_setting('response.headers'::text, true), ''::text)",
              "NULLIF(current_setting('response.status'::text, true), ''::text)",
            ],
            "Parallel Aware": false,
            "Partial Mode": "Simple",
            "Plan Rows": 1,
            "Plan Width": 112,
            "Plans": Array [
              Object {
                "Alias": "users",
                "Async Capable": false,
                "Node Type": "Seq Scan",
                "Output": Array [
                  "users.username",
                  "users.data",
                  "users.age_range",
                  "users.status",
                  "users.catchphrase",
                ],
                "Parallel Aware": false,
                "Parent Relationship": "Outer",
                "Plan Rows": 510,
                "Plan Width": 132,
                "Relation Name": "users",
                "Schema": "public",
                "Startup Cost": 0,
                "Total Cost": 15.1,
              },
            ],
            "Startup Cost": 17.65,
            "Strategy": "Plain",
            "Total Cost": 17.68,
          },
          "Query Identifier": -8888327821402777000,
          "Settings": Object {
            "effective_cache_size": "128MB",
            "search_path": "\\"public\\", \\"extensions\\"",
          },
        },
      ],
      "error": undefined,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('rollback insert/upsert', async () => {
  //No row at the start
  const res1 = await postgrest.from('users').select().eq('username', 'soedirgo')
  expect(res1.data).toMatchInlineSnapshot(`Array []`)

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
    Object {
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
    Object {
      "age_range": "[20,25)",
      "catchphrase": "'cat' 'fat'",
      "data": null,
      "status": "ONLINE",
      "username": "soedirgo",
    }
  `)

  //No row at the end
  const res4 = await postgrest.from('users').select().eq('username', 'soedirgo')
  expect(res4.data).toMatchInlineSnapshot(`Array []`)
})

test('rollback update/rpc', async () => {
  const res1 = await postgrest.from('users').select('status').eq('username', 'dragarcia').single()
  expect(res1.data).toMatchInlineSnapshot(`
    Object {
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
    Object {
      "status": "OFFLINE",
    }
  `)

  const res3 = await postgrest.rpc('offline_user', { name_param: 'dragarcia' }).rollback()
  expect(res3.data).toMatchInlineSnapshot(`"OFFLINE"`)

  const res4 = await postgrest.from('users').select('status').eq('username', 'dragarcia').single()
  expect(res4.data).toMatchInlineSnapshot(`
    Object {
      "status": "ONLINE",
    }
  `)
})

test('rollback delete', async () => {
  const res1 = await postgrest.from('users').select('username').eq('username', 'dragarcia').single()
  expect(res1.data).toMatchInlineSnapshot(`
    Object {
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
    Object {
      "username": "dragarcia",
    }
  `)

  const res3 = await postgrest.from('users').select('username').eq('username', 'dragarcia').single()
  expect(res3.data).toMatchInlineSnapshot(`
    Object {
      "username": "dragarcia",
    }
  `)
})
