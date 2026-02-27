/**
 * Integration tests for the array-based select query builder.
 *
 * These tests verify that the array-based select API integrates correctly
 * with PostgrestClient, PostgrestQueryBuilder, and PostgrestTransformBuilder,
 * both with and without typed Database schemas.
 */

import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

const REST_URL = 'http://localhost:54321/rest/v1'

describe('Array-based select with typed Database', () => {
  const postgrest = new PostgrestClient<Database>(REST_URL)

  describe('PostgrestQueryBuilder.select()', () => {
    it('should accept array-based select spec', async () => {
      const builder = postgrest.from('users').select(['username', 'status'])
      // Verify the URL contains the serialized select
      expect((builder as any).url.searchParams.get('select')).toBe('username,status')
    })

    it('should accept string-based select spec (backward compat)', async () => {
      const builder = postgrest.from('users').select('username, status')
      expect((builder as any).url.searchParams.get('select')).toBe('username,status')
    })

    it('should accept * (star) string select', async () => {
      const builder = postgrest.from('users').select('*')
      expect((builder as any).url.searchParams.get('select')).toBe('*')
    })

    it('should accept empty select (defaults to *)', async () => {
      const builder = postgrest.from('users').select()
      expect((builder as any).url.searchParams.get('select')).toBe('*')
    })

    it('should serialize field specs with aliases', async () => {
      const builder = postgrest.from('users').select([{ column: 'username', as: 'name' }, 'status'])
      expect((builder as any).url.searchParams.get('select')).toBe('name:username,status')
    })

    it('should serialize field specs with casts', async () => {
      const builder = postgrest.from('users').select([{ column: 'username', cast: 'text' }])
      expect((builder as any).url.searchParams.get('select')).toBe('username::text')
    })

    it('should serialize relation specs', async () => {
      const builder = postgrest
        .from('users')
        .select(['username', { relation: 'messages', select: ['id', 'message'] }])
      expect((builder as any).url.searchParams.get('select')).toBe('username,messages(id,message)')
    })

    it('should serialize inner join', async () => {
      const builder = postgrest
        .from('users')
        .select(['username', { relation: 'messages', inner: true, select: ['id'] }])
      expect((builder as any).url.searchParams.get('select')).toBe('username,messages!inner(id)')
    })

    it('should serialize spread specs', async () => {
      const builder = postgrest
        .from('messages')
        .select(['id', { spread: true, relation: 'channels', select: ['slug'] }])
      expect((builder as any).url.searchParams.get('select')).toBe('id,...channels(slug)')
    })

    it('should serialize count specs', async () => {
      const builder = postgrest.from('users').select([{ count: true, as: 'total' }])
      expect((builder as any).url.searchParams.get('select')).toBe('total:count()')
    })

    it('should serialize complex nested queries', async () => {
      const builder = postgrest.from('users').select([
        'username',
        {
          relation: 'messages',
          select: ['id', 'message', { relation: 'channels', select: ['slug'] }],
        },
      ])
      expect((builder as any).url.searchParams.get('select')).toBe(
        'username,messages(id,message,channels(slug))'
      )
    })
  })

  describe('PostgrestTransformBuilder.select()', () => {
    it('should accept array-based select spec after insert', async () => {
      const builder = postgrest
        .from('messages')
        .insert({ message: 'test', username: 'test', channel_id: 1 })
        .select(['id', 'message'])

      expect((builder as any).url.searchParams.get('select')).toBe('id,message')
    })

    it('should accept array-based select spec after update', async () => {
      const builder = postgrest
        .from('messages')
        .update({ message: 'updated' })
        .eq('id', 1)
        .select(['id', 'message'])

      expect((builder as any).url.searchParams.get('select')).toBe('id,message')
    })

    it('should accept array-based select spec after delete', async () => {
      const builder = postgrest.from('messages').delete().eq('id', 1).select(['id', 'message'])

      expect((builder as any).url.searchParams.get('select')).toBe('id,message')
    })

    it('should accept array-based select spec after upsert', async () => {
      const builder = postgrest
        .from('messages')
        .upsert({ id: 1, message: 'test', username: 'test', channel_id: 1 })
        .select(['id', 'message'])

      expect((builder as any).url.searchParams.get('select')).toBe('id,message')
    })
  })
})

describe('Array-based select without typed Database (any schema)', () => {
  // Using any schema by not providing Database type
  const postgrest = new PostgrestClient('http://localhost:54321/rest/v1')

  describe('PostgrestQueryBuilder.select()', () => {
    it('should accept array-based select spec', () => {
      const builder = (postgrest as any).from('users').select(['username', 'status'])
      expect((builder as any).url.searchParams.get('select')).toBe('username,status')
    })

    it('should accept string-based select spec (backward compat)', () => {
      const builder = (postgrest as any).from('users').select('username, status')
      expect((builder as any).url.searchParams.get('select')).toBe('username,status')
    })

    it('should serialize complex queries without type information', () => {
      const builder = (postgrest as any)
        .from('users')
        .select([
          'id',
          { column: 'name', as: 'display_name' },
          { column: 'data', json: ['settings', 'theme'] },
          { relation: 'posts', inner: true, select: ['id', 'title'] },
          { spread: true, relation: 'profile', select: ['status'] },
          { count: true, as: 'total' },
        ])
      expect((builder as any).url.searchParams.get('select')).toBe(
        'id,display_name:name,data->settings->theme,posts!inner(id,title),...profile(status),total:count()'
      )
    })
  })
})

describe('Whitespace handling', () => {
  const postgrest = new PostgrestClient<Database>(REST_URL)

  it('should remove whitespace from array-based select (after serialization)', () => {
    // The serializer doesn't add whitespace, but the whitespace cleaner still runs
    const builder = postgrest.from('users').select(['username', 'status'])
    expect((builder as any).url.searchParams.get('select')).toBe('username,status')
  })

  it('should remove whitespace from string-based select', () => {
    const builder = postgrest.from('users').select('username,    status')
    expect((builder as any).url.searchParams.get('select')).toBe('username,status')
  })

  it('should preserve whitespace in quoted identifiers', () => {
    const builder = postgrest.from('users').select('"column name"')
    expect((builder as any).url.searchParams.get('select')).toBe('"column name"')
  })
})

describe('Options handling', () => {
  const postgrest = new PostgrestClient<Database>(REST_URL)

  it('should respect head option with array select', () => {
    const builder = postgrest.from('users').select(['username'], { head: true })
    expect((builder as any).method).toBe('HEAD')
    expect((builder as any).url.searchParams.get('select')).toBe('username')
  })

  it('should respect count option with array select', () => {
    const builder = postgrest.from('users').select(['username'], { count: 'exact' })
    expect((builder as any).headers.get('Prefer')).toContain('count=exact')
    expect((builder as any).url.searchParams.get('select')).toBe('username')
  })

  it('should respect both head and count options with array select', () => {
    const builder = postgrest.from('users').select(['username'], { head: true, count: 'exact' })
    expect((builder as any).method).toBe('HEAD')
    expect((builder as any).headers.get('Prefer')).toContain('count=exact')
    expect((builder as any).url.searchParams.get('select')).toBe('username')
  })
})
