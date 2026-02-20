# Supabase-js Integration Tests

Integration tests for `@supabase/supabase-js` (the main client) running against the shared
Supabase CLI infrastructure.

## Test Files

### integration.test.ts (~446 lines)

End-to-end tests for the unified Supabase client covering all services:

- **Supabase Integration** — Basic client connectivity
- **PostgREST** — Select, insert, delete via `supabase.from()`
- **PostgreSQL RLS** — Row-Level Security enforcement across users
- **Authentication** — Sign up, sign in, sign out, invalid credentials
- **Realtime** — WebSocket broadcast with vsn 1.0.0 and 2.0.0
- **Storage API** — Upload, list, and delete files
- **PostgREST Timeout Configuration** — Client creation with custom db options
- **Custom JWT / Realtime** — Connecting with a custom-signed JWT access token

## Running Tests

```bash
# Run all supabase-js integration tests
nx test:e2e:supabase e2e-tests

# Run specific test file
cd e2e-tests
npm run jest tests/supabase/integration.test.ts

# Run with coverage
nx test:e2e:supabase e2e-tests -- --coverage
```

## Test Setup

Tests use shared helpers from `/e2e-tests/helpers/supabase-client.ts`:

- `createRealtimeClient(realtimeOptions?, options?)` — Client with WebSocket support
- `createServiceRoleClient(options?)` — Client bypassing RLS via service_role key
- `getConnectionInfo()` — Returns `{ url, anonKey, serviceRoleKey, jwtSecret }`

## Database Schema

Tests rely on the `todos` table created in migration
`/e2e-tests/supabase/migrations/00000000000003_supabase_js_schema.sql`:

```sql
CREATE TABLE public.todos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task text NOT NULL,
  is_complete boolean DEFAULT false NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
```

**RLS policies:**

- Public todos (`user_id IS NULL`) are visible to everyone
- Private todos (`user_id IS NOT NULL`) are visible only to their owner
- Anyone can insert (anonymous inserts leave `user_id` null)
- Only the owner (or anon for public todos) can update/delete

## Storage Bucket

Tests use the `test-bucket` bucket, created in the same migration.

## Platform Tests (NOT Migrated)

The following tests stay in the package and run via their own Nx targets:

| Test File                          | Target                     | Description                    |
| ---------------------------------- | -------------------------- | ------------------------------ |
| `test/integration.browser.test.ts` | `test:integration:browser` | Deno + Puppeteer browser tests |
| `test/deno/integration.test.ts`    | `test:deno`                | Deno runtime integration       |
| `test/deno/cors-*.test.ts`         | `test:deno`                | CORS edge function tests       |
| `test/integration/bun/`            | `test:bun`                 | Bun runtime tests              |
| `test/integration/expo/`           | `test:expo`                | React Native / Expo tests      |
| `test/integration/next/`           | `test:next`                | Next.js SSR tests              |
| `test/integration/node-browser/`   | `test:node:playwright`     | WebSocket browser tests        |
| `test/unit/`                       | `test:unit`                | Unit tests (no infra needed)   |

## Migration Status

✅ **Completed**: supabase-js core integration test migrated

**Migrated Test Files (1)**:

- ✅ integration.test.ts (446 lines — cross-service integration)

**Key Changes**:

- Import updated from `'../src/index'` to `'@supabase/supabase-js'`
- Hardcoded URL/keys replaced with `getConnectionInfo()` helper
- WebSocket transport setup moved to `createRealtimeClient()` helper
- `supabaseWithServiceRole` now uses `createServiceRoleClient()` helper
- `todos` migration added to shared e2e-tests schema
- `test-bucket` storage bucket added to shared e2e-tests schema
