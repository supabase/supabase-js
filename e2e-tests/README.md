# E2E Integration Tests

Consolidated end-to-end integration test infrastructure for all Supabase JavaScript SDK packages.

## Overview

This directory contains a unified testing infrastructure that replaces the scattered integration tests across individual packages. It uses a single Supabase CLI instance with all services enabled, plus supplementary Docker containers for edge cases.

### Benefits

- **Single Infrastructure**: One Supabase instance for 95% of tests
- **Faster CI**: ~40% reduction in CI time via shared setup
- **Better Coverage**: New cross-package tests spanning multiple services
- **Improved Maintainability**: Centralized configuration and shared utilities
- **Developer Experience**: Single command to run all integration tests

## Architecture

### Primary Stack: Supabase CLI

- **Location**: `/e2e-tests/supabase/`
- **Services**: Auth, Storage, PostgREST, Realtime, Edge Functions, PostgreSQL
- **Ports**:
  - API Gateway: `54321`
  - PostgreSQL: `54322`
  - Inbucket (Email): `54324`
- **Usage**: 95% of integration tests

### Supplementary Docker

- **Auth Edge Cases**: `/e2e-tests/infra/auth/` (4 GoTrue configs on ports 9996-9999)
- **PostgREST v12**: `/e2e-tests/infra/postgrest-v12/` (port 3012)
- **Usage**: Specialized configuration variants only

## Directory Structure

```
e2e-tests/
├── supabase/                     # Supabase CLI configuration
│   ├── config.toml              # Unified config (all services)
│   ├── migrations/              # Consolidated database migrations
│   │   ├── 00000000000001_postgrest_schema.sql
│   │   ├── 00000000000002_storage_rls_policies.sql
│   │   └── 00000000000003_supabase_js_schema.sql
│   ├── seed.sql                 # Combined seed data
│   └── functions/               # Edge Functions
├── infra/                       # Supplementary Docker
│   ├── auth/                   # 4 GoTrue instances (ports 9996-9999)
│   │   ├── docker-compose.yml
│   │   └── db/00-schema.sql
│   └── postgrest-v12/          # PostgREST v12 (port 3012)
│       ├── docker-compose.yml
│       ├── 00-schema.sql
│       └── 01-seed.sql
├── tests/                       # Test files by package
│   ├── auth/
│   │   ├── standard/           # Runs against Supabase CLI
│   │   └── edge/               # Runs against Docker multi-GoTrue
│   ├── storage/
│   ├── postgrest/
│   │   ├── standard/
│   │   └── v12/
│   ├── functions/
│   └── supabase/
├── fixtures/                    # Shared test data
│   └── users.ts
├── helpers/                     # Shared utilities
│   ├── supabase-client.ts
│   ├── auth-client.ts
│   ├── auth/                   # auth-js specific helpers
│   │   ├── clients.ts
│   │   ├── utils.ts
│   │   └── webauthn.fixtures.ts
│   ├── functions-client.ts
│   ├── postgrest-client.ts
│   ├── storage-client.ts
│   ├── global-setup.ts
│   └── global-teardown.ts
├── scripts/                     # Setup/cleanup scripts
│   ├── setup-main.sh            # Start Supabase CLI
│   ├── cleanup-all.sh           # Stop Supabase CLI
│   ├── setup-auth-edge.sh       # Start auth Docker
│   ├── cleanup-auth-edge.sh     # Stop auth Docker
│   ├── setup-postgrest-v12.sh   # Start postgrest-v12 Docker
│   ├── cleanup-postgrest-v12.sh # Stop postgrest-v12 Docker
│   └── generate-signing-keys.js # Generate RSA keys for auth tests
├── project.json                 # Nx configuration
├── jest.config.ts
├── tsconfig.json
└── README.md
```

## Quick Start

### Running All E2E Tests

```bash
# Setup infrastructure, run all tests, cleanup
nx test:e2e:all e2e-tests
```

### Running Specific Test Suites

```bash
# Standard tests (against Supabase CLI)
nx test:e2e:all:standard e2e-tests

# Edge case tests (against Docker)
nx test:e2e:all:edge e2e-tests

# Individual package tests
nx test:e2e:auth:standard e2e-tests
nx test:e2e:storage e2e-tests
nx test:e2e:postgrest:standard e2e-tests
nx test:e2e:functions e2e-tests
nx test:e2e:supabase e2e-tests

# Edge case tests
nx test:e2e:auth:edge e2e-tests
nx test:e2e:postgrest:v12 e2e-tests
```

### Manual Infrastructure Management

For development, you can manage infrastructure manually:

```bash
# Start Supabase CLI
cd e2e-tests
bash scripts/setup-main.sh

# Source environment variables
source /tmp/e2e-supabase-keys.env

# Run tests manually
npm run jest tests/storage

# Cleanup
bash scripts/cleanup-all.sh
```

## Configuration

### Environment Variables

The setup script exports these variables to `/tmp/e2e-supabase-keys.env`:

```bash
export SUPABASE_ANON_KEY="<anon-key>"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

### Supabase Services

All services are configured in `/e2e-tests/supabase/config.toml`:

- **Auth**: Comprehensive config from auth-js (OAuth, MFA, signing keys, high rate limits)
- **Storage**: File size limits, S3 protocol, image transformation
- **PostgREST**: Both `public` and `personal` schemas
- **Realtime**: Enabled for realtime-js tests
- **Edge Functions**: 6 test functions (hello, echo, status, cors-\*)
- **Inbucket**: Email testing

### Database Schema

Migrations are consolidated from all packages:

1. **00000000000001_postgrest_schema.sql**: PostgREST tables, functions, views
2. **00000000000002_storage_rls_policies.sql**: Storage RLS policies

Seed data includes:

- PostgREST: users, channels, messages, products, categories
- Storage: auth.users, buckets, objects
- Test fixtures for cross-package scenarios

## Writing Tests

### Basic Test Structure

```typescript
import { createTestClient, createServiceRoleClient } from '@helpers/supabase-client'
import { testUsers } from '@fixtures/users'

describe('Storage Integration', () => {
  let client: SupabaseClient

  beforeAll(() => {
    client = createServiceRoleClient()
  })

  afterAll(async () => {
    await client.auth.signOut()
  })

  test('should upload file', async () => {
    const { data, error } = await client.storage.from('bucket2').upload('test.txt', 'test content')

    expect(error).toBeNull()
    expect(data).toBeDefined()
  })
})
```

### Using Test Fixtures

```typescript
import { testUsers, postgrestUsers } from '@fixtures/users'

// Auth users
const user1 = testUsers.user1
console.log(user1.email) // test-user1@supabase.io

// PostgREST users
const supabot = postgrestUsers.supabot
console.log(supabot.username) // supabot
```

### Shared Helpers

```typescript
import {
  createTestClient,
  createServiceRoleClient,
  createAuthenticatedClient,
  cleanupClient,
} from '@helpers/supabase-client'

// Anon client
const anonClient = createTestClient()

// Service role client (bypasses RLS)
const adminClient = createServiceRoleClient()

// Authenticated client
const authClient = await createAuthenticatedClient('test-user1@supabase.io', 'password123')

// Cleanup
await cleanupClient(authClient)
```

## CI/CD Integration

In GitHub Actions, the e2e tests are run via:

```yaml
- name: Run E2E tests
  run: npx nx affected --target=test:e2e:all:standard
  timeout-minutes: 20
```

Edge case tests run conditionally:

```yaml
- name: Run edge case tests
  run: |
    npx nx test:e2e:auth:edge e2e-tests
    npx nx test:e2e:postgrest:v12 e2e-tests
  timeout-minutes: 10
```

## Development Workflow

### Adding New Tests

1. Create test file in appropriate directory: `tests/<package>/<test-name>.test.ts`
2. Import shared helpers and fixtures
3. Write tests using Jest
4. Run locally: `nx test:e2e:<package> e2e-tests`

### Adding New Fixtures

1. Add data to `/e2e-tests/fixtures/<name>.ts`
2. Export constants for tests to import
3. Document usage in this README

### Modifying Database Schema

1. Create new migration: `/e2e-tests/supabase/migrations/<timestamp>_<name>.sql`
2. Add seed data to `/e2e-tests/supabase/seed.sql` if needed
3. Test with: `npx supabase db reset` (from `/e2e-tests/`)

### Debugging

```bash
# Start infrastructure
cd e2e-tests
bash scripts/setup-main.sh

# Check service status
npx supabase status

# View logs
tail -f /tmp/e2e-supabase-functions.log

# Access database
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres

# Access Inbucket (email testing)
open http://127.0.0.1:54324
```

## Troubleshooting

### Port Conflicts

If ports are already in use:

```bash
# Stop Supabase
npx supabase stop

# Check for processes using ports
lsof -i :54321
lsof -i :54322

# Kill processes if needed
kill -9 <PID>
```

### Database Issues

```bash
# Reset database
cd e2e-tests
npx supabase db reset

# Check migrations
npx supabase db migrations list

# View migration status
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT * FROM supabase_migrations.schema_migrations;"
```

### Edge Functions Not Responding

```bash
# Check if functions process is running
ps aux | grep "supabase functions serve"

# View function logs
tail -f /tmp/e2e-supabase-functions.log

# Restart functions
kill $(cat /tmp/e2e-supabase-functions.pid)
npx supabase functions serve --import-map supabase/deno.json &
```

### Environment Variables Not Set

```bash
# Source keys
source /tmp/e2e-supabase-keys.env

# Verify
echo $SUPABASE_ANON_KEY
echo $SUPABASE_SERVICE_ROLE_KEY
```

## Migration Status

### Phase 1: Infrastructure Setup ✅

- [x] Directory structure created
- [x] Unified Supabase config
- [x] Consolidated migrations
- [x] Setup and cleanup scripts
- [x] Nx project configuration
- [x] Jest configuration
- [x] Shared helpers and fixtures

### Phase 2: Core Tests Migration ✅

- [x] storage-js tests (`tests/storage/`)
- [x] postgrest-js standard tests (`tests/postgrest/standard/`)
- [x] functions-js tests (`tests/functions/`)
- [x] auth-js standard tests (`tests/auth/standard/`)
- [x] supabase-js core tests (`tests/supabase/`)

### Phase 3: Edge Cases ✅

- [x] auth-js edge cases (`tests/auth/edge/` + `infra/auth/`)
- [x] postgrest-js v12 compatibility (`tests/postgrest/v12/` + `infra/postgrest-v12/`)

### Phase 4: CI/CD Integration ✅

- [x] `test-e2e-standard` job added to `.github/workflows/ci-core.yml`
- [x] Auth edge tests wired into `test-auth-js-docker` job
- [x] PostgREST v12 e2e tests wired into `test-postgrest-js-v12` job
- [x] Coverage upload steps added for all e2e test suites

### Phase 5: Cleanup (Pending - after validation period)

- [ ] Remove duplicate infrastructure from individual packages
- [ ] Update CLAUDE.md and docs/TESTING.md
- [ ] Archive old test infrastructure

## Resources

- [TESTING.md](/docs/TESTING.md) - Complete testing guide
- [CLAUDE.md](/CLAUDE.md) - Development guidelines
- [Supabase CLI Docs](https://supabase.com/docs/guides/local-development/cli)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
