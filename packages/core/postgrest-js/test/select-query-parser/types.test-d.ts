import { Database } from '../types'
import { selectParams } from '../relationships'
import {
  ProcessEmbeddedResource,
  ProcessNode,
  ProcessNodes,
} from '../../src/select-query-parser/result'
import { expectType } from 'tsd'
import { TypeEqual } from 'ts-expect'
import {
  DeduplicateRelationships,
  FindMatchingRelationships,
  FindMatchingTableRelationships,
  IsRelationNullable,
} from '../../src/select-query-parser/utils'
import { Json } from '../../src/select-query-parser/types'
import { ParseQuery } from '../../src/select-query-parser/parser/parser'

// This test file is here to ensure some of our helpers behave as expected for ease of development
// and debugging purposes
// Searching for an non-existing relationship should return never
{
  let result: FindMatchingRelationships<
    'test',
    Database['public']['Tables']['best_friends']['Relationships']
  >
  let expected: false
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
// Searching for a relationship by direct foreignkey name
{
  let result: FindMatchingRelationships<
    'best_friends_first_user_fkey',
    Database['public']['Tables']['best_friends']['Relationships']
  >
  let expected: {
    foreignKeyName: 'best_friends_first_user_fkey'
    columns: ['first_user']
    isOneToOne: false
    referencedRelation: 'users'
    referencedColumns: ['username']
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
// Searching for a relationship by column hoding the value reference
{
  let result: FindMatchingRelationships<
    'first_user',
    Database['public']['Tables']['best_friends']['Relationships']
  >
  let expected: {
    foreignKeyName: 'best_friends_first_user_fkey'
    columns: ['first_user']
    isOneToOne: false
    referencedRelation: 'users'
    referencedColumns: ['username']
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
// Will find the first matching relationship
{
  let result: FindMatchingRelationships<
    'username',
    Database['public']['Tables']['user_profiles']['Relationships']
  >
  let expected: {
    foreignKeyName: 'user_profiles_username_fkey'
    columns: ['username']
    isOneToOne: false
    referencedRelation: 'non_updatable_view'
    referencedColumns: ['username']
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
// should return the relation matching the "Tables" references
{
  let result: FindMatchingTableRelationships<
    Database['public'],
    Database['public']['Tables']['user_profiles']['Relationships'],
    'username'
  >
  let expected: {
    foreignKeyName: 'user_profiles_username_fkey'
    columns: ['username']
    isOneToOne: false
    referencedRelation: 'users'
    referencedColumns: ['username']
  } & { match: 'col' }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
// Searching for a relationship by referenced table name
{
  let result: FindMatchingRelationships<
    'users',
    Database['public']['Tables']['messages']['Relationships']
  >
  let expected: {
    foreignKeyName: 'messages_username_fkey'
    columns: ['username']
    isOneToOne: false
    referencedRelation: 'users'
    referencedColumns: ['username']
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}
{
  let result: FindMatchingRelationships<
    'channels',
    Database['public']['Tables']['messages']['Relationships']
  >
  let expected: {
    foreignKeyName: 'messages_channel_id_fkey'
    columns: ['channel_id']
    isOneToOne: false
    referencedRelation: 'channels'
    referencedColumns: ['id']
  }
  expectType<TypeEqual<typeof result, typeof expected>>(true)
}

// IsRelationNullable
{
  type BestFriendsTable = Database['public']['Tables']['best_friends']
  type NonNullableRelation = FindMatchingRelationships<
    'best_friends_first_user_fkey',
    BestFriendsTable['Relationships']
  >
  type NullableRelation = FindMatchingRelationships<
    'best_friends_third_wheel_fkey',
    BestFriendsTable['Relationships']
  >
  let nonNullableResult: IsRelationNullable<BestFriendsTable, NonNullableRelation>
  let nullableResult: IsRelationNullable<BestFriendsTable, NullableRelation>
  expectType<typeof nonNullableResult>(false)
  expectType<typeof nullableResult>(true)
}

// Test nodes relations crawling utils
{
  const { from, select } = selectParams.nestedQueryWithSelectiveFields
  type Schema = Database['public']
  type RelationName = typeof from
  type Row = Schema['Tables'][RelationName]['Row']
  type Relationships = Schema['Tables'][RelationName]['Relationships']
  type ParsedQuery = ParseQuery<typeof select>
  // First field of the query is username and is properly parsed
  type f1 = ParsedQuery[0]
  type r1 = ProcessNode<Schema, Row, RelationName, Relationships, ParsedQuery[0]>
  expectType<TypeEqual<r1, { username: string }>>(true)
  type f2 = ParsedQuery[1]
  type r2 = ProcessNodes<Schema, Row, RelationName, Relationships, ParsedQuery>
  // fail because result for messages is ({id: string} | {message: string | null })[]
  expectType<
    TypeEqual<r2, { username: string; messages: { id: number; message: string | null }[] }>
  >(true)
  type f3 = ParsedQuery[1]
  type r3 = ProcessEmbeddedResource<Schema, Relationships, f3, 'users'>
  expectType<TypeEqual<r3, { messages: { id: number; message: string | null }[] }>>(true)
}
// Select from the column holding the relation (0-1 relation)
{
  const { from, select } = selectParams.joinSelectViaColumn
  type Schema = Database['public']
  type RelationName = typeof from
  type Row = Schema['Tables'][RelationName]['Row']
  type Relationships = Schema['Tables'][RelationName]['Relationships']
  type ParsedQuery = ParseQuery<typeof select>
  type r1 = ProcessNode<Schema, Row, RelationName, Relationships, ParsedQuery[0]>
  let expected: {
    username: {
      age_range: unknown | null
      catchphrase: unknown | null
      data: Json | null
      status: Database['public']['Enums']['user_status'] | null
      username: string
    }
  }
  expectType<r1>(expected!)
  type r2 = ProcessNodes<Schema, Row, RelationName, Relationships, ParsedQuery>
  expectType<r2>(expected!)
}

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
