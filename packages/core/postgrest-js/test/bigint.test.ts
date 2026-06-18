import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { expectType, TypeEqual } from './types'
import { z } from 'zod'

const REST_URL = 'http://localhost:54321/rest/v1'
const postgrest = new PostgrestClient<Database>(REST_URL)

// 2^63 - 1, the largest int8 value, well above Number.MAX_SAFE_INTEGER (2^53 - 1).
const MAX_INT8 = '9223372036854775807'
// Another value above 2^53, used for the write-path tests.
const ABOVE_MAX_SAFE = '9007199254740993'

describe('int8/bigint precision over PostgREST', () => {
  test('reading int8 without a cast returns a lossy JS number', async () => {
    const res = await postgrest.from('bigint_precision').select('big_value').eq('id', 1).single()

    // PostgREST emits int8 as a JSON number, and JSON.parse rounds it to the nearest double, so
    // the exact value is already lost by the time it reaches the client.
    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": {
          "big_value": 9223372036854776000,
        },
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    expect(String(res.data?.big_value)).not.toBe(MAX_INT8)

    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.object({ big_value: z.number() })
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
  })

  test('reading int8 cast to text is lossless', async () => {
    const res = await postgrest
      .from('bigint_precision')
      // Casting to text makes PostgREST return a JSON string, which survives JSON.parse intact.
      .select('big_value::text')
      .eq('id', 1)
      .single()

    expect(res).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": {
          "big_value": "9223372036854775807",
        },
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    expect(res.data?.big_value).toBe(MAX_INT8)

    let result: Exclude<typeof res.data, null>
    const ExpectedSchema = z.object({ big_value: z.string() })
    let expected: z.infer<typeof ExpectedSchema>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
  })

  test('writing int8 above 2^53 as a string round-trips losslessly', async () => {
    const updated = await postgrest
      .from('bigint_precision')
      // big_value is generated as `number`; the postgres-meta `bigint_as=string` option
      // (supabase/postgres-meta#1078) would type the Insert/Update column as `string`, so this
      // lossless string form would need no cast.
      // @ts-expect-error intentionally exercising the string write the default `number` type rejects.
      .update({ big_value: ABOVE_MAX_SAFE })
      .eq('id', 2)
      .select('big_value::text')
      .single()

    expect(updated).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": {
          "big_value": "9007199254740993",
        },
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    expect(updated.data?.big_value).toBe(ABOVE_MAX_SAFE)
  })

  test('writing int8 above 2^53 as a JS number loses precision before the request is sent', async () => {
    // The anti-pattern: a JS number is already rounded before serialization, so PostgREST
    // faithfully stores the wrong value.
    const updated = await postgrest
      .from('bigint_precision')
      .update({ big_value: Number(ABOVE_MAX_SAFE) })
      .eq('id', 3)
      .select('big_value::text')
      .single()

    expect(updated).toMatchInlineSnapshot(`
      {
        "count": null,
        "data": {
          "big_value": "9007199254740992",
        },
        "error": null,
        "status": 200,
        "statusText": "OK",
        "success": true,
      }
    `)
    expect(updated.data?.big_value).not.toBe(ABOVE_MAX_SAFE)
  })
})
