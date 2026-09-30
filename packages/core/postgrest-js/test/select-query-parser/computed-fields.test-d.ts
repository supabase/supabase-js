import { MergeDeep } from 'type-fest'
import { expectType, TypeEqual } from '../types'
import { PostgrestClient } from '../../src/index'
import { GetComputedFields } from '../../src/select-query-parser/utils'

const REST_URL = 'http://localhost:54321/rest/v1'

// Types generated before relations declared `ComputedFields`: the computed fields are
// inferred from the functions taking the relation's row.
type InferredDatabase = {
  public: {
    Tables: {
      todos: {
        Row: {
          id: number
          title: string
          counter: number
          flag: boolean
          pair: string | null
          blurb: string | null
          blurb_named: string | null
          blurb_varchar: string | null
        }
        Insert: {
          id?: number
          title: string
          counter?: number
          flag?: boolean
          pair?: string | null
        }
        Update: {
          id?: number
          title?: string
          counter?: number
          flag?: boolean
          pair?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      todos_view: {
        Row: {
          id: number | null
          title: string | null
          blurb_varchar: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      // Unnamed parameter
      blurb: {
        Args: { '': InferredDatabase['public']['Tables']['todos']['Row'] }
        Returns: string
      }
      // Named parameter
      blurb_named: {
        Args: { todo_row: InferredDatabase['public']['Tables']['todos']['Row'] }
        Returns: string
      }
      // Overloaded: the same computed field on a table and on a view
      blurb_varchar:
        | {
            Args: { '': InferredDatabase['public']['Tables']['todos']['Row'] }
            Returns: string
          }
        | {
            Args: { todo: InferredDatabase['public']['Views']['todos_view']['Row'] }
            Returns: string
          }
      // Same name as a column, but not a computed field: no argument, in both spellings
      counter:
        | { Args: never; Returns: number }
        | { Args: Record<PropertyKey, never>; Returns: number }
      // Same name as a column, but not a computed field: an optional scalar argument
      flag: { Args: { ''?: string }; Returns: boolean }
      // Same name as a column, but not a computed field: the row plus another argument
      pair: {
        Args: { todo_row: InferredDatabase['public']['Tables']['todos']['Row']; suffix: string }
        Returns: string
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

// Inferred: unnamed, named and overloaded functions taking the row are computed fields
{
  type result = GetComputedFields<InferredDatabase['public'], 'todos'>
  expectType<TypeEqual<result, 'blurb' | 'blurb_named' | 'blurb_varchar'>>(true)
}

// Inferred: an overload taking the view's row is a computed field of the view
{
  type result = GetComputedFields<InferredDatabase['public'], 'todos_view'>
  expectType<TypeEqual<result, 'blurb_varchar'>>(true)
}

// Inferred: `*` leaves the computed fields out and keeps same-named columns
{
  const postgrest = new PostgrestClient<InferredDatabase>(REST_URL)
  const { data, error } = await postgrest.from('todos').select('*')
  if (error) throw new Error(error.message)
  expectType<
    TypeEqual<
      typeof data,
      { id: number; title: string; counter: number; flag: boolean; pair: string | null }[]
    >
  >(true)
}

// Inferred: `*` on the view leaves the overloaded computed field out
{
  const postgrest = new PostgrestClient<InferredDatabase>(REST_URL)
  const { data, error } = await postgrest.from('todos_view').select('*')
  if (error) throw new Error(error.message)
  expectType<TypeEqual<typeof data, { id: number | null; title: string | null }[]>>(true)
}

// Inferred: a computed field selected by name keeps its `Row` type
{
  const postgrest = new PostgrestClient<InferredDatabase>(REST_URL)
  const { data, error } = await postgrest.from('todos').select('title, blurb_named')
  if (error) throw new Error(error.message)
  expectType<TypeEqual<typeof data, { title: string; blurb_named: string | null }[]>>(true)
}

// Inferred: overriding a column's type keeps the computed fields, as the row is matched on
// its keys against the generated `Row` the function argument references
{
  type OverriddenDatabase = MergeDeep<
    InferredDatabase,
    {
      public: {
        Tables: {
          todos: {
            Row: { title: 'chores' | 'work' }
          }
        }
      }
    }
  >
  type result = GetComputedFields<OverriddenDatabase['public'], 'todos'>
  expectType<TypeEqual<result, 'blurb' | 'blurb_named' | 'blurb_varchar'>>(true)

  const postgrest = new PostgrestClient<OverriddenDatabase>(REST_URL)
  const { data, error } = await postgrest.from('todos').select('*')
  if (error) throw new Error(error.message)
  expectType<
    TypeEqual<
      typeof data,
      {
        id: number
        title: 'chores' | 'work'
        counter: number
        flag: boolean
        pair: string | null
      }[]
    >
  >(true)
}

// Types that declare `ComputedFields` next to `Row`, as the generator emits them.
type DeclaredDatabase = {
  public: {
    Tables: {
      channels: {
        Row: {
          id: number
          slug: string | null
          label: string | null
          get_messages: { id: number; message: string | null } | null
        }
        Insert: {
          id?: number
          slug?: string | null
        }
        Update: {
          id?: number
          slug?: string | null
        }
        Relationships: []
        ComputedFields: 'label' | 'get_messages'
      }
      messages: {
        Row: {
          id: number
          channel_id: number
          message: string | null
        }
        Insert: {
          id?: number
          channel_id: number
          message?: string | null
        }
        Update: {
          id?: number
          channel_id?: number
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'messages_channel_id_fkey'
            columns: ['channel_id']
            isOneToOne: false
            referencedRelation: 'channels'
            referencedColumns: ['id']
          },
        ]
        ComputedFields: never
      }
      // A real column with the same name as a function taking the row: PostgREST resolves
      // the name to the column, so the generator declares no computed field.
      settings: {
        Row: {
          id: number
          label: string
        }
        Insert: {
          id?: number
          label: string
        }
        Update: {
          id?: number
          label?: string
        }
        Relationships: []
        ComputedFields: never
      }
    }
    Views: {
      channels_view: {
        Row: {
          id: number | null
          label: string | null
        }
        Relationships: []
        ComputedFields: 'label'
      }
    }
    Functions: {
      label:
        | {
            Args: { channel_row: DeclaredDatabase['public']['Tables']['channels']['Row'] }
            Returns: string
          }
        | {
            Args: { '': DeclaredDatabase['public']['Tables']['settings']['Row'] }
            Returns: string
          }
        | {
            Args: { view_row: DeclaredDatabase['public']['Views']['channels_view']['Row'] }
            Returns: string
          }
      get_messages: {
        Args: { channel_row: DeclaredDatabase['public']['Tables']['channels']['Row'] }
        Returns: { id: number; message: string | null }[]
        SetofOptions: {
          from: 'channels'
          to: 'messages'
          isOneToOne: false
          isSetofReturn: true
        }
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

// Declared: the relation's `ComputedFields` is used as is
{
  type channels = GetComputedFields<DeclaredDatabase['public'], 'channels'>
  expectType<TypeEqual<channels, 'label' | 'get_messages'>>(true)
  type messages = GetComputedFields<DeclaredDatabase['public'], 'messages'>
  expectType<TypeEqual<messages, never>>(true)
  type settings = GetComputedFields<DeclaredDatabase['public'], 'settings'>
  expectType<TypeEqual<settings, never>>(true)
  type channels_view = GetComputedFields<DeclaredDatabase['public'], 'channels_view'>
  expectType<TypeEqual<channels_view, 'label'>>(true)
}

// Declared: `*` returns the columns only
{
  const postgrest = new PostgrestClient<DeclaredDatabase>(REST_URL)
  const { data, error } = await postgrest.from('channels').select('*')
  if (error) throw new Error(error.message)
  expectType<TypeEqual<typeof data, { id: number; slug: string | null }[]>>(true)
}

// Declared: `ComputedFields: never` resolves `*` to `Row` itself
{
  const postgrest = new PostgrestClient<DeclaredDatabase>(REST_URL)
  const { data, error } = await postgrest.from('messages').select('*')
  if (error) throw new Error(error.message)
  expectType<TypeEqual<typeof data, DeclaredDatabase['public']['Tables']['messages']['Row'][]>>(
    true
  )
}

// Declared: a column with the same name as a function taking the row stays in `*`
{
  const postgrest = new PostgrestClient<DeclaredDatabase>(REST_URL)
  const { data, error } = await postgrest.from('settings').select('*')
  if (error) throw new Error(error.message)
  expectType<TypeEqual<typeof data, { id: number; label: string }[]>>(true)
}

// Declared: `*` on a view leaves its computed field out
{
  const postgrest = new PostgrestClient<DeclaredDatabase>(REST_URL)
  const { data, error } = await postgrest.from('channels_view').select('*')
  if (error) throw new Error(error.message)
  expectType<TypeEqual<typeof data, { id: number | null }[]>>(true)
}

// Declared: `*` inside an embed leaves the computed fields out
{
  const postgrest = new PostgrestClient<DeclaredDatabase>(REST_URL)
  const { data, error } = await postgrest.from('messages').select('id, channels!inner(*)')
  if (error) throw new Error(error.message)
  expectType<
    TypeEqual<typeof data, { id: number; channels: { id: number; slug: string | null } }[]>
  >(true)
}

// Declared: `*` inside an embed through the foreign key column name leaves the computed
// fields out
{
  const postgrest = new PostgrestClient<DeclaredDatabase>(REST_URL)
  const { data, error } = await postgrest.from('messages').select('id, channel_id(*)')
  if (error) throw new Error(error.message)
  expectType<
    TypeEqual<typeof data, { id: number; channel_id: { id: number; slug: string | null } }[]>
  >(true)
}

// Declared: computed fields selected by name keep their `Row` type
{
  const postgrest = new PostgrestClient<DeclaredDatabase>(REST_URL)
  const { data, error } = await postgrest.from('channels').select('slug, label, get_messages')
  if (error) throw new Error(error.message)
  expectType<
    TypeEqual<
      typeof data,
      {
        slug: string | null
        label: string | null
        get_messages: { id: number; message: string | null } | null
      }[]
    >
  >(true)
}

// Declared: a computed relationship embedded with parentheses keeps its embed type, the
// rows of the relation named in `SetofOptions`
{
  const postgrest = new PostgrestClient<DeclaredDatabase>(REST_URL)
  const { data, error } = await postgrest.from('channels').select('slug, get_messages(*)')
  if (error) throw new Error(error.message)
  expectType<
    TypeEqual<
      typeof data,
      {
        slug: string | null
        get_messages: { id: number; channel_id: number; message: string | null }[]
      }[]
    >
  >(true)
}

// Declared: an overridden `Row` keeps the declared computed fields, which inference from
// `Functions` would lose since `Args` still references the generated `Row`
{
  type OverriddenDatabase = MergeDeep<
    DeclaredDatabase,
    {
      public: {
        Tables: {
          channels: {
            Row: { slug: 'general' | 'random' | null }
          }
        }
      }
    }
  >
  type result = GetComputedFields<OverriddenDatabase['public'], 'channels'>
  expectType<TypeEqual<result, 'label' | 'get_messages'>>(true)

  const postgrest = new PostgrestClient<OverriddenDatabase>(REST_URL)
  const { data, error } = await postgrest.from('channels').select('*')
  if (error) throw new Error(error.message)
  expectType<TypeEqual<typeof data, { id: number; slug: 'general' | 'random' | null }[]>>(true)
}
