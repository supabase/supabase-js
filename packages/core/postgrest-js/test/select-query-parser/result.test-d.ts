import { Database, Json } from '../types'
import { selectParams } from '../relationships'
import { GetResult } from '../../src/select-query-parser/result'
import { expectType } from 'tsd'
import { TypeEqual } from 'ts-expect'
import { SelectQueryError } from '../../src/select-query-parser/utils'

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

// nested query with selective fields
{
  let result: SelectQueryFromTableResult<
    'users',
    `msgs:messages(id, ...message_details(created_at, channel!inner(id, slug, owner:users(*))))`
  >
  let expected: {
    msgs: {
      id: number
      message_details: SelectQueryError<`Could not embed because more than one relationship was found for 'messages' and '${string}' you need to hint the column with messages!<columnName> ?`>
    }[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

{
  let result: SelectQueryFromTableResult<
    'users',
    `msgs:messages(id, ...channels(id, ...channel_details(id, missing_col)))`
  >
  let expected: {
    msgs: {
      id: number
      channel_details: SelectQueryError<"column 'missing_col' does not exist on 'channel_details'."> | null
    }[]
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

{
  let result1: SelectQueryFromTableResult<
    'users',
    `msgs:messages(...channels(slug, channel_details!inner(id, details, channel:channels(*))))`
  >
  let result2: SelectQueryFromTableResult<
    'users',
    `msgs:messages(...channels(slug, channel_details!inner(channel:channels(*), id, details)))`
  >
  let result3: SelectQueryFromTableResult<
    'users',
    `msgs:messages(...channels!inner(slug, channel_details!inner(id, details, channel:channels(*))))`
  >
  // All variations should not change the result
  expectType<typeof result1>(result2!)
  expectType<typeof result2>(result3!)
}
