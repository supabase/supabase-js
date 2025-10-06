import { expectType, TypeEqual } from '../types'
import { DeduplicateRelationships, GetComputedFields } from '../../src/select-query-parser/utils'
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
    },
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
    },
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
