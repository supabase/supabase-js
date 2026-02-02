# Fluent Query Builder - TODOs

## Current Status

The fluent query builder is functional with basic features:
- `q().from('table').join('table').select().where().orderBy().limit()`
- Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `and`, `or`, `isNull`, `isNotNull`
- Query generation: `generateQuery()`, `toPostgrestQuery()`
- 30 passing tests

## Remaining Tasks

### 1. Schema-Based Type Inference
**Priority: High**

Add TypeScript type inference from database schema types so users get autocomplete and compile-time errors.

```typescript
// Goal: This should error if 'users' table doesn't have 'foo' column
q<Database>().from('users').select((users) => ({ x: users.foo }))
//                                                      ^^^ Error: Property 'foo' does not exist

// Goal: Table names should autocomplete from schema
q<Database>().from('use') // autocomplete suggests 'users'
```

Files to modify:
- `FluentQueryBuilder.ts` - Add schema generic parameter
- `proxy.ts` - Type proxies based on table columns
- Leverage existing types from `../types/common/common.ts`

### 2. Integration with PostgrestClient
**Priority: High**

Allow executing queries directly without manual conversion.

```typescript
// Option A: Add to PostgrestClient
const { data, error } = await supabase.q
  .from('users')
  .join('posts')
  .select((users, posts) => ({ name: users.name, title: posts.title }))

// Option B: Add execute() method to builder
const { data, error } = await q()
  .from('users')
  .execute(supabaseClient)
```

Files to modify:
- `FluentQueryBuilder.ts` - Add `execute()` method
- `PostgrestClient.ts` - Add `q` property (optional)

### 3. Wire isNull/isNotNull in Query Generator
**Priority: Medium**

The operators exist but aren't fully wired in the query generator for `where()` clauses.

```typescript
q().from('users').where((users) => isNull(users.deletedAt))
// Should generate: /users?deletedAt=is.null
```

Files to modify:
- `query-generator.ts` - Handle `IsNullCondition` and `IsNotNullCondition` in `conditionToFilter()`

### 4. Add offset() for Pagination
**Priority: Medium**

```typescript
q().from('users').limit(10).offset(20)
// Should generate: /users?limit=10&offset=20
```

Files to modify:
- `types.ts` - Add `offset` to `QueryBuilderState`
- `FluentQueryBuilder.ts` - Add `offset()` method
- `query-generator.ts` - Include offset in output

### 5. Add single() / maybeSingle() Modifiers
**Priority: Medium**

```typescript
q().from('users').where((users) => eq(users.id, 1)).single()
// Should set Accept header to return single object instead of array
```

Files to modify:
- `types.ts` - Add `returnType` to state ('array' | 'single' | 'maybeSingle')
- `FluentQueryBuilder.ts` - Add `single()` and `maybeSingle()` methods
- `query-generator.ts` - Include in `GeneratedQuery`

### 6. Add Inner Join Hint (!inner)
**Priority: Low**

PostgREST supports `!inner` to filter out null relationships.

```typescript
q().from('users').innerJoin('posts').select(...)
// Should generate: /users?select=posts!inner(...)
```

Files to modify:
- `types.ts` - Add `inner` flag to `JoinedTable`
- `FluentQueryBuilder.ts` - Add `innerJoin()` method or option to `join()`
- `query-generator.ts` - Include `!inner` hint in select

### 7. Add in() Operator
**Priority: Low**

```typescript
q().from('users').where((users) => in_(users.role, ['admin', 'mod']))
// Should generate: /users?role=in.(admin,mod)
```

Files to modify:
- `types.ts` - Add `InCondition` type
- `operators.ts` - Add `in_()` function (underscore to avoid JS keyword)
- `query-generator.ts` - Handle `InCondition`

### 8. Add like/ilike Operators
**Priority: Low**

```typescript
q().from('users').where((users) => like(users.name, '%john%'))
// Should generate: /users?name=like.*john*
```

Files to modify:
- `types.ts` - Add `LikeCondition` type
- `operators.ts` - Add `like()` and `ilike()` functions
- `query-generator.ts` - Handle pattern conversion

---

## Testing Notes

Run tests with:
```bash
cd packages/core/postgrest-js
npx jest test/fluent-query-builder.test.ts
```

All new features should have corresponding tests in `test/fluent-query-builder.test.ts`.
