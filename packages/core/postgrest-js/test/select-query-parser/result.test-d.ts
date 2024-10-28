import { Database, Json } from '../types'
import { selectParams } from '../relationships'
import { GetResult } from '../../src/select-query-parser/result'
import { expectType } from 'tsd'
import { TypeEqual } from 'ts-expect'

type SelectQueryFromTableResult<
  TableName extends keyof Database['public']['Tables'],
  Q extends string
> = GetResult<
  Database['public'],
  Database['public']['Tables'][TableName]['Row'],
  TableName,
  Database['public']['Tables'][TableName]['Relationships'],
  Q
>

// This test file is here to help develop, debug and maintain the GetResult
// type inference, it can be useful to identify weither a type error come from the
// result inference or functions chaining down the line in the client (.filter(), ...)

// nested query with selective fields
{
  const { from, select } = selectParams.nestedQueryWithSelectiveFields
  let result: SelectQueryFromTableResult<typeof from, typeof select>
  let expected: {
    username: string
    messages: {
      id: number
      message: string | null
    }[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// select JSON accessor
{
  const { from, select } = selectParams.selectJsonAccessor
  let result: SelectQueryFromTableResult<typeof from, typeof select>
  let expected: {
    bar: Json
    baz: string
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// embed resource with no fields
{
  const { from, select } = selectParams.selectEmbedRessourceWithNoFields
  let result: SelectQueryFromTableResult<typeof from, typeof select>
  let expected: {
    message: string | null
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// Self referencing relation
{
  const { from, select } = selectParams.selfReferenceRelation
  let result: SelectQueryFromTableResult<typeof from, typeof select>
  let expected: {
    id: number
    description: string | null
    parent_id: number | null
    collections: {
      id: number
      description: string | null
      parent_id: number | null
    }[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
