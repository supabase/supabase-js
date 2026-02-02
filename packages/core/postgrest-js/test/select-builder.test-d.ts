/**
 * Type tests for the array-based select query builder.
 *
 * These tests verify that:
 * 1. Valid select specs compile correctly
 * 2. Invalid select specs produce compile-time errors
 * 3. String-based select still works with full type inference
 */

import { expectType, TypeEqual } from './types'
import { PostgrestClient } from '../src/index'
import type {
  SelectSpec,
  SelectItem,
  FieldSpec,
  RelationSpec,
  SpreadSpec,
  CountSpec,
} from '../src/select-query-parser/select-builder'
import { Database } from './types.override'

const REST_URL = 'http://localhost:54321/rest/v1'
const postgrest = new PostgrestClient<Database>(REST_URL)

// =============================================================================
// Type Definitions - Valid Cases
// =============================================================================

// string is a valid SelectSpec
{
  const spec: SelectSpec = 'id, name'
  expectType<SelectSpec>(spec)
}

// SelectItem array is a valid SelectSpec
{
  const spec: SelectSpec = ['id', 'name']
  expectType<SelectSpec>(spec)
}

// string array is a valid SelectItem array (column names)
{
  const spec: SelectItem[] = ['id', 'name', 'email']
  expectType<SelectItem[]>(spec)
}

// FieldSpec is a valid SelectItem
{
  const spec: FieldSpec = { column: 'id' }
  const items: SelectItem[] = [spec]
  expectType<SelectItem[]>(items)
}

// RelationSpec is a valid SelectItem
{
  const spec: RelationSpec = { relation: 'posts', select: ['id'] }
  const items: SelectItem[] = [spec]
  expectType<SelectItem[]>(items)
}

// SpreadSpec is a valid SelectItem
{
  const spec: SpreadSpec = { spread: true, relation: 'profile', select: ['status'] }
  const items: SelectItem[] = [spec]
  expectType<SelectItem[]>(items)
}

// CountSpec is a valid SelectItem
{
  const spec: CountSpec = { count: true }
  const items: SelectItem[] = [spec]
  expectType<SelectItem[]>(items)
}

// =============================================================================
// PostgrestQueryBuilder.select() - Valid Cases
// =============================================================================

// accepts no arguments (defaults to *)
{
  const query = postgrest.from('users').select()
  // Should compile without error
}

// accepts string argument
{
  const query = postgrest.from('users').select('username, status')
}

// accepts * string
{
  const query = postgrest.from('users').select('*')
}

// accepts string array (column names)
{
  const query = postgrest.from('users').select(['username', 'status'])
}

// accepts FieldSpec array
{
  const query = postgrest.from('users').select([
    { column: 'username' },
    { column: 'status', as: 'user_status' },
  ])
}

// accepts mixed string and FieldSpec array
{
  const query = postgrest.from('users').select([
    'username',
    { column: 'status', as: 'user_status' },
  ])
}

// accepts RelationSpec
{
  const query = postgrest.from('users').select([
    'username',
    { relation: 'messages', select: ['id', 'message'] },
  ])
}

// accepts SpreadSpec
{
  const query = postgrest.from('messages').select([
    'id',
    { spread: true, relation: 'channels', select: ['slug'] },
  ])
}

// accepts CountSpec
{
  const query = postgrest.from('users').select([{ count: true }])
}

// accepts complex nested query
{
  const query = postgrest.from('users').select([
    'username',
    { column: 'status', as: 'user_status' },
    {
      relation: 'messages',
      inner: true,
      select: [
        'id',
        'message',
        { relation: 'channels', select: ['slug'] },
      ],
    },
    { count: true, as: 'total' },
  ])
}

// =============================================================================
// String-based select still has type inference
// =============================================================================

// infers exact column types from string literal
{
  const result = await postgrest.from('users').select('username, status')
  if (result.data) {
    expectType<{ username: string; status: Database['public']['Enums']['user_status'] | null }[]>(
      result.data
    )
  }
}

// =============================================================================
// FieldSpec - Valid Cases
// =============================================================================

// accepts column only
{
  const spec: FieldSpec = { column: 'id' }
}

// accepts column with alias
{
  const spec: FieldSpec = { column: 'id', as: 'user_id' }
}

// accepts column with cast
{
  const spec: FieldSpec = { column: 'created_at', cast: 'text' }
}

// accepts column with json path
{
  const spec: FieldSpec = { column: 'data', json: ['settings', 'theme'] }
}

// accepts column with jsonText path
{
  const spec: FieldSpec = { column: 'data', jsonText: ['name'] }
}

// accepts column with aggregate
{
  const spec: FieldSpec = { column: 'id', aggregate: 'count' }
}

// accepts all aggregate functions
{
  const specs: FieldSpec[] = [
    { column: 'id', aggregate: 'count' },
    { column: 'amount', aggregate: 'sum' },
    { column: 'price', aggregate: 'avg' },
    { column: 'quantity', aggregate: 'min' },
    { column: 'total', aggregate: 'max' },
  ]
}

// =============================================================================
// RelationSpec - Valid Cases
// =============================================================================

// accepts relation with string select
{
  const spec: RelationSpec = { relation: 'posts', select: 'id, title' }
}

// accepts relation with array select
{
  const spec: RelationSpec = { relation: 'posts', select: ['id', 'title'] }
}

// accepts relation with alias
{
  const spec: RelationSpec = { relation: 'users', as: 'author', select: ['name'] }
}

// accepts relation with hint
{
  const spec: RelationSpec = { relation: 'users', hint: 'author_id', select: ['name'] }
}

// accepts relation with inner join
{
  const spec: RelationSpec = { relation: 'posts', inner: true, select: ['id'] }
}

// accepts relation with left join
{
  const spec: RelationSpec = { relation: 'posts', left: true, select: ['id'] }
}

// accepts relation with hint and inner join
{
  const spec: RelationSpec = {
    relation: 'users',
    hint: 'author_id',
    inner: true,
    select: ['name'],
  }
}

// =============================================================================
// SpreadSpec - Valid Cases
// =============================================================================

// accepts spread with string select
{
  const spec: SpreadSpec = { spread: true, relation: 'profile', select: 'status, bio' }
}

// accepts spread with array select
{
  const spec: SpreadSpec = { spread: true, relation: 'profile', select: ['status', 'bio'] }
}

// accepts spread with hint
{
  const spec: SpreadSpec = {
    spread: true,
    relation: 'users',
    hint: 'author_id',
    select: ['name'],
  }
}

// =============================================================================
// CountSpec - Valid Cases
// =============================================================================

// accepts simple count
{
  const spec: CountSpec = { count: true }
}

// accepts count with alias
{
  const spec: CountSpec = { count: true, as: 'total' }
}

// accepts count with cast
{
  const spec: CountSpec = { count: true, cast: 'int4' }
}

// =============================================================================
// Invalid Cases - Should NOT compile
// =============================================================================

// FieldSpec requires column property
{
  // @ts-expect-error Property 'column' is missing in type
  const spec: FieldSpec = { as: 'alias' }
}

// RelationSpec requires relation property
{
  // @ts-expect-error Property 'relation' is missing in type
  const spec: RelationSpec = { select: ['id'] }
}

// RelationSpec requires select property
{
  // @ts-expect-error Property 'select' is missing in type
  const spec: RelationSpec = { relation: 'posts' }
}

// SpreadSpec requires spread: true
{
  // @ts-expect-error Property 'spread' is missing in type
  const spec: SpreadSpec = { relation: 'profile', select: ['status'] }
}

// SpreadSpec requires relation property
{
  // @ts-expect-error Property 'relation' is missing in type
  const spec: SpreadSpec = { spread: true, select: ['status'] }
}

// SpreadSpec requires select property
{
  // @ts-expect-error Property 'select' is missing in type
  const spec: SpreadSpec = { spread: true, relation: 'profile' }
}

// CountSpec requires count: true
{
  // @ts-expect-error Property 'count' is missing in type
  const spec: CountSpec = { as: 'total' }
}

// invalid aggregate function is rejected
{
  // @ts-expect-error Type '"invalid"' is not assignable to type
  const spec: FieldSpec = { column: 'id', aggregate: 'invalid' }
}
