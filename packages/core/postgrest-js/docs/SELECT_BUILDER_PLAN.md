# Plan: Add Array-Based Type-Safe select() API

## Overview

Add a new array-based API for `select()` that provides IDE autocomplete while maintaining full backward compatibility with the existing string-based API.

## Design: Hybrid Array API

Simple cases use strings, complex features use objects:

```typescript
// Simple - just column names
.select(['id', 'name', 'email'])

// With alias
.select(['id', { column: 'username', as: 'display_name' }])

// With relation
.select(['id', { relation: 'posts', select: ['id', 'title'] }])

// Complex - all features
.select([
  { column: 'created_at', cast: 'text' },
  { column: 'data', json: ['settings', 'theme'] },
  { relation: 'posts', hint: 'fk_author', inner: true, select: ['id'] },
  { spread: true, relation: 'profile', select: ['status'] },
  { count: true, as: 'total' }
])
```

## Type Definitions

```typescript
// Aggregate functions
type AggregateFunction = 'count' | 'sum' | 'avg' | 'min' | 'max'

// Field/column selection
interface FieldSpec {
  column: string // Column name (autocomplete from Row type)
  as?: string // Alias
  cast?: string // Type cast (::text, ::int4, etc.)
  json?: string[] // JSON path using -> (returns JSON)
  jsonText?: string[] // JSON path using ->> (returns text)
  aggregate?: AggregateFunction
}

// Relation/join selection
interface RelationSpec {
  relation: string // Relation name (autocomplete from Relationships)
  as?: string // Alias
  hint?: string // FK hint for disambiguation
  inner?: boolean // !inner join (filter parent if no match)
  left?: boolean // !left join (explicit, currently no-op in PostgREST)
  select: SelectSpec // Nested selection
}

// Spread operation
interface SpreadSpec {
  spread: true
  relation: string
  hint?: string
  select: SelectSpec
}

// Count shorthand
interface CountSpec {
  count: true
  as?: string
  cast?: string
}

// Single item in select array (no '*' - encourage explicit column selection)
type SelectItem = string | FieldSpec | RelationSpec | SpreadSpec | CountSpec

// Full select specification
type SelectSpec = string | SelectItem[] // string for backward compat only
```

## Feature Coverage

| #                                                 | Feature            | String Syntax           | Array Key(s)                  |
| ------------------------------------------------- | ------------------ | ----------------------- | ----------------------------- |
| [1](#1-simple-column-selection)                   | Simple columns     | `'id, name'`            | `['id', 'name']`              |
| [2](#2-star-selection-not-supported-in-array-api) | Star selection     | `'*'`                   | _(not supported)_             |
| [3](#3-column-alias)                              | Column alias       | `'display:username'`    | `{ column, as }`              |
| [4](#4-type-cast)                                 | Type cast          | `'col::text'`           | `{ column, cast }`            |
| [5](#5-json-path-access--)                        | JSON path (->)     | `'data->foo'`           | `{ column, json: [...] }`     |
| [6](#6-json-path-as-text--)                       | JSON as text (->>) | `'data->>foo'`          | `{ column, jsonText: [...] }` |
| [7](#7-column-aggregate)                          | Column aggregate   | `'id.sum()'`            | `{ column, aggregate }`       |
| [8](#8-top-level-count)                           | Top-level count    | `'count()'`             | `{ count: true }`             |
| [9](#9-embedded-relation-join)                    | Relation (join)    | `'posts(id)'`           | `{ relation, select }`        |
| [10](#10-relation-alias)                          | Relation alias     | `'author:users(id)'`    | `{ relation, as, select }`    |
| [11](#11-inner-join)                              | Inner join         | `'posts!inner(id)'`     | `{ relation, inner: true }`   |
| [12](#12-left-join-explicit)                      | Left join          | `'posts!left(id)'`      | `{ relation, left: true }`    |
| [13](#13-foreign-key-hint-disambiguation)         | FK hint            | `'users!fk_id(id)'`     | `{ relation, hint }`          |
| [14](#14-hint--inner-join)                        | Hint + inner       | `'users!fk!inner(id)'`  | `{ relation, hint, inner }`   |
| [15](#15-spread-relation)                         | Spread             | `'...profile(status)'`  | `{ spread: true, relation }`  |
| [16](#16-spread-with-hint)                        | Spread + hint      | `'...users!fk(name)'`   | `{ spread, relation, hint }`  |
| [17](#17-nested-relations)                        | Nested relations   | `'posts(comments(id))'` | nested `select` arrays        |
| [18](#18-complex-combined-example)                | Combined           | _(see example)_         | _(see example)_               |

---

## Feature Examples

### 1. Simple Column Selection

```typescript
// String syntax
.select('id, name, email')

// Array syntax
.select(['id', 'name', 'email'])
```

### 2. Star Selection (Not Supported in Array API)

```typescript
// String syntax (still works for backward compat)
.select('*')

// Array syntax - must use explicit columns instead
.select(['id', 'name', 'email', 'created_at'])
```

### 3. Column Alias

```typescript
// String: display_name:username
.select('display_name:username')

// Array
.select([{ column: 'username', as: 'display_name' }])

// Combined with other columns
.select(['id', { column: 'username', as: 'display_name' }, 'email'])
```

### 4. Type Cast

```typescript
// String: created_at::text
.select('created_at::text')

// Array
.select([{ column: 'created_at', cast: 'text' }])

// Cast with alias: creation_date:created_at::text
.select([{ column: 'created_at', as: 'creation_date', cast: 'text' }])
```

### 5. JSON Path Access (->)

```typescript
// String: data->settings->theme (returns JSON)
.select('data->settings->theme')

// Array
.select([{ column: 'data', json: ['settings', 'theme'] }])

// With alias: theme:data->settings->theme
.select([{ column: 'data', as: 'theme', json: ['settings', 'theme'] }])
```

### 6. JSON Path as Text (->>)

```typescript
// String: data->>name (returns text)
.select('data->>name')

// Array
.select([{ column: 'data', jsonText: ['name'] }])

// Deep path with text: data->settings->>theme
.select([{ column: 'data', jsonText: ['settings', 'theme'] }])
```

### 7. Column Aggregate

```typescript
// String: id.sum()
.select('id.sum()')

// Array
.select([{ column: 'id', aggregate: 'sum' }])

// With alias: total_amount:amount.sum()
.select([{ column: 'amount', as: 'total_amount', aggregate: 'sum' }])

// All aggregate functions: count, sum, avg, min, max
.select([
  { column: 'id', aggregate: 'count' },
  { column: 'amount', aggregate: 'sum' },
  { column: 'price', aggregate: 'avg' },
  { column: 'quantity', aggregate: 'min' },
  { column: 'total', aggregate: 'max' }
])
```

### 8. Top-Level Count

```typescript
// String: count()
.select('count()')

// Array
.select([{ count: true }])

// With alias: total:count()
.select([{ count: true, as: 'total' }])

// With cast: count()::text
.select([{ count: true, cast: 'text' }])
```

### 9. Embedded Relation (Join)

```typescript
// String: posts(id, title)
.select('posts(id, title)')

// Array
.select([{ relation: 'posts', select: ['id', 'title'] }])

// With parent columns
.select([
  'id',
  'name',
  { relation: 'posts', select: ['id', 'title', 'created_at'] }
])
```

### 10. Relation Alias

```typescript
// String: author:users(id, name)
.select('author:users(id, name)')

// Array
.select([{ relation: 'users', as: 'author', select: ['id', 'name'] }])
```

### 11. Inner Join

```typescript
// String: posts!inner(id, title)
// Only returns parent rows that have matching posts
.select('posts!inner(id, title)')

// Array
.select([{ relation: 'posts', inner: true, select: ['id', 'title'] }])
```

### 12. Left Join (Explicit)

```typescript
// String: posts!left(id, title)
// Currently a no-op in PostgREST (left join is default), but explicit
.select('posts!left(id, title)')

// Array
.select([{ relation: 'posts', left: true, select: ['id', 'title'] }])
```

### 13. Foreign Key Hint (Disambiguation)

```typescript
// String: users!author_id(id, name)
// When table has multiple FKs to same table, specify which one
.select('users!author_id(id, name)')

// Array
.select([{ relation: 'users', hint: 'author_id', select: ['id', 'name'] }])

// Full FK name hint
.select([{ relation: 'users', hint: 'posts_author_id_fkey', select: ['id', 'name'] }])
```

### 14. Hint + Inner Join

```typescript
// String: users!author_id!inner(id, name)
.select('users!author_id!inner(id, name)')

// Array
.select([{ relation: 'users', hint: 'author_id', inner: true, select: ['id', 'name'] }])
```

### 15. Spread Relation

```typescript
// String: ...profile(status, bio)
// Unpacks profile fields at current level instead of nesting
.select('...profile(status, bio)')

// Array
.select([{ spread: true, relation: 'profile', select: ['status', 'bio'] }])

// Combined with regular columns
.select([
  'id',
  'name',
  { spread: true, relation: 'profile', select: ['status', 'bio'] }
])
// Result: { id, name, status, bio } instead of { id, name, profile: { status, bio } }
```

### 16. Spread with Hint

```typescript
// String: ...users!author_id(username)
.select('...users!author_id(username)')

// Array
.select([{ spread: true, relation: 'users', hint: 'author_id', select: ['username'] }])
```

### 17. Nested Relations

```typescript
// String: posts(id, comments(id, text, author:users(name)))
.select('posts(id, comments(id, text, author:users(name)))')

// Array
.select([{
  relation: 'posts',
  select: [
    'id',
    {
      relation: 'comments',
      select: [
        'id',
        'text',
        { relation: 'users', as: 'author', select: ['name'] }
      ]
    }
  ]
}])
```

### 18. Complex Combined Example

```typescript
// String: id, display_name:name, config:data->settings, posts!inner(id, title, comment_count:comments(count()))
.select('id, display_name:name, config:data->settings, posts!inner(id, title, comment_count:comments(count()))')

// Array
.select([
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
        select: [{ count: true }]
      }
    ]
  }
])
```

## Files to Create/Modify

### New Files

1. `packages/core/postgrest-js/src/select-query-parser/select-builder.ts`

   - Type definitions for SelectSpec, FieldSpec, RelationSpec, etc.
   - `serializeSelect()` function to convert array to string

2. `packages/core/postgrest-js/src/select-query-parser/result-from-spec.ts`

   - Type inference for array-based specs (parallel to result.ts)

3. `packages/core/postgrest-js/test/select-builder.test.ts`

   - Unit tests for serialization

4. `packages/core/postgrest-js/test/select-builder.test-d.ts`
   - Type tests for inference

### Modified Files

1. `packages/core/postgrest-js/src/PostgrestQueryBuilder.ts`

   - Update `select()` to accept `SelectSpec` in addition to string
   - Call `serializeSelect()` when array is passed

2. `packages/core/postgrest-js/src/PostgrestTransformBuilder.ts`

   - Same changes for the chained `select()` after mutations

3. `packages/core/postgrest-js/src/index.ts`
   - Export new types

## Implementation Steps

### Phase 0: Setup

1. Copy this plan to `docs/SELECT_BUILDER_PLAN.md` in the repo root for reference

### Phase 1: Core Types and Serialization

1. Create `select-builder.ts` with type definitions
2. Implement `serializeSelect()` function
3. Add unit tests for all serialization cases

### Phase 2: Integration

1. Update `PostgrestQueryBuilder.select()` signature
2. Update `PostgrestTransformBuilder.select()` signature
3. Ensure string queries still work unchanged

### Phase 3: Type Inference (Full Inference)

1. Create `result-from-spec.ts` with `GetResultFromSpec` type
   - Process array items recursively like the string parser does
   - Handle all features: columns, aliases, casts, JSON paths, aggregates, relations, spreads
   - Return exact inferred types matching the string parser behavior
2. Connect to existing type system (reuse `TablesAndViews`, `GenericRelationship`, etc.)
3. Add type tests to verify inference matches string parser

### Phase 4: Polish

1. Export types from package index
2. Run full test suite
3. Update any affected type tests

## Verification

1. **Unit tests**: `nx test postgrest-js` - serialization correctness
2. **Type tests**: `nx test:types postgrest-js` - type inference
3. **Integration**: `nx test:ci:postgrest postgrest-js` - full test suite with Docker
