import {
  serializeSelectSpec,
  SelectSpec,
  FieldSpec,
  RelationSpec,
  SpreadSpec,
  CountSpec,
} from '../src/select-query-parser/select-builder'

/**
 * Tests for the array-based select query builder.
 *
 * These tests verify that the serializeSelectSpec function correctly converts
 * array-based SelectSpec objects into PostgREST query string format.
 *
 * Each test case corresponds to a feature from the plan:
 * 1. Simple Column Selection
 * 2. Star Selection (Not Supported in Array API)
 * 3. Column Alias
 * 4. Type Cast
 * 5. JSON Path Access (->)
 * 6. JSON Path as Text (->>)
 * 7. Column Aggregate
 * 8. Top-Level Count
 * 9. Embedded Relation (Join)
 * 10. Relation Alias
 * 11. Inner Join
 * 12. Left Join (Explicit)
 * 13. Foreign Key Hint (Disambiguation)
 * 14. Hint + Inner Join
 * 15. Spread Relation
 * 16. Spread with Hint
 * 17. Nested Relations
 * 18. Complex Combined Example
 */

describe('serializeSelectSpec', () => {
  // ============================================================================
  // 1. Simple Column Selection
  // ============================================================================
  describe('1. Simple Column Selection', () => {
    it('should serialize simple column names', () => {
      const spec: SelectSpec = ['id', 'name', 'email']
      expect(serializeSelectSpec(spec)).toBe('id,name,email')
    })

    it('should serialize a single column', () => {
      const spec: SelectSpec = ['id']
      expect(serializeSelectSpec(spec)).toBe('id')
    })

    it('should pass through string specs unchanged', () => {
      const spec: SelectSpec = 'id, name, email'
      expect(serializeSelectSpec(spec)).toBe('id, name, email')
    })

    it('should pass through star selection as string', () => {
      // Star selection is only supported via string syntax
      const spec: SelectSpec = '*'
      expect(serializeSelectSpec(spec)).toBe('*')
    })
  })

  // ============================================================================
  // 2. Star Selection (Not Supported in Array API)
  // ============================================================================
  describe('2. Star Selection', () => {
    it('should pass through star as string (backward compat)', () => {
      const spec: SelectSpec = '*'
      expect(serializeSelectSpec(spec)).toBe('*')
    })

    it('should pass through mixed star and columns as string', () => {
      const spec: SelectSpec = '*, posts(id)'
      expect(serializeSelectSpec(spec)).toBe('*, posts(id)')
    })
  })

  // ============================================================================
  // 3. Column Alias
  // ============================================================================
  describe('3. Column Alias', () => {
    it('should serialize column with alias', () => {
      const spec: SelectSpec = [{ column: 'username', as: 'display_name' }]
      expect(serializeSelectSpec(spec)).toBe('display_name:username')
    })

    it('should serialize mixed columns and aliases', () => {
      const spec: SelectSpec = ['id', { column: 'username', as: 'display_name' }, 'email']
      expect(serializeSelectSpec(spec)).toBe('id,display_name:username,email')
    })
  })

  // ============================================================================
  // 4. Type Cast
  // ============================================================================
  describe('4. Type Cast', () => {
    it('should serialize column with type cast', () => {
      const spec: SelectSpec = [{ column: 'created_at', cast: 'text' }]
      expect(serializeSelectSpec(spec)).toBe('created_at::text')
    })

    it('should serialize column with alias and type cast', () => {
      const spec: SelectSpec = [{ column: 'created_at', as: 'creation_date', cast: 'text' }]
      expect(serializeSelectSpec(spec)).toBe('creation_date:created_at::text')
    })

    it('should serialize multiple columns with different casts', () => {
      const spec: SelectSpec = [
        { column: 'id', cast: 'text' },
        { column: 'created_at', cast: 'date' },
        { column: 'amount', cast: 'int4' },
      ]
      expect(serializeSelectSpec(spec)).toBe('id::text,created_at::date,amount::int4')
    })
  })

  // ============================================================================
  // 5. JSON Path Access (->)
  // ============================================================================
  describe('5. JSON Path Access (->)', () => {
    it('should serialize single-level JSON path', () => {
      const spec: SelectSpec = [{ column: 'data', json: ['settings'] }]
      expect(serializeSelectSpec(spec)).toBe('data->settings')
    })

    it('should serialize multi-level JSON path', () => {
      const spec: SelectSpec = [{ column: 'data', json: ['settings', 'theme'] }]
      expect(serializeSelectSpec(spec)).toBe('data->settings->theme')
    })

    it('should serialize JSON path with alias', () => {
      const spec: SelectSpec = [{ column: 'data', as: 'theme', json: ['settings', 'theme'] }]
      expect(serializeSelectSpec(spec)).toBe('theme:data->settings->theme')
    })

    it('should serialize deep JSON path', () => {
      const spec: SelectSpec = [{ column: 'data', json: ['a', 'b', 'c', 'd'] }]
      expect(serializeSelectSpec(spec)).toBe('data->a->b->c->d')
    })
  })

  // ============================================================================
  // 6. JSON Path as Text (->>)
  // ============================================================================
  describe('6. JSON Path as Text (->>) ', () => {
    it('should serialize single-level JSON text path', () => {
      const spec: SelectSpec = [{ column: 'data', jsonText: ['name'] }]
      expect(serializeSelectSpec(spec)).toBe('data->>name')
    })

    it('should serialize multi-level JSON text path (last uses ->>)', () => {
      const spec: SelectSpec = [{ column: 'data', jsonText: ['settings', 'theme'] }]
      expect(serializeSelectSpec(spec)).toBe('data->settings->>theme')
    })

    it('should serialize deep JSON text path', () => {
      const spec: SelectSpec = [{ column: 'data', jsonText: ['a', 'b', 'c'] }]
      expect(serializeSelectSpec(spec)).toBe('data->a->b->>c')
    })

    it('should serialize JSON text path with alias', () => {
      const spec: SelectSpec = [
        { column: 'data', as: 'theme_name', jsonText: ['settings', 'theme'] },
      ]
      expect(serializeSelectSpec(spec)).toBe('theme_name:data->settings->>theme')
    })
  })

  // ============================================================================
  // 7. Column Aggregate
  // ============================================================================
  describe('7. Column Aggregate', () => {
    it('should serialize column with sum aggregate', () => {
      const spec: SelectSpec = [{ column: 'id', aggregate: 'sum' }]
      expect(serializeSelectSpec(spec)).toBe('id.sum()')
    })

    it('should serialize column with count aggregate', () => {
      const spec: SelectSpec = [{ column: 'id', aggregate: 'count' }]
      expect(serializeSelectSpec(spec)).toBe('id.count()')
    })

    it('should serialize column with avg aggregate', () => {
      const spec: SelectSpec = [{ column: 'price', aggregate: 'avg' }]
      expect(serializeSelectSpec(spec)).toBe('price.avg()')
    })

    it('should serialize column with min aggregate', () => {
      const spec: SelectSpec = [{ column: 'quantity', aggregate: 'min' }]
      expect(serializeSelectSpec(spec)).toBe('quantity.min()')
    })

    it('should serialize column with max aggregate', () => {
      const spec: SelectSpec = [{ column: 'total', aggregate: 'max' }]
      expect(serializeSelectSpec(spec)).toBe('total.max()')
    })

    it('should serialize aggregate with alias', () => {
      const spec: SelectSpec = [{ column: 'amount', as: 'total_amount', aggregate: 'sum' }]
      expect(serializeSelectSpec(spec)).toBe('total_amount:amount.sum()')
    })

    it('should serialize aggregate with cast', () => {
      const spec: SelectSpec = [{ column: 'id', aggregate: 'count', cast: 'int4' }]
      expect(serializeSelectSpec(spec)).toBe('id.count()::int4')
    })

    it('should serialize multiple aggregates', () => {
      const spec: SelectSpec = [
        { column: 'id', aggregate: 'count' },
        { column: 'amount', aggregate: 'sum' },
        { column: 'price', aggregate: 'avg' },
      ]
      expect(serializeSelectSpec(spec)).toBe('id.count(),amount.sum(),price.avg()')
    })
  })

  // ============================================================================
  // 8. Top-Level Count
  // ============================================================================
  describe('8. Top-Level Count', () => {
    it('should serialize simple count', () => {
      const spec: SelectSpec = [{ count: true }]
      expect(serializeSelectSpec(spec)).toBe('count()')
    })

    it('should serialize count with alias', () => {
      const spec: SelectSpec = [{ count: true, as: 'total' }]
      expect(serializeSelectSpec(spec)).toBe('total:count()')
    })

    it('should serialize count with cast', () => {
      const spec: SelectSpec = [{ count: true, cast: 'text' }]
      expect(serializeSelectSpec(spec)).toBe('count()::text')
    })

    it('should serialize count with alias and cast', () => {
      const spec: SelectSpec = [{ count: true, as: 'total', cast: 'int4' }]
      expect(serializeSelectSpec(spec)).toBe('total:count()::int4')
    })
  })

  // ============================================================================
  // 9. Embedded Relation (Join)
  // ============================================================================
  describe('9. Embedded Relation (Join)', () => {
    it('should serialize simple relation', () => {
      const spec: SelectSpec = [{ relation: 'posts', select: ['id', 'title'] }]
      expect(serializeSelectSpec(spec)).toBe('posts(id,title)')
    })

    it('should serialize relation with parent columns', () => {
      const spec: SelectSpec = [
        'id',
        'name',
        { relation: 'posts', select: ['id', 'title', 'created_at'] },
      ]
      expect(serializeSelectSpec(spec)).toBe('id,name,posts(id,title,created_at)')
    })

    it('should serialize multiple relations', () => {
      const spec: SelectSpec = [
        'id',
        { relation: 'posts', select: ['id'] },
        { relation: 'comments', select: ['text'] },
      ]
      expect(serializeSelectSpec(spec)).toBe('id,posts(id),comments(text)')
    })
  })

  // ============================================================================
  // 10. Relation Alias
  // ============================================================================
  describe('10. Relation Alias', () => {
    it('should serialize relation with alias', () => {
      const spec: SelectSpec = [{ relation: 'users', as: 'author', select: ['id', 'name'] }]
      expect(serializeSelectSpec(spec)).toBe('author:users(id,name)')
    })

    it('should serialize multiple aliased relations', () => {
      const spec: SelectSpec = [
        { relation: 'users', as: 'author', select: ['name'] },
        { relation: 'users', as: 'editor', select: ['name'] },
      ]
      expect(serializeSelectSpec(spec)).toBe('author:users(name),editor:users(name)')
    })
  })

  // ============================================================================
  // 11. Inner Join
  // ============================================================================
  describe('11. Inner Join', () => {
    it('should serialize inner join', () => {
      const spec: SelectSpec = [{ relation: 'posts', inner: true, select: ['id', 'title'] }]
      expect(serializeSelectSpec(spec)).toBe('posts!inner(id,title)')
    })

    it('should serialize inner join with parent columns', () => {
      const spec: SelectSpec = ['id', 'name', { relation: 'posts', inner: true, select: ['id'] }]
      expect(serializeSelectSpec(spec)).toBe('id,name,posts!inner(id)')
    })
  })

  // ============================================================================
  // 12. Left Join (Explicit)
  // ============================================================================
  describe('12. Left Join (Explicit)', () => {
    it('should serialize left join', () => {
      const spec: SelectSpec = [{ relation: 'posts', left: true, select: ['id', 'title'] }]
      expect(serializeSelectSpec(spec)).toBe('posts!left(id,title)')
    })
  })

  // ============================================================================
  // 13. Foreign Key Hint (Disambiguation)
  // ============================================================================
  describe('13. Foreign Key Hint (Disambiguation)', () => {
    it('should serialize relation with FK hint', () => {
      const spec: SelectSpec = [{ relation: 'users', hint: 'author_id', select: ['id', 'name'] }]
      expect(serializeSelectSpec(spec)).toBe('users!author_id(id,name)')
    })

    it('should serialize relation with full FK name hint', () => {
      const spec: SelectSpec = [
        { relation: 'users', hint: 'posts_author_id_fkey', select: ['id', 'name'] },
      ]
      expect(serializeSelectSpec(spec)).toBe('users!posts_author_id_fkey(id,name)')
    })
  })

  // ============================================================================
  // 14. Hint + Inner Join
  // ============================================================================
  describe('14. Hint + Inner Join', () => {
    it('should serialize hint with inner join', () => {
      const spec: SelectSpec = [
        { relation: 'users', hint: 'author_id', inner: true, select: ['id', 'name'] },
      ]
      expect(serializeSelectSpec(spec)).toBe('users!author_id!inner(id,name)')
    })

    it('should serialize aliased hint with inner join', () => {
      const spec: SelectSpec = [
        { relation: 'users', as: 'author', hint: 'author_id', inner: true, select: ['id'] },
      ]
      expect(serializeSelectSpec(spec)).toBe('author:users!author_id!inner(id)')
    })
  })

  // ============================================================================
  // 15. Spread Relation
  // ============================================================================
  describe('15. Spread Relation', () => {
    it('should serialize spread relation', () => {
      const spec: SelectSpec = [{ spread: true, relation: 'profile', select: ['status', 'bio'] }]
      expect(serializeSelectSpec(spec)).toBe('...profile(status,bio)')
    })

    it('should serialize spread with regular columns', () => {
      const spec: SelectSpec = [
        'id',
        'name',
        { spread: true, relation: 'profile', select: ['status', 'bio'] },
      ]
      expect(serializeSelectSpec(spec)).toBe('id,name,...profile(status,bio)')
    })
  })

  // ============================================================================
  // 16. Spread with Hint
  // ============================================================================
  describe('16. Spread with Hint', () => {
    it('should serialize spread with FK hint', () => {
      const spec: SelectSpec = [
        { spread: true, relation: 'users', hint: 'author_id', select: ['username'] },
      ]
      expect(serializeSelectSpec(spec)).toBe('...users!author_id(username)')
    })
  })

  // ============================================================================
  // 17. Nested Relations
  // ============================================================================
  describe('17. Nested Relations', () => {
    it('should serialize nested relations', () => {
      const spec: SelectSpec = [
        {
          relation: 'posts',
          select: [
            'id',
            {
              relation: 'comments',
              select: ['id', 'text', { relation: 'users', as: 'author', select: ['name'] }],
            },
          ],
        },
      ]
      expect(serializeSelectSpec(spec)).toBe('posts(id,comments(id,text,author:users(name)))')
    })

    it('should serialize deeply nested relations', () => {
      const spec: SelectSpec = [
        {
          relation: 'a',
          select: [
            {
              relation: 'b',
              select: [
                {
                  relation: 'c',
                  select: ['id'],
                },
              ],
            },
          ],
        },
      ]
      expect(serializeSelectSpec(spec)).toBe('a(b(c(id)))')
    })
  })

  // ============================================================================
  // 18. Complex Combined Example
  // ============================================================================
  describe('18. Complex Combined Example', () => {
    it('should serialize complex query with multiple features', () => {
      const spec: SelectSpec = [
        'id',
        { column: 'name', as: 'display_name' },
        { column: 'data', as: 'config', json: ['settings'] },
        {
          relation: 'posts',
          inner: true,
          select: [
            'id',
            'title',
            {
              relation: 'comments',
              as: 'comment_count',
              select: [{ count: true }],
            },
          ],
        },
      ]
      expect(serializeSelectSpec(spec)).toBe(
        'id,display_name:name,config:data->settings,posts!inner(id,title,comment_count:comments(count()))'
      )
    })

    it('should serialize another complex query', () => {
      const spec: SelectSpec = [
        'id',
        { column: 'created_at', cast: 'text' },
        { column: 'data', json: ['settings', 'theme'] },
        { relation: 'posts', hint: 'fk_author', inner: true, select: ['id'] },
        { spread: true, relation: 'profile', select: ['status'] },
        { count: true, as: 'total' },
      ]
      expect(serializeSelectSpec(spec)).toBe(
        'id,created_at::text,data->settings->theme,posts!fk_author!inner(id),...profile(status),total:count()'
      )
    })

    it('should handle all features in one query', () => {
      const spec: SelectSpec = [
        'simple_col',
        { column: 'aliased_col', as: 'alias' },
        { column: 'casted_col', cast: 'text' },
        { column: 'json_col', json: ['path'] },
        { column: 'json_text_col', jsonText: ['path'] },
        { column: 'agg_col', aggregate: 'sum' },
        { count: true },
        { relation: 'rel', select: ['id'] },
        { relation: 'aliased_rel', as: 'ar', select: ['id'] },
        { relation: 'inner_rel', inner: true, select: ['id'] },
        { relation: 'left_rel', left: true, select: ['id'] },
        { relation: 'hint_rel', hint: 'fk', select: ['id'] },
        { relation: 'hint_inner_rel', hint: 'fk', inner: true, select: ['id'] },
        { spread: true, relation: 'spread_rel', select: ['id'] },
        { spread: true, relation: 'spread_hint_rel', hint: 'fk', select: ['id'] },
      ]
      expect(serializeSelectSpec(spec)).toBe(
        'simple_col,' +
          'alias:aliased_col,' +
          'casted_col::text,' +
          'json_col->path,' +
          'json_text_col->>path,' +
          'agg_col.sum(),' +
          'count(),' +
          'rel(id),' +
          'ar:aliased_rel(id),' +
          'inner_rel!inner(id),' +
          'left_rel!left(id),' +
          'hint_rel!fk(id),' +
          'hint_inner_rel!fk!inner(id),' +
          '...spread_rel(id),' +
          '...spread_hint_rel!fk(id)'
      )
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle empty array', () => {
      const spec: SelectSpec = []
      expect(serializeSelectSpec(spec)).toBe('')
    })

    it('should handle empty string', () => {
      const spec: SelectSpec = ''
      expect(serializeSelectSpec(spec)).toBe('')
    })

    it('should handle relation with string select (backward compat)', () => {
      const spec: SelectSpec = [{ relation: 'posts', select: 'id, title' }]
      expect(serializeSelectSpec(spec)).toBe('posts(id, title)')
    })

    it('should handle relation with empty select', () => {
      const spec: SelectSpec = [{ relation: 'posts', select: [] }]
      expect(serializeSelectSpec(spec)).toBe('posts()')
    })

    it('should handle column without any options', () => {
      const spec: SelectSpec = [{ column: 'id' }]
      expect(serializeSelectSpec(spec)).toBe('id')
    })
  })
})
