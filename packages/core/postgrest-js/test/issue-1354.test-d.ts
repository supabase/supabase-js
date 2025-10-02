import { expectType, TypeEqual } from './types'
import { PostgrestClient } from '../src/index'
import type { MergeDeep } from 'type-fest'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      foo: {
        Row: {
          created_at: string | null
          bar: Json
          id: string
          baz: Json
          game_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          bar: Json
          id?: string
          baz: Json
          game_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          bar?: Json
          id?: string
          baz?: Json
          game_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes']
    ? PublicSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

type Custom = {
  version: number
  events: Array<{
    type: string
    [x: string]: any
  }>
}

export type DatabaseOverride = MergeDeep<
  Database,
  {
    public: {
      Tables: {
        foo: {
          Row: {
            bar: Custom
            baz: Custom
          }
          Insert: {
            bar: Custom
            baz: Custom
          }
          Update: {
            bar?: Custom
            baz?: Custom
          }
        }
      }
    }
  }
>

const postgrest = new PostgrestClient<Database>('http://localhost:3000')

const postgrestOverrideTypes = new PostgrestClient<DatabaseOverride>('http://localhost:3000')

// Basic types
{
  const res = await postgrest.from('foo').select('id').eq('id', '...').single()

  const bar = {} as Custom
  const baz = {} as Custom
  if (res.error) {
    throw new Error(res.error.message)
  }
  const result = await postgrest
    .from('foo')
    .update({
      bar,
      baz,
    })
    .eq('id', res.data.id)
  expectType<null>(result.data)
}

// basic types with postgres jsonpath selector
{
  const res = await postgrest.from('foo').select('id, bar, baz').eq('bar->version', 31).single()

  const bar = {} as Json
  const baz = {} as Json
  if (res.error) {
    throw new Error(res.error.message)
  }
  const result = await postgrest
    .from('foo')
    .update({
      bar,
      baz,
    })
    .eq('bar->version', 31)
  expectType<null>(result.data)
  const resIn = await postgrest
    .from('foo')
    .select('id, bar, baz')
    .in('bar->version', [1, 2])
    .single()

  if (resIn.error) {
    throw new Error(resIn.error.message)
  }
  expectType<{ id: string; bar: Json; baz: Json }>(resIn.data)
}

// extended types
{
  const res = await postgrestOverrideTypes
    .from('foo')
    .select('id, bar, baz')
    .eq('id', '...')
    .single()

  const bar = {} as Custom
  const baz = {} as Custom
  if (res.error) {
    throw new Error(res.error.message)
  }
  const result = await postgrestOverrideTypes
    .from('foo')
    .update({
      bar,
      baz,
    })
    .eq('id', res.data.id)
  expectType<null>(result.data)
  const resIn = await postgrestOverrideTypes
    .from('foo')
    .select('id, bar, baz')
    .in('bar', [
      { version: 1, events: [] },
      { version: 2, events: [] },
    ])
    .single()

  if (resIn.error) {
    throw new Error(resIn.error.message)
  }
  expectType<{ id: string; bar: Custom; baz: Custom }>(resIn.data)
}

// extended types with postgres jsonpath selector
{
  const res = await postgrestOverrideTypes
    .from('foo')
    .select('id, bar, baz')
    .eq('bar->version', 31)
    .single()

  const bar = {} as Custom
  const baz = {} as Custom
  if (res.error) {
    throw new Error(res.error.message)
  }
  const result = await postgrestOverrideTypes
    .from('foo')
    .update({
      bar,
      baz,
    })
    .eq('bar->version', res.data.bar.version)
  expectType<null>(result.data)
  const resIn = await postgrestOverrideTypes
    .from('foo')
    .select('id, bar, baz')
    .in('bar->version', [31])
    .single()
  await postgrestOverrideTypes
    .from('foo')
    .select('id, bar, baz')
    // the type become a string when using the string json accessor operator
    .in('bar->>version', ['something'])
    .single()

  if (resIn.error) {
    throw new Error(resIn.error.message)
  }
  expectType<{ id: string; bar: Custom; baz: Custom }>(resIn.data)
}
