import { PostgrestClient } from '../../src/index'
import { UnionToTuple } from '../../src/select-query-parser/types'
import { expectType, TypeEqual } from '../types'

// A computed relationship requires searching the incoming foreign keys before
// falling back to the function. These 60 relationships used to exhaust the
// compiler's instantiation depth while converting that union into a tuple.
type ChildName = `child_${0 | 1 | 2 | 3 | 4 | 5}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`

type Database = {
  public: {
    Tables: {
      items: {
        Row: { id: number }
        Insert: { id: number }
        Update: { id?: number }
        Relationships: []
      }
      details: {
        Row: { value: string }
        Insert: { value: string }
        Update: { value?: string }
        Relationships: []
      }
    } & {
      [Name in ChildName]: {
        Row: { id: number; item_id: number }
        Insert: { id: number; item_id: number }
        Update: { id?: number; item_id?: number }
        Relationships: [
          {
            foreignKeyName: `${Name}_item_id_fkey`
            columns: ['item_id']
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {}
    Functions: {
      item_details: {
        Args: { item: { id: number } }
        Returns: { value: string }[]
        SetofOptions: {
          from: 'items'
          to: 'details'
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
  }
}

const postgrest = new PostgrestClient<Database>('http://localhost:54321/rest/v1')
const query = postgrest.from('items').select('id, item_details!inner(value)')
type Result = Exclude<Awaited<typeof query>['data'], null>
expectType<TypeEqual<Result, { id: number; item_details: { value: string }[] }[]>>(true)

// Conversion retains every member, including the empty and singleton cases.
expectType<TypeEqual<UnionToTuple<never>, []>>(true)
expectType<TypeEqual<UnionToTuple<'only'>, ['only']>>(true)
expectType<TypeEqual<UnionToTuple<ChildName>['length'], 60>>(true)
expectType<TypeEqual<UnionToTuple<ChildName>[number], ChildName>>(true)
