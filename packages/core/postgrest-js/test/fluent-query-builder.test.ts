import {
  q,
  eq,
  neq,
  gt,
  gte,
  lt,
  lte,
  and,
  or,
  isNull,
  isNotNull,
  generateQuery,
  toPostgrestQuery,
} from '../src/fluent-query-builder'

/**
 * Helper to build query and convert to PostgREST URL in one step
 */
function toUrl(builder: ReturnType<typeof q>): string {
  return toPostgrestQuery(generateQuery(builder.getState()))
}

describe('FluentQueryBuilder - PostgREST Query Generation', () => {
  describe('basic queries', () => {
    it('should generate simple table query', () => {
      const query = q().from('users')
      expect(toUrl(query)).toBe('/users')
    })

    it('should generate query with select fields', () => {
      const query = q()
        .from('users')
        .select((users) => ({
          name: users.name,
          email: users.email,
        }))

      expect(toUrl(query)).toBe('/users?select=name,email')
    })
  })

  describe('joins', () => {
    it('should generate query with single join', () => {
      const query = q()
        .from('users')
        .join('posts')
        .select((users, posts) => ({
          userName: users.name,
          postTitle: posts.title,
        }))

      expect(toUrl(query)).toBe('/users?select=name,posts(title)')
    })

    it('should generate query with multiple joins', () => {
      const query = q()
        .from('users')
        .join('posts')
        .join('comments')
        .select((users, posts, comments) => ({
          userName: users.name,
          postTitle: posts.title,
          commentText: comments.text,
        }))

      expect(toUrl(query)).toBe('/users?select=name,posts(title),comments(text)')
    })

    it('should generate query with join disambiguation hint', () => {
      const query = q()
        .from('users')
        .join('messages', (users, messages) => eq(users.id, messages.senderId))
        .select((users, messages) => ({
          userName: users.name,
          messageContent: messages.content,
        }))

      expect(toUrl(query)).toBe('/users?select=name,messages!senderId(content)')
    })
  })

  describe('filters', () => {
    it('should generate query with eq filter', () => {
      const query = q()
        .from('users')
        .where((users) => eq(users.status, 'active'))

      expect(toUrl(query)).toBe('/users?status=eq.active')
    })

    it('should generate query with neq filter', () => {
      const query = q()
        .from('users')
        .where((users) => neq(users.status, 'deleted'))

      expect(toUrl(query)).toBe('/users?status=neq.deleted')
    })

    it('should generate query with gt filter', () => {
      const query = q()
        .from('users')
        .where((users) => gt(users.age, 18))

      expect(toUrl(query)).toBe('/users?age=gt.18')
    })

    it('should generate query with gte filter', () => {
      const query = q()
        .from('users')
        .where((users) => gte(users.age, 21))

      expect(toUrl(query)).toBe('/users?age=gte.21')
    })

    it('should generate query with lt filter', () => {
      const query = q()
        .from('users')
        .where((users) => lt(users.age, 65))

      expect(toUrl(query)).toBe('/users?age=lt.65')
    })

    it('should generate query with lte filter', () => {
      const query = q()
        .from('users')
        .where((users) => lte(users.score, 100))

      expect(toUrl(query)).toBe('/users?score=lte.100')
    })

    it('should generate query with multiple filters', () => {
      const query = q()
        .from('users')
        .where((users) => eq(users.status, 'active'))
        .where((users) => gt(users.age, 18))

      expect(toUrl(query)).toBe('/users?status=eq.active&age=gt.18')
    })

    it('should generate query with OR filter', () => {
      const query = q()
        .from('users')
        .where((users) => or(eq(users.role, 'admin'), eq(users.role, 'moderator')))

      expect(toUrl(query)).toBe('/users?or=(role.eq.admin,role.eq.moderator)')
    })

    it('should generate query with AND filter', () => {
      const query = q()
        .from('users')
        .where((users) => and(eq(users.status, 'active'), gt(users.age, 18)))

      // AND is implicit in PostgREST - multiple conditions are ANDed
      expect(toUrl(query)).toBe('/users?status=eq.active&age=gt.18')
    })
  })

  describe('ordering', () => {
    it('should generate query with ascending order (default)', () => {
      const query = q()
        .from('users')
        .orderBy((users) => users.createdAt)

      expect(toUrl(query)).toBe('/users?order=createdAt')
    })

    it('should generate query with descending order', () => {
      const query = q()
        .from('users')
        .orderBy((users) => users.createdAt, { ascending: false })

      expect(toUrl(query)).toBe('/users?order=createdAt.desc')
    })

    it('should generate query with multiple order fields', () => {
      const query = q()
        .from('users')
        .orderBy((users) => users.lastName)
        .orderBy((users) => users.firstName)

      expect(toUrl(query)).toBe('/users?order=lastName,firstName')
    })
  })

  describe('limit', () => {
    it('should generate query with limit', () => {
      const query = q().from('users').limit(10)

      expect(toUrl(query)).toBe('/users?limit=10')
    })
  })

  describe('complete queries', () => {
    it('should generate complete query with all options', () => {
      const query = q()
        .from('users')
        .join('posts')
        .select((users, posts) => ({
          userName: users.name,
          postTitle: posts.title,
        }))
        .where((users) => eq(users.status, 'active'))
        .orderBy((users, posts) => posts.createdAt, { ascending: false })
        .limit(10)

      expect(toUrl(query)).toBe(
        '/users?select=name,posts(title)&status=eq.active&order=createdAt.desc&limit=10'
      )
    })

    it('should generate query matching original example syntax', () => {
      // This is the example from the original request
      const query = q()
        .from('users')
        .join('posts')
        .join('comments')
        .select((users, posts, comments) => ({
          userName: users.name,
          postTitle: posts.title,
          commentText: comments.text,
        }))

      expect(toUrl(query)).toBe('/users?select=name,posts(title),comments(text)')
    })
  })
})

describe('toPostgrestQuery', () => {
  it('should handle query with no parameters', () => {
    const result = toPostgrestQuery({
      table: 'users',
      select: '*',
      filters: {},
    })
    expect(result).toBe('/users')
  })

  it('should not encode special characters in select', () => {
    const result = toPostgrestQuery({
      table: 'users',
      select: 'name,posts(title,content)',
      filters: {},
    })
    expect(result).toBe('/users?select=name,posts(title,content)')
  })

  it('should include all query parameters', () => {
    const result = toPostgrestQuery({
      table: 'users',
      select: 'name',
      filters: { status: 'eq.active' },
      order: 'createdAt.desc',
      limit: 10,
    })
    expect(result).toBe('/users?select=name&status=eq.active&order=createdAt.desc&limit=10')
  })
})

describe('operators', () => {
  it('eq should create equality condition', () => {
    const field = { __type: 'FieldRef' as const, __tableAlias: 'users', __column: 'id' }
    const condition = eq(field, 5)
    expect(condition.__type).toBe('Condition')
    expect(condition.operator).toBe('=')
  })

  it('neq should create not-equal condition', () => {
    const field = { __type: 'FieldRef' as const, __tableAlias: 'users', __column: 'status' }
    const condition = neq(field, 'deleted')
    expect(condition.operator).toBe('!=')
  })

  it('gt/gte/lt/lte should create comparison conditions', () => {
    const field = { __type: 'FieldRef' as const, __tableAlias: 'users', __column: 'age' }
    expect(gt(field, 18).operator).toBe('>')
    expect(gte(field, 18).operator).toBe('>=')
    expect(lt(field, 65).operator).toBe('<')
    expect(lte(field, 65).operator).toBe('<=')
  })

  it('and should combine conditions', () => {
    const f1 = { __type: 'FieldRef' as const, __tableAlias: 'users', __column: 'a' }
    const f2 = { __type: 'FieldRef' as const, __tableAlias: 'users', __column: 'b' }
    const c1 = eq(f1, 1)
    const c2 = eq(f2, 2)

    const combined = and(c1, c2)
    expect(combined.__type).toBe('And')
    expect(combined.conditions).toHaveLength(2)
  })

  it('or should combine conditions', () => {
    const f1 = { __type: 'FieldRef' as const, __tableAlias: 'users', __column: 'a' }
    const f2 = { __type: 'FieldRef' as const, __tableAlias: 'users', __column: 'b' }
    const c1 = eq(f1, 1)
    const c2 = eq(f2, 2)

    const combined = or(c1, c2)
    expect(combined.__type).toBe('Or')
    expect(combined.conditions).toHaveLength(2)
  })

  it('isNull should create null check', () => {
    const field = { __type: 'FieldRef' as const, __tableAlias: 'users', __column: 'deletedAt' }
    const condition = isNull(field)
    expect(condition.__type).toBe('IsNull')
  })

  it('isNotNull should create not-null check', () => {
    const field = { __type: 'FieldRef' as const, __tableAlias: 'users', __column: 'email' }
    const condition = isNotNull(field)
    expect(condition.__type).toBe('IsNotNull')
  })
})
