# PostgREST Integration Tests

Integration tests for `@supabase/postgrest-js` running against Supabase CLI infrastructure.

## Directory Structure

```
postgrest/
├── standard/          # Standard PostgREST tests (Phase 2)
│   ├── basic.test.ts
│   ├── filters.test.ts
│   ├── relationships*.test.ts
│   ├── rpc.test.ts
│   └── ...
└── v12/              # PostgREST v12 compatibility tests (Phase 3)
```

## Standard Tests

### basic.test.ts

Core query operations:

- Basic SELECT queries
- INSERT operations
- UPDATE operations
- DELETE operations
- UPSERT operations
- COUNT queries

### filters.test.ts

Query filtering and operators:

- Equality filters (eq, neq)
- Comparison filters (gt, gte, lt, lte)
- Pattern matching (like, ilike)
- Range queries (in, contains)
- Full-text search (textSearch)
- Logic operators (and, or, not)

### relationships\*.test.ts

Relationship handling across multiple test files:

- **relationships.test.ts**: Basic relationship queries
- **relationships-join-operations.test.ts**: JOIN operations between tables
- **relationships-aggregate-operations.test.ts**: Aggregate functions with relationships
- **relationships-spread-operations.test.ts**: Spread operators in queries
- **relationships-error-handling.test.ts**: Error scenarios

### resource-embedding.test.ts

Resource embedding and nested queries:

- Embedding related resources
- Nested selects
- Deep nesting
- Hint disambiguation

### rpc.test.ts & advanced_rpc.test.ts

Remote Procedure Call (RPC) tests:

- Function invocation
- Parameter passing
- Return types
- Error handling
- Advanced RPC scenarios

### embeded_functions_join.test.ts

Computed fields and function joins:

- Table functions
- Computed columns
- Function-based relationships

### transforms.test.ts

Data transformation:

- Response formats (JSON, CSV)
- Column selection
- Aliasing
- Type coercion

### Other Tests

- **fetch-errors.test.ts**: HTTP error handling
- **max-affected.test.ts**: Row count limits
- **timeout-and-url-length.test.ts**: Timeout and URL validation
- **version-and-constants.test.ts**: Version checking

## Running Tests

```bash
# Run all standard postgrest tests
nx test:e2e:postgrest:standard e2e-tests

# Run specific test file
cd e2e-tests
npm run jest tests/postgrest/standard/basic.test.ts

# Run with coverage
nx test:e2e:postgrest:standard e2e-tests -- --coverage

# Run v12 compatibility tests (Phase 3)
nx test:e2e:postgrest:v12 e2e-tests
```

## Test Setup

Tests use shared helpers from `/e2e-tests/helpers/postgrest-client.ts`:

- `createPostgrestClient<Database>()` - Creates client with anon key (respects RLS)
- `createServiceRolePostgrestClient<Database>()` - Creates client with service_role key (bypasses RLS)
- `getPostgrestInfo()` - Get connection details
- `REST_URL_EXPORT` - REST API URL

## Database Schema

Tests run against the consolidated schema in `/e2e-tests/supabase/migrations/00000000000001_postgrest_schema.sql`:

**Tables**:

- `users` - User records with status, age_range, catchphrase
- `channels` - Communication channels
- `messages` - Messages in channels
- `user_profiles` - User profile details
- `best_friends` - Multi-relation example
- `collections` - Self-referencing table
- `products`, `categories`, `product_categories` - Many-to-many relationship
- `shops` - PostGIS example
- `hotel`, `booking` - Nullable foreign key example
- And more...

**Schemas**:

- `public` - Main schema
- `personal` - Second schema for multi-schema tests

**Functions**:

- `get_status()` - Get user status
- `offline_user()` - Update user status
- `get_messages()` - Get messages (multiple overloads)
- Many more stored procedures

**Views**:

- `active_users` - Online users only
- `recent_messages` - Latest messages
- `updatable_view` - Updatable view example
- `non_updatable_view` - Non-updatable view example

## Type Definitions

Tests use TypeScript types from:

- `types.ts` - Base type definitions
- `types.override.ts` - Custom type overrides
- `types.generated.ts` - Generated types from database schema

These types provide full type safety for queries.

## Notes

- Tests run against local Supabase CLI (http://127.0.0.1:54321/rest/v1)
- Tests use anon key by default (RLS is respected)
- Tests use inline snapshots for response validation
- Tests run sequentially (`--runInBand`) to prevent race conditions
- Original tests location: `packages/core/postgrest-js/test/`

## Migration Status

✅ **Completed**: Standard postgrest-js tests migrated to e2e-tests

**Migrated Test Files (16)**:

- ✅ basic.test.ts (1,400+ lines - core operations)
- ✅ filters.test.ts (450+ lines - filtering)
- ✅ relationships.test.ts (400+ lines - basic relationships)
- ✅ relationships-join-operations.test.ts (850+ lines - JOINs)
- ✅ relationships-aggregate-operations.test.ts (200+ lines - aggregates)
- ✅ relationships-spread-operations.test.ts (250+ lines - spread ops)
- ✅ relationships-error-handling.test.ts (300+ lines - errors)
- ✅ resource-embedding.test.ts (450+ lines - embedding)
- ✅ embeded_functions_join.test.ts (1,100+ lines - function joins)
- ✅ advanced_rpc.test.ts (1,150+ lines - advanced RPC)
- ✅ rpc.test.ts (150+ lines - basic RPC)
- ✅ transforms.test.ts (340+ lines - transformations)
- ✅ fetch-errors.test.ts (175+ lines - error handling)
- ✅ max-affected.test.ts (230+ lines - row limits)
- ✅ timeout-and-url-length.test.ts (260+ lines - validation)
- ✅ version-and-constants.test.ts (40+ lines - version check)

**Type Files**:

- ✅ types.ts
- ✅ types.override.ts
- ✅ types.generated.ts

**Excluded** (for Phase 3):

- ❌ v12/ directory - PostgREST v12 compatibility tests
- ❌ \*.test-d.ts files - TypeScript type tests (not integration tests)

**Next Step**: Keep old tests running in CI alongside new e2e tests for validation period (1-2 weeks)
