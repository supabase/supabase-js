import { expectType, TypeEqual } from '../types'
import { JsonPathToType } from '../../src/select-query-parser/utils'

// Test JsonPathToType with non-nullable JSON
{
  type Data = {
    a: {
      b: number
    }
  }

  type result = JsonPathToType<Data, 'a.b'>
  expectType<TypeEqual<result, number>>(true)
}

// Test JsonPathToType with nullable JSON
{
  type Data = {
    a: {
      b: number
    }
  } | null

  type result = JsonPathToType<Data, 'a.b'>
  expectType<TypeEqual<result, number | null>>(true)
}

// Test JsonPathToType with nested nullable JSON
{
  type Data = {
    a: {
      b: {
        c: string
      } | null
    }
  }

  type result = JsonPathToType<Data, 'a.b.c'>
  expectType<TypeEqual<result, string | null>>(true)
}

// Test JsonPathToType with nullable root and path
{
  type Data = {
    key: string
  } | null

  type result = JsonPathToType<Data, 'key'>
  expectType<TypeEqual<result, string | null>>(true)
}
