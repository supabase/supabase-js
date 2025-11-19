import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

const postgrest = new PostgrestClient<Database>('http://localhost:3000')

test('not', async () => {
  const res = await postgrest.from('users').select('status').not('status', 'eq', 'OFFLINE')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "status": "ONLINE",
        },
        {
          "status": "ONLINE",
        },
        {
          "status": "ONLINE",
        },
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

test('or', async () => {
  const res = await postgrest
    .from('users')
    .select('status, username')
    .or('status.eq.OFFLINE,username.eq.supabot')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "status": "ONLINE",
          "username": "supabot",
        },
        {
          "status": "OFFLINE",
          "username": "kiwicopple",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('eq', async () => {
  const res = await postgrest.from('users').select('username').eq('username', 'supabot')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('neq', async () => {
  const res = await postgrest.from('users').select('username').neq('username', 'supabot')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "kiwicopple",
        },
        {
          "username": "awailas",
        },
        {
          "username": "jsonuser",
        },
        {
          "username": "dragarcia",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('gt', async () => {
  const res = await postgrest.from('messages').select('id').gt('id', 1)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "id": 2,
        },
        {
          "id": 4,
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('gte', async () => {
  const res = await postgrest.from('messages').select('id').gte('id', 1)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "id": 1,
        },
        {
          "id": 2,
        },
        {
          "id": 4,
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('lt', async () => {
  const res = await postgrest.from('messages').select('id').lt('id', 2)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "id": 1,
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('lte', async () => {
  const res = await postgrest.from('messages').select('id').lte('id', 2)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "id": 1,
        },
        {
          "id": 2,
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('like', async () => {
  const res = await postgrest.from('users').select('username').like('username', '%supa%')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('likeAllOf', async () => {
  const res = await postgrest
    .from('users')
    .select('username')
    .likeAllOf('username', ['%supa%', '%bot%'])
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('likeAnyOf', async () => {
  const res = await postgrest
    .from('users')
    .select('username')
    .likeAnyOf('username', ['%supa%', '%kiwi%'])
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "supabot",
        },
        {
          "username": "kiwicopple",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('ilike', async () => {
  const res = await postgrest.from('users').select('username').ilike('username', '%SUPA%')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('ilikeAllOf', async () => {
  const res = await postgrest
    .from('users')
    .select('username')
    .ilikeAllOf('username', ['%SUPA%', '%bot%'])
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('ilikeAnyOf', async () => {
  const res = await postgrest
    .from('users')
    .select('username')
    .ilikeAnyOf('username', ['%supa%', '%KIWI%'])
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "supabot",
        },
        {
          "username": "kiwicopple",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('is', async () => {
  const res = await postgrest.from('users').select('data').is('data', null)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "data": null,
        },
        {
          "data": null,
        },
        {
          "data": null,
        },
        {
          "data": null,
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('in', async () => {
  const statuses = ['ONLINE', 'OFFLINE'] as const
  const res = await postgrest.from('users').select('status').in('status', statuses)
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "status": "ONLINE",
        },
        {
          "status": "OFFLINE",
        },
        {
          "status": "ONLINE",
        },
        {
          "status": "ONLINE",
        },
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

test('contains', async () => {
  const res = await postgrest.from('users').select('age_range').contains('age_range', '[1,2)')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[1,2)",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('contains with json', async () => {
  const res = await postgrest
    .from('users')
    .select('data')
    .contains('data', { foo: { baz: 'string value' } })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "data": {
            "foo": {
              "bar": {
                "nested": "value",
              },
              "baz": "string value",
            },
          },
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('contains with array', async () => {
  const res = await postgrest
    .from('cornercase')
    .select('array_column')
    .contains('array_column', ['test'])
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "array_column": [
            "test",
            "one",
          ],
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('containedBy', async () => {
  const res = await postgrest.from('users').select('age_range').containedBy('age_range', '[1,2)')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[1,2)",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('containedBy with json', async () => {
  const res = await postgrest
    .from('users')
    .select('data')
    .containedBy('data', { foo: { baz: 'string value' } })
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

test('containedBy with array', async () => {
  const res = await postgrest
    .from('cornercase')
    .select('array_column')
    .containedBy('array_column', ['test'])
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

test('rangeLt', async () => {
  const res = await postgrest.from('users').select('age_range').rangeLt('age_range', '[2,25)')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[1,2)",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('rangeGt', async () => {
  const res = await postgrest.from('users').select('age_range').rangeGt('age_range', '[2,25)')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[25,35)",
        },
        {
          "age_range": "[25,35)",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('rangeGte', async () => {
  const res = await postgrest.from('users').select('age_range').rangeGte('age_range', '[2,25)')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[25,35)",
        },
        {
          "age_range": "[25,35)",
        },
        {
          "age_range": "[20,30)",
        },
        {
          "age_range": "[20,30)",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('rangeLte', async () => {
  const res = await postgrest.from('users').select('age_range').rangeLte('age_range', '[2,25)')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[1,2)",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('rangeAdjacent', async () => {
  const res = await postgrest.from('users').select('age_range').rangeAdjacent('age_range', '[2,25)')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[1,2)",
        },
        {
          "age_range": "[25,35)",
        },
        {
          "age_range": "[25,35)",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('overlaps', async () => {
  const res = await postgrest.from('users').select('age_range').overlaps('age_range', '[2,25)')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "age_range": "[20,30)",
        },
        {
          "age_range": "[20,30)",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('overlaps with array', async () => {
  const res = await postgrest
    .from('cornercase')
    .select('array_column')
    .overlaps('array_column', ['test'])
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "array_column": [
            "test",
            "one",
          ],
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('textSearch', async () => {
  const res = await postgrest
    .from('users')
    .select('catchphrase')
    .textSearch('catchphrase', `'fat' & 'cat'`, { config: 'english' })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "catchphrase": "'cat' 'fat'",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('textSearch with plainto_tsquery', async () => {
  const res = await postgrest
    .from('users')
    .select('catchphrase')
    .textSearch('catchphrase', `'fat' & 'cat'`, { config: 'english', type: 'plain' })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "catchphrase": "'cat' 'fat'",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('textSearch with phraseto_tsquery', async () => {
  const res = await postgrest
    .from('users')
    .select('catchphrase')
    .textSearch('catchphrase', 'cat', { config: 'english', type: 'phrase' })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "catchphrase": "'cat' 'fat'",
        },
        {
          "catchphrase": "'bat' 'cat'",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('textSearch with websearch_to_tsquery', async () => {
  const res = await postgrest
    .from('users')
    .select('catchphrase')
    .textSearch('catchphrase', `'fat' & 'cat'`, { config: 'english', type: 'websearch' })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "catchphrase": "'cat' 'fat'",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('multiple filters', async () => {
  const res = await postgrest
    .from('users')
    .select()
    .eq('username', 'supabot')
    .is('data', null)
    .overlaps('age_range', '[1,2)')
    .eq('status', 'ONLINE')
    .textSearch('catchphrase', 'cat')
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

test('filter', async () => {
  const res = await postgrest.from('users').select('username').filter('username', 'eq', 'supabot')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('match', async () => {
  const res = await postgrest
    .from('users')
    .select('username, status')
    .match({ username: 'supabot', status: 'ONLINE' })
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
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

test('filter on rpc', async () => {
  const res = await postgrest
    .rpc('get_username_and_status', { name_param: 'supabot' })
    .neq('status', 'ONLINE')
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

test('isDistinct', async () => {
  const res = await postgrest.from('users').select('username').isDistinct('status', 'ONLINE')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "kiwicopple",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('regexMatch', async () => {
  const res = await postgrest.from('users').select('username').regexMatch('username', '^sup')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})

test('regexIMatch', async () => {
  const res = await postgrest.from('users').select('username').regexIMatch('username', '^SUP')
  expect(res).toMatchInlineSnapshot(`
    {
      "count": null,
      "data": [
        {
          "username": "supabot",
        },
      ],
      "error": null,
      "status": 200,
      "statusText": "OK",
    }
  `)
})
