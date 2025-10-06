import {
  DeduplicateRelationships,
  FindMatchingFunctionByArgs,
  GetComputedFields,
} from '../../src/select-query-parser/utils'
import { expectType, TypeEqual } from '../types'
import { Database } from '../types.generated'

// Deduplicate exact sames relationships
{
  type rels = [
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'project_subscriptions'
      referencedColumns: ['project_id']
    },
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'projects'
      referencedColumns: ['id']
    },
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'projects'
      referencedColumns: ['id']
    },
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'sls_physical_backups_monitoring'
      referencedColumns: ['project_id']
    }
  ]
  type expected = [
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'project_subscriptions'
      referencedColumns: ['project_id']
    },
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'projects'
      referencedColumns: ['id']
    },
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'sls_physical_backups_monitoring'
      referencedColumns: ['project_id']
    }
  ]

  type result = DeduplicateRelationships<rels>
  expectType<TypeEqual<result, expected>>(true)
}

// Test GetComputedFields basic
{
  type Schema = Database['public']
  type result = GetComputedFields<Schema, 'users'>
  type expected = never
  expectType<TypeEqual<result, expected>>(true)
}

// Test GetComputedFields basic single field
{
  type Schema = Database['public']
  type result = GetComputedFields<Schema, 'messages'>
  type expected = 'blurb_message'
  expectType<TypeEqual<result, expected>>(true)
}

// Test GetComputedFields multiples computed fields
{
  type Json = unknown

  type Database = {
    personal: {
      Tables: {
        [_ in never]: never
      }
      Views: {
        [_ in never]: never
      }
      Functions: {
        [_ in never]: never
      }
      Enums: {
        user_status: 'ONLINE' | 'OFFLINE'
      }
      CompositeTypes: {
        [_ in never]: never
      }
    }
    public: {
      Tables: {
        messages: {
          Row: {
            channel_id: number
            data: Json | null
            id: number
            message: string | null
            username: string
            blurb_message: string | null
            blurb_message2: number | null
            blurb_message3: null | null
          }
          Insert: {
            channel_id: number
            data?: Json | null
            id?: number
            message?: string | null
            username: string
          }
          Update: {
            channel_id?: number
            data?: Json | null
            id?: number
            message?: string | null
            username?: string
          }
          Relationships: []
        }
      }
      Views: {
        [_ in never]: never
      }
      Functions: {
        blurb_message: {
          Args: { '': Database['public']['Tables']['messages']['Row'] }
          Returns: string
        }
        blurb_message2: {
          Args: { '': Database['public']['Tables']['messages']['Row'] }
          Returns: number
        }
        blurb_message3: {
          Args: { '': Database['public']['Tables']['messages']['Row'] }
          Returns: null
        }
        function_returning_row: {
          Args: Record<PropertyKey, never>
          Returns: {
            age_range: unknown | null
            catchphrase: unknown | null
            data: Json | null
            username: string
          }
        }
        function_returning_set_of_rows: {
          Args: Record<PropertyKey, never>
          Returns: {
            age_range: unknown | null
            catchphrase: unknown | null
            data: Json | null
            username: string
          }[]
        }
      }
      Enums: {
        [_ in never]: never
      }
      CompositeTypes: {
        [_ in never]: never
      }
    }
  }

  type Schema = Database['public']
  type result = GetComputedFields<Schema, 'messages'>
  type expected = 'blurb_message' | 'blurb_message2' | 'blurb_message3'
  expectType<TypeEqual<result, expected>>(true)
}

// Tests we find the right function definition when the function is an union (override declarations)
{
  type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

  type Database = {
    public: {
      Tables: {
        users: {
          Row: {
            age_range: unknown | null
            catchphrase: unknown | null
            data: Json | null
            username: string
          }
        }
      }
    }
  }
  type FnUnion =
    | {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    | {
        Args: { a: string }
        Returns: number
      }
    | {
        Args: { b: number }
        Returns: string
      }
    | {
        Args: { cid: number; search?: string }
        Returns: {
          channel_id: number
          data: Json | null
          id: number
          message: string | null
          username: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'messages'
          isOneToOne: false
        }
      }
    | {
        Args: { profile_id: number }
        Returns: {
          id: number
          username: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'user_profiles'
          isOneToOne: false
        }
      }
    | {
        Args: { user_row: Database['public']['Tables']['users']['Row'] }
        Returns: {
          channel_id: number
          data: Json | null
          id: number
          message: string | null
          username: string
        }[]
        SetofOptions: {
          from: 'users'
          to: 'messages'
          isOneToOne: false
        }
      }
  {
    // Test 1: No arguments matching
    type NoArgsMatch = FindMatchingFunctionByArgs<FnUnion, {}>
    type r = TypeEqual<
      NoArgsMatch,
      {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    >
    expectType<r>(true)
  }

  {
    // Test 2: Single string argument matching
    type StringArgMatch = FindMatchingFunctionByArgs<FnUnion, { a: 'test' }>
    type r = TypeEqual<
      StringArgMatch,
      {
        Args: { a: string }
        Returns: number
      }
    >
    expectType<r>(true)
  }

  {
    // Test 3: Single number argument matching
    type NumberArgMatch = FindMatchingFunctionByArgs<FnUnion, { b: 42 }>
    type r = TypeEqual<
      NumberArgMatch,
      {
        Args: { b: number }
        Returns: string
      }
    >
    expectType<r>(true)
  }

  {
    // Test 5: Matching with SetofFunction and complex argument (user_row)
    type ComplexArgMatch = FindMatchingFunctionByArgs<
      FnUnion,
      {
        user_row: {
          age_range: null
          catchphrase: null
          data: {}
          username: 'test-username'
        }
      }
    >
    type r = TypeEqual<
      ComplexArgMatch,
      {
        Args: {
          user_row: {
            age_range: unknown | null
            catchphrase: unknown | null
            data: Json
            username: string
          }
        }
        Returns: {
          channel_id: number
          data: Json
          id: number
          message: string | null
          username: string
        }[]
        SetofOptions: {
          from: 'users'
          to: 'messages'
          isOneToOne: false
        }
      }
    >
    expectType<r>(true)
  }

  {
    // Test 6: Invalid arguments should result in never
    type InvalidMatch = FindMatchingFunctionByArgs<FnUnion, { invalid: string }>
    type r = TypeEqual<InvalidMatch, never>
    expectType<r>(true)
  }

  {
    // Test 7: Partial arguments should work if no missing required
    type PartialMatch = FindMatchingFunctionByArgs<FnUnion, { cid: 2 }>
    expectType<
      TypeEqual<
        PartialMatch,
        {
          Args: {
            cid: number
            search?: string
          }
          Returns: {
            channel_id: number
            data: Json
            id: number
            message: string | null
            username: string
          }[]
          SetofOptions: {
            from: '*'
            to: 'messages'
            isOneToOne: false
          }
        }
      >
    >(true)
    type PartialMatchValued = FindMatchingFunctionByArgs<FnUnion, { cid: 2; search: 'somevalue' }>
    expectType<
      TypeEqual<
        PartialMatchValued,
        {
          Args: {
            cid: number
            search?: string
          }
          Returns: {
            channel_id: number
            data: Json
            id: number
            message: string | null
            username: string
          }[]
          SetofOptions: {
            from: '*'
            to: 'messages'
            isOneToOne: false
          }
        }
      >
    >(true)
    type PartialMatchMissingRequired = FindMatchingFunctionByArgs<FnUnion, { search: 'somevalue' }>
    expectType<TypeEqual<PartialMatchMissingRequired, never>>(true)
  }

  {
    // Test 8: Extra arguments should result in never
    type ExtraArgsMatch = FindMatchingFunctionByArgs<FnUnion, { a: string; extra: boolean }>
    type r = TypeEqual<ExtraArgsMatch, never>
    expectType<r>(true)
  }
}

// Test we are able to use the proper type when the function is a single declaration
{
  type FnSingle = {
    Args: Record<PropertyKey, never>
    Returns: undefined
  }
  type SingleMatch = FindMatchingFunctionByArgs<FnSingle, Record<PropertyKey, never>>
  type r = TypeEqual<
    SingleMatch,
    {
      Args: Record<PropertyKey, never>
      Returns: undefined
    }
  >
  expectType<r>(true)
}
