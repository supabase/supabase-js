import { PostgrestClient } from '../src/index'
import { expectType, TypeEqual } from './types'

// Regression test for supabase-js#1639: selecting an embedded resource after
// .rpc() failed with SelectQueryError when the function's return table could
// not be resolved from SetofOptions — either because generated types spell
// SetofOptions.to schema-qualified ('public.batches') or because they omit
// SetofOptions entirely (older generated types).
type Database1639 = {
  public: {
    Tables: {
      batches: {
        Row: { id: string; collection_id: string }
        Insert: { id: string; collection_id: string }
        Update: { id?: string; collection_id?: string }
        Relationships: [
          {
            foreignKeyName: 'batches_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
        ]
      }
      collections: {
        Row: { id: string; name: string }
        Insert: { id: string; name: string }
        Update: { id?: string; name?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      get_batches_by_ids: {
        Args: { batch_ids: string[] }
        Returns: { id: string; collection_id: string }[]
        SetofOptions: {
          from: '*'
          to: 'batches'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_batches_by_ids_qualified: {
        Args: { batch_ids: string[] }
        Returns: { id: string; collection_id: string }[]
        SetofOptions: {
          from: '*'
          to: 'public.batches'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_batches_by_ids_legacy: {
        Args: { batch_ids: string[] }
        Returns: { id: string; collection_id: string }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

const postgrest = new PostgrestClient<Database1639>('http://localhost:54321/rest/v1')

type Expected1639 = {
  id: string
  collection_id: string
  collections: { id: string }
}

test('issue-1639 rpc embed with SetofOptions', async () => {
  const res = await postgrest
    .rpc('get_batches_by_ids', { batch_ids: [] })
    .select('*, collections!batches_collection_id_fkey(id)')
  expectType<TypeEqual<NonNullable<typeof res.data>[number], Expected1639>>(true)
})

test('issue-1639 rpc embed with schema-qualified SetofOptions.to', async () => {
  const res = await postgrest
    .rpc('get_batches_by_ids_qualified', { batch_ids: [] })
    .select('*, collections!batches_collection_id_fkey(id)')
  expectType<TypeEqual<NonNullable<typeof res.data>[number], Expected1639>>(true)
})

test('issue-1639 rpc embed without SetofOptions', async () => {
  const res = await postgrest
    .rpc('get_batches_by_ids_legacy', { batch_ids: [] })
    .select('*, collections!batches_collection_id_fkey(id)')
  expectType<TypeEqual<NonNullable<typeof res.data>[number], Expected1639>>(true)
})
