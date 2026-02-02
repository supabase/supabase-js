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
  column: string
  as?: string
  cast?: string
  json?: string[]
  jsonText?: string[]
  aggregate?: AggregateFunction
}

// Relation/join selection
interface RelationSpec {
  relation: string
  as?: string
  hint?: string
  inner?: boolean
  left?: boolean
  select: SelectSpec
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

// Single item in select array
type SelectItem = string | FieldSpec | RelationSpec | SpreadSpec | CountSpec

// Full select specification
type SelectSpec = string | SelectItem[]
```

## Feature Coverage

| Feature            | String Syntax           | Array Syntax                  |
| ------------------ | ----------------------- | ----------------------------- |
| Simple columns     | `'id, name'`            | `['id', 'name']`              |
| Column alias       | `'display:username'`    | `{ column, as }`              |
| Type cast          | `'col::text'`           | `{ column, cast }`            |
| JSON path (->)     | `'data->foo'`           | `{ column, json: [...] }`     |
| JSON as text (->>) | `'data->>foo'`          | `{ column, jsonText: [...] }` |
| Column aggregate   | `'id.sum()'`            | `{ column, aggregate }`       |
| Top-level count    | `'count()'`             | `{ count: true }`             |
| Relation (join)    | `'posts(id)'`           | `{ relation, select }`        |
| Relation alias     | `'author:users(id)'`    | `{ relation, as, select }`    |
| Inner join         | `'posts!inner(id)'`     | `{ relation, inner: true }`   |
| Left join          | `'posts!left(id)'`      | `{ relation, left: true }`    |
| FK hint            | `'users!fk_id(id)'`     | `{ relation, hint }`          |
| Spread             | `'...profile(status)'`  | `{ spread: true, relation }`  |
| Nested relations   | `'posts(comments(id))'` | nested `select` arrays        |

## Files Created/Modified

### New Files

- `src/select-query-parser/select-builder.ts` - Types and serialization
- `test/select-builder.test.ts` - Unit tests (56 tests)
- `test/select-builder-integration.test.ts` - Integration tests (24 tests)
- `test/select-builder.test-d.ts` - Type tests

### Modified Files

- `src/PostgrestQueryBuilder.ts` - Accept array in `select()`
- `src/PostgrestTransformBuilder.ts` - Accept array in `select()`
- `src/index.ts` - Export new types
