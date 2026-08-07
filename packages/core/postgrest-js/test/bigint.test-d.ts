import { PostgrestClient } from '../src'
import { Database } from './types.override'
import { expectType, TypeEqual } from './types'
import { MergeDeep } from 'type-fest'

const REST_URL = 'http://localhost:54321'

// Demonstrates the DX of the proposed `bigint_as=number|bigint` option for supabase/postgres-meta#1083.
// The int8 column stays `number` on the Row (the un-cast wire value is a lossy number, and `::text`
// already infers `string` on the casted column), and widens to `number | bigint` on Insert/Update,
// where `bigint` is the lossless channel (postgrest-js serializes a BigInt to a JSON string).
type ProposedDatabase = MergeDeep<
  Database,
  {
    public: {
      Tables: {
        bigint_precision: {
          Insert: { big_value: number | bigint }
          Update: { big_value?: number | bigint }
        }
      }
    }
  }
>

const proposed = new PostgrestClient<ProposedDatabase>(REST_URL)

// Row is unchanged: big_value stays `number` on a plain select.
{
  const row = await proposed.from('bigint_precision').select('big_value').single()
  if (row.error) {
    throw new Error(row.error.message)
  }
  expectType<TypeEqual<(typeof row.data)['big_value'], number>>(true)
}

// Casting to text returns the exact value as a `string`, as before.
{
  const casted = await proposed.from('bigint_precision').select('big_value::text').single()
  if (casted.error) {
    throw new Error(casted.error.message)
  }
  expectType<TypeEqual<(typeof casted.data)['big_value'], string>>(true)
}

// A BigInt write type-checks: the lossless channel for values above 2^53.
{
  proposed.from('bigint_precision').update({ big_value: 9007199254740993n }).eq('id', 1)
}

// A plain number write still type-checks: the ergonomic common case.
{
  proposed.from('bigint_precision').update({ big_value: 42 }).eq('id', 1)
}

// A string write is rejected at compile time, which is why `string` is left out of the set.
{
  proposed
    .from('bigint_precision')
    // @ts-expect-error Type 'string' is not assignable to type 'number | bigint | undefined'.
    .update({ big_value: '9007199254740993' })
    .eq('id', 1)
}
