/**
 * Type-level tests for the fluent query builder's schema-based type inference.
 *
 * These tests verify compile-time behavior using @ts-expect-error comments.
 * Run with: npx tsc --noEmit test/fluent-query-builder.test-d.ts
 */

import { expectType } from './types'
import { q, eq, FluentQueryBuilder, FieldRef } from '../src/fluent-query-builder'
import { GenericSchema } from '../src/types/common/common'

// ============================================================================
// Test Schema Definition
// ============================================================================

/**
 * A simple test schema for type inference tests.
 */
type TestSchema = {
  Tables: {
    users: {
      Row: {
        id: number
        username: string
        email: string
        status: 'active' | 'inactive'
        created_at: string
      }
      Insert: {
        id?: number
        username: string
        email: string
        status?: 'active' | 'inactive'
        created_at?: string
      }
      Update: {
        id?: number
        username?: string
        email?: string
        status?: 'active' | 'inactive'
        created_at?: string
      }
      Relationships: []
    }
    posts: {
      Row: {
        id: number
        title: string
        content: string
        author_id: number
        published: boolean
      }
      Insert: {
        id?: number
        title: string
        content: string
        author_id: number
        published?: boolean
      }
      Update: {
        id?: number
        title?: string
        content?: string
        author_id?: number
        published?: boolean
      }
      Relationships: []
    }
    comments: {
      Row: {
        id: number
        post_id: number
        user_id: number
        body: string
      }
      Insert: {
        id?: number
        post_id: number
        user_id: number
        body: string
      }
      Update: {
        id?: number
        post_id?: number
        user_id?: number
        body?: string
      }
      Relationships: []
    }
  }
  Views: {
    active_users: {
      Row: {
        id: number
        username: string
      }
      Relationships: []
    }
  }
  Functions: {}
}

// ============================================================================
// Test 1: Table name validation
// ============================================================================

// Valid table names should work
{
  const builder = q<TestSchema>().from('users')
  expectType<FluentQueryBuilder<TestSchema, readonly ['users']>>(builder)

  const postsBuilder = q<TestSchema>().from('posts')
  expectType<FluentQueryBuilder<TestSchema, readonly ['posts']>>(postsBuilder)

  // Views should also work
  const viewBuilder = q<TestSchema>().from('active_users')
  expectType<FluentQueryBuilder<TestSchema, readonly ['active_users']>>(viewBuilder)
}

// Invalid table names should error
{
  // @ts-expect-error Argument of type '"nonexistent"' is not assignable to parameter of type
  q<TestSchema>().from('nonexistent')

  // @ts-expect-error Argument of type '"usrs"' is not assignable to parameter of type
  q<TestSchema>().from('usrs')

  // @ts-expect-error Argument of type '""' is not assignable to parameter of type
  q<TestSchema>().from('')
}

// ============================================================================
// Test 2: Column access validation in select()
// ============================================================================

// Valid column access should work
{
  q<TestSchema>()
    .from('users')
    .select((users) => ({
      name: users.username, // valid column
      mail: users.email, // valid column
      userStatus: users.status, // valid column
    }))
}

// Invalid column access should error
{
  q<TestSchema>()
    .from('users')
    .select((users) => ({
      // @ts-expect-error Property 'foo' does not exist on type
      x: users.foo,
    }))

  q<TestSchema>()
    .from('users')
    .select((users) => ({
      // @ts-expect-error Property 'nonexistent_column' does not exist on type
      bad: users.nonexistent_column,
    }))
}

// ============================================================================
// Test 3: Join with column validation
// ============================================================================

// Valid join should work
{
  q<TestSchema>()
    .from('users')
    .join('posts')
    .select((users, posts) => ({
      userName: users.username,
      postTitle: posts.title,
      postContent: posts.content,
    }))
}

// Invalid join table should error
{
  // @ts-expect-error Argument of type '"invalid_table"' is not assignable to parameter of type
  q<TestSchema>().from('users').join('invalid_table')
}

// Invalid column in join callback should error
{
  q<TestSchema>()
    .from('users')
    .join('posts')
    .select((users, posts) => ({
      userName: users.username,
      // @ts-expect-error Property 'invalid_column' does not exist on type
      bad: posts.invalid_column,
    }))
}

// ============================================================================
// Test 4: Where clause column validation
// ============================================================================

// Valid where clause should work
{
  q<TestSchema>()
    .from('users')
    .where((users) => eq(users.status, 'active'))

  q<TestSchema>()
    .from('users')
    .where((users) => eq(users.username, 'john'))
}

// Invalid column in where clause should error
{
  q<TestSchema>()
    .from('users')
    // @ts-expect-error Property 'invalid_col' does not exist on type
    .where((users) => eq(users.invalid_col, 'value'))
}

// ============================================================================
// Test 5: OrderBy column validation
// ============================================================================

// Valid orderBy should work
{
  q<TestSchema>()
    .from('users')
    .orderBy((users) => users.username)

  q<TestSchema>()
    .from('users')
    .orderBy((users) => users.created_at, { ascending: false })
}

// Invalid column in orderBy should error
{
  q<TestSchema>()
    .from('users')
    // @ts-expect-error Property 'nonexistent' does not exist on type
    .orderBy((users) => users.nonexistent)
}

// ============================================================================
// Test 6: Multiple joins
// ============================================================================

// Multiple joins should track all tables correctly
{
  q<TestSchema>()
    .from('users')
    .join('posts')
    .join('comments')
    .select((users, posts, comments) => ({
      userName: users.username,
      postTitle: posts.title,
      commentBody: comments.body,
    }))
}

// Invalid column access in multi-join should error
{
  q<TestSchema>()
    .from('users')
    .join('posts')
    .join('comments')
    .select((users, posts, comments) => ({
      userName: users.username,
      // @ts-expect-error Property 'body' does not exist on type
      postBody: posts.body,
      commentBody: comments.body,
    }))
}

// ============================================================================
// Test 7: Backward compatibility - untyped usage
// ============================================================================

// Without schema, any table/column should be allowed
{
  const untypedBuilder = q()
    .from('any_table')
    .select((t) => ({ x: t.any_column }))

  // Should be FluentQueryBuilder with unknown schema
  expectType<FluentQueryBuilder<unknown, readonly ['any_table']>>(untypedBuilder)

  // Any chain should work
  q()
    .from('foo')
    .join('bar')
    .select((foo, bar) => ({
      a: foo.whatever,
      b: bar.anything,
    }))
    .where((foo) => eq(foo.col, 'value'))
    .orderBy((foo) => foo.other_col)
    .limit(10)
}

// ============================================================================
// Test 8: FieldRef type inference
// ============================================================================

// FieldRef should carry table and column info
{
  q<TestSchema>()
    .from('users')
    .select((users) => {
      const field = users.username
      // FieldRef should have correct type parameters
      expectType<FieldRef<'users', 'username'>>(field)
      return { name: field }
    })
}

// ============================================================================
// Test 9: Method chaining preserves types
// ============================================================================

// All chained methods should preserve schema and tables
{
  const query = q<TestSchema>()
    .from('users')
    .join('posts')
    .select((users, posts) => ({
      name: users.username,
      title: posts.title,
    }))
    .where((users) => eq(users.status, 'active'))
    .orderBy((users) => users.created_at)
    .limit(10)

  expectType<FluentQueryBuilder<TestSchema, readonly ['users', 'posts']>>(query)
}

// ============================================================================
// Test 10: Join with condition callback
// ============================================================================

// Join condition should have access to typed columns
{
  q<TestSchema>()
    .from('users')
    .join('posts', (users, posts) => eq(users.id, posts.author_id))
    .select((users, posts) => ({
      userName: users.username,
      postTitle: posts.title,
    }))
}

// Invalid column in join condition should error
{
  q<TestSchema>()
    .from('users')
    // @ts-expect-error Property 'invalid' does not exist on type
    .join('posts', (users, posts) => eq(users.invalid, posts.author_id))
}
