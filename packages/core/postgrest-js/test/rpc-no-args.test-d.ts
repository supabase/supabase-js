import { expectType, TypeEqual } from './types'
import { PostgrestClient } from '../src/index'

type Database = {
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      overloaded_never: { Args: never; Returns: number } | { Args: { a: string }; Returns: string }
      overloaded_record:
        | { Args: Record<PropertyKey, never>; Returns: number }
        | { Args: { a: string }; Returns: string }
      single_record: { Args: Record<PropertyKey, never>; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

const postgrest = new PostgrestClient<Database>('http://localhost:54321/rest/v1')

// A zero-argument overload typed `Args: never` resolves for a call without arguments
{
  const { data } = await postgrest.rpc('overloaded_never')
  expectType<TypeEqual<typeof data, number | null>>(true)
}

// A zero-argument overload typed `Args: Record<PropertyKey, never>` resolves the same way
{
  const { data } = await postgrest.rpc('overloaded_record')
  expectType<TypeEqual<typeof data, number | null>>(true)
}

// Passing arguments still selects the matching overload
{
  const { data } = await postgrest.rpc('overloaded_record', { a: 'value' })
  expectType<TypeEqual<typeof data, string | null>>(true)
}

// A function that is not overloaded is unaffected
{
  const { data } = await postgrest.rpc('single_record')
  expectType<TypeEqual<typeof data, boolean | null>>(true)
}
