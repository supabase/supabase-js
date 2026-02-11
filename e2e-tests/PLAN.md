# E2E Integration Test Infrastructure - Implementation Plan

## Context

Currently, integration tests are scattered across individual packages with separate Docker setups and Supabase CLI instances:

- **auth-js**: Supabase CLI + Docker Compose (4 GoTrue instances for edge cases)
- **storage-js**: Supabase CLI
- **postgrest-js**: Supabase CLI + Docker Compose for v12 compatibility
- **functions-js**: Testcontainers with Deno relay
- **supabase-js**: Supabase CLI with Edge Functions

### Problems

- **Duplicate infrastructure**: Multiple Supabase instances across packages
- **Port conflicts**: Different packages use overlapping ports
- **Slower CI**: Sequential setup/teardown for each package (current CI: ~60 minutes)
- **Maintenance burden**: 5 different infrastructure configurations to maintain
- **Missed integration opportunities**: Hard to test cross-service scenarios

### Goal

Consolidate all integration/e2e tests into a single shared infrastructure using ONE Supabase instance, reducing CI time by ~40% and enabling better cross-package integration testing.

## Architecture

### Hybrid Approach: Supabase CLI (Primary) + Docker (Edge Cases)

**Primary Stack**: Supabase CLI in `/e2e-tests/`

- Provides complete production-like stack (Auth, Storage, PostgREST, Realtime, Functions, PostgreSQL)
- Ports: 54321 (API), 54322 (DB), 54323 (Realtime), 54324 (Inbucket)
- Handles 95% of integration tests

**Supplementary Docker**: For specialized scenarios

- Auth edge cases: `/e2e-tests/infra/auth-edge-cases/` (4 GoTrue configs on ports 9996-9999)
- PostgREST v12: `/e2e-tests/infra/postgrest-v12/` (port 3012)
- Only used when specific configuration variants are needed

## Implementation Phases

### Phase 1: Infrastructure Setup ✅ COMPLETED

**Goal**: Create e2e-tests foundation with shared Supabase CLI stack

**Tasks Completed**:

1. ✅ Created directory structure
   - `/e2e-tests/supabase/` - Supabase CLI config
   - `/e2e-tests/infra/` - Docker configs (placeholders)
   - `/e2e-tests/tests/` - Test directories by package
   - `/e2e-tests/fixtures/` - Shared test data
   - `/e2e-tests/helpers/` - Shared utilities
   - `/e2e-tests/scripts/` - Setup/cleanup automation

2. ✅ Created unified Supabase config (`e2e-tests/supabase/config.toml`)
   - All services enabled: Auth, Storage, PostgREST, Realtime, Functions
   - Merged configs from auth-js, storage-js, postgrest-js, supabase-js
   - Edge Functions configured (6 test functions)

3. ✅ Consolidated database migrations
   - `00000000000001_postgrest_schema.sql` - PostgREST tables, functions, views
   - `00000000000002_storage_rls_policies.sql` - Storage RLS policies
   - `seed.sql` - Combined seed data from all packages

4. ✅ Created setup script (`scripts/setup-main.sh`)
   - Starts Supabase CLI
   - Waits for all services to be ready
   - Creates test storage buckets
   - Starts Edge Functions
   - Exports ANON_KEY and SERVICE_ROLE_KEY
   - Health checks all endpoints

5. ✅ Created cleanup script (`scripts/cleanup-all.sh`)
   - Kills Edge Functions process
   - Stops Supabase CLI
   - Cleans up temp files

6. ✅ Created Nx project config (`project.json`)
   - Test targets for each package
   - `dependsOn` configuration for task ordering
   - `implicitDependencies` on all core packages
   - Outputs configured for caching

7. ✅ Created shared utilities
   - `helpers/supabase-client.ts` - Client creation helpers
   - `helpers/global-setup.ts` - Jest global setup
   - `helpers/global-teardown.ts` - Jest global teardown
   - `fixtures/users.ts` - Shared test user data

8. ✅ Created smoke test (`tests/smoke.test.ts`)
   - Validates infrastructure is working
   - Tests all services (Auth, Storage, PostgREST)
   - Verifies fixtures are available

**Validation**: Run `bash e2e-tests/scripts/setup-main.sh` successfully, verify all services respond

---

### Phase 2: Migrate Core Tests (Incremental) 🔄 IN PROGRESS

**Goal**: Move integration tests from packages to e2e-tests, one package at a time

**Migration Strategy**:

- Keep old tests running in CI alongside new e2e tests during validation
- Compare coverage reports at each step
- Only remove old tests after validation period (1-2 weeks of stable e2e tests)
- Platform-specific tests (Next.js, Expo, Bun) remain in supabase-js package

#### Task 2.1: Storage-js 📋 PENDING

**Steps**:

1. Copy tests from `packages/core/storage-js/test/` to `e2e-tests/tests/storage/`
2. Update imports to use shared fixtures and helpers
3. Add storage schema to migrations (already done)
4. Run: `nx test:e2e:storage e2e-tests`
5. Verify coverage maintained (compare with original)
6. **Keep old tests running in CI** until validated

**Success Criteria**: `nx test:e2e:storage` passes with coverage ≥ original

#### Task 2.2: PostgREST-js Standard 📋 PENDING

**Steps**:

1. Copy standard tests from `packages/core/postgrest-js/test/` to `e2e-tests/tests/postgrest/standard/`
2. Exclude v12 tests (handle in Phase 3)
3. Add postgrest schema to migrations (already done)
4. Run: `nx test:e2e:postgrest:standard e2e-tests`
5. Verify coverage
6. **Keep old tests running in CI** until validated

**Success Criteria**: `nx test:e2e:postgrest:standard` passes with full coverage

#### Task 2.3: Functions-js 📋 PENDING

**Steps**:

1. Copy tests from `packages/core/functions-js/test/spec/` to `e2e-tests/tests/functions/`
2. Replace Testcontainers with Supabase CLI Edge Functions
3. Update function invocation to use real Edge Runtime
4. Run: `nx test:e2e:functions e2e-tests`
5. **Keep old tests running in CI** until validated

**Success Criteria**: `nx test:e2e:functions` passes with all edge function tests working

#### Task 2.4: Auth-js Standard 📋 PENDING

**Steps**:

1. Identify tests that work with standard GoTrue config
2. Copy to `e2e-tests/tests/auth/standard/`
3. Update to use Supabase CLI auth endpoint
4. Keep edge case tests in package (migrate in Phase 3)
5. Run: `nx test:e2e:auth:standard e2e-tests`
6. **Keep old tests running in CI** until validated

**Success Criteria**: `nx test:e2e:auth:standard` passes with standard auth tests

#### Task 2.5: Supabase-js Core 📋 PENDING

**Steps**:

1. Copy core integration tests to `e2e-tests/tests/supabase/`
2. **Keep platform tests (Next, Expo, Bun) in package** - these test runtime-specific behavior
3. Run: `nx test:e2e:supabase e2e-tests`
4. **Keep old tests running in CI** until validated

**Success Criteria**: `nx test:e2e:supabase` passes, platform tests remain in package

**Validation**: After each package migration, run both old and new tests in parallel, compare coverage reports, only remove old tests when new tests fully validated

---

### Phase 3: Edge Case Infrastructure (Priority) 📋 PENDING

**Goal**: Setup Docker for specialized scenarios - this is the priority after basic migration

#### Task 3.1: Auth Edge Cases Docker 📋 PENDING

**Steps**:

1. Copy `packages/core/auth-js/infra/docker-compose.yml` to `e2e-tests/infra/auth-edge-cases/`
2. Adjust ports to avoid conflicts (9996-9999, 5433)
3. Move docker-tests to `e2e-tests/tests/auth/edge-cases/`
4. Create `scripts/setup-auth-edge.sh` and cleanup
5. Add Nx target: `test:e2e:auth:edge`
6. Run: `nx test:e2e:auth:edge e2e-tests`

**Success Criteria**: All 4 GoTrue configurations working with edge case tests passing

**Critical Files**:

- `/e2e-tests/infra/auth-edge-cases/docker-compose.yml`
- `/e2e-tests/scripts/setup-auth-edge.sh`
- `/e2e-tests/tests/auth/edge-cases/*.test.ts`

#### Task 3.2: PostgREST v12 Compatibility 📋 PENDING

**Steps**:

1. Copy `packages/core/postgrest-js/test/v12/docker-compose.yml` to `e2e-tests/infra/postgrest-v12/`
2. Move v12 tests to `e2e-tests/tests/postgrest/v12/`
3. Create setup/cleanup scripts
4. Add Nx target: `test:e2e:postgrest:v12`
5. Run: `nx test:e2e:postgrest:v12 e2e-tests`

**Success Criteria**: PostgREST v12 compatibility tests passing

**Critical Files**:

- `/e2e-tests/infra/postgrest-v12/docker-compose.yml`
- `/e2e-tests/scripts/setup-postgrest-v12.sh`
- `/e2e-tests/tests/postgrest/v12/*.test.ts`

**Validation**: Both edge case scenarios pass all tests with correct configurations

---

### Phase 4: CI/CD Integration 📋 PENDING

**Goal**: Update GitHub Actions incrementally as packages are migrated

**Important**: Update CI to run both old and new tests in parallel during migration. Only remove old test jobs after new e2e tests are fully validated.

#### Task 4.1: Add E2E Test Job

**Steps**:

1. Add `test-e2e` job to `.github/workflows/ci-core.yml`
2. Run standard e2e tests with `nx affected --target=test:e2e:all:standard`
3. Run edge case tests conditionally
4. Upload e2e coverage reports
5. **Keep old test jobs running in parallel** during validation

**Example CI Configuration**:

```yaml
test-e2e:
  name: E2E Integration Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-node@v6
    - run: npm ci
    - uses: nrwl/nx-set-shas@v4

    - name: Build affected packages
      run: npx nx affected --target=build

    - name: Setup Supabase CLI
      uses: supabase/setup-cli@v1

    - name: Run standard e2e tests (affected)
      run: npx nx affected --target=test:e2e:all:standard
      timeout-minutes: 20

    - name: Run edge case tests (if affected)
      run: |
        npx nx test:e2e:auth:edge e2e-tests
        npx nx test:e2e:postgrest:v12 e2e-tests
      timeout-minutes: 10

    - name: Upload e2e coverage
      uses: coverallsapp/github-action@v2
      with:
        path-to-lcov: ./e2e-tests/coverage/lcov.info
        parallel: true
        flag-name: e2e-tests
```

#### Task 4.2: Gradual Transition

**Steps**:

1. When a package's e2e tests are validated, add comment to old test job: `// TODO: Remove after e2e-tests validated`
2. After validation period (1-2 weeks of stable e2e tests), remove old test infrastructure
3. Monitor coverage reports to ensure no regression

**Critical Files**:

- `/.github/workflows/ci-core.yml`

**Validation**: Both old and new tests run in parallel, coverage reports match, CI remains stable

---

### Phase 5: Cleanup & Documentation 📋 PENDING

**Goal**: Remove old infrastructure only after all e2e tests are fully validated

**Important**: Only proceed with this phase after running e2e tests in production CI for at least 1-2 weeks with no issues

#### Task 5.1: Remove Duplicate Infrastructure 📋 PENDING

**Steps** (ONLY after validation period):

1. Delete `packages/core/auth-js/infra/` (moved to e2e-tests)
2. Delete `packages/core/storage-js/test/supabase/`
3. Delete `packages/core/postgrest-js/test/supabase/`
4. Delete `packages/core/postgrest-js/test/v12/` (moved to e2e-tests)
5. Remove integration test targets from package `project.json` files

#### Task 5.2: Update Package Tests 📋 PENDING

**Steps**:

1. Update package README files to clarify scope (unit tests only)
2. Add comments in `project.json`: "Integration tests in /e2e-tests"
3. Keep testcontainers in functions-js if needed for unit tests
4. Keep platform tests (Next.js, Expo, Bun) in supabase-js package

#### Task 5.3: Update Documentation 📋 PENDING

**Files to Update**:

**`/e2e-tests/README.md`**: ✅ Already created

- Architecture overview
- Running tests locally
- Adding new tests
- Troubleshooting

**`/docs/TESTING.md`**:

- Add E2E testing section
- Document new test structure
- Update command reference
- Migration from old test structure

**`/CLAUDE.md`**:

- Document new test locations
- Update test command examples
- Clarify unit vs integration test separation
- Update "When Providing Code Suggestions" section

**Critical Files**:

- `/e2e-tests/README.md` ✅
- `/docs/TESTING.md`
- `/CLAUDE.md`

**Validation**: All documentation reviewed, all links work, no broken references

---

## Future Enhancements (Post-Migration)

After completing edge case migration, these cross-package integration tests can be added:

### Cross-Package Tests (`/e2e-tests/tests/cross-package/`)

1. **Auth + Storage**: Upload files as authenticated user
2. **Auth + PostgREST**: Query database with RLS policies
3. **Realtime + PostgREST**: Subscribe to database changes
4. **Functions + Storage**: Process uploaded files
5. **Full stack flows**: Signup → Auth → Upload → Query

### Performance & Reliability

1. **Performance benchmarks**: Track query performance over time
2. **Chaos engineering**: Test resilience by simulating failures
3. **Contract testing**: Verify API compatibility across versions

---

## Nx Configuration Details

### Test Targets in `/e2e-tests/project.json`

```json
{
  "test:e2e:setup": "Setup main infrastructure",
  "test:e2e:cleanup": "Cleanup all infrastructure",
  "test:e2e:auth:standard": "Auth standard tests",
  "test:e2e:auth:edge": "Auth edge case tests",
  "test:e2e:storage": "Storage tests",
  "test:e2e:postgrest:standard": "PostgREST standard tests",
  "test:e2e:postgrest:v12": "PostgREST v12 tests",
  "test:e2e:functions": "Functions tests",
  "test:e2e:supabase": "Supabase-js tests",
  "test:e2e:all:standard": "All standard tests",
  "test:e2e:all:edge": "All edge case tests",
  "test:e2e:all": "ALL tests"
}
```

### Dependencies

**Project-level** (via `implicitDependencies`):

- e2e-tests → all core packages
- Ensures e2e-tests are affected when any core package changes

**Task-level** (via `dependsOn`):

- All test targets depend on `^build` (build all dependencies first)
- Standard tests depend on `test:e2e:setup` (infrastructure must be ready)

### Caching Strategy

- `test:e2e:setup` - cache: false (infrastructure state varies)
- Individual test targets - cache: true, outputs: coverage
- Orchestration targets (`test:e2e:all:*`) - cache: false

---

## Benefits

1. **Simplified Infrastructure**: One Supabase instance for 95% of tests
2. **Faster CI**: Estimated 40% reduction (from ~60 min to ~35 min) via shared setup
3. **Better Test Coverage**: New cross-package tests spanning multiple services
4. **Improved Maintainability**: Centralized configuration, shared utilities
5. **Enhanced Developer Experience**: Single command to run all integration tests
6. **Cost Reduction**: Lower CI resource usage with better caching

---

## Success Metrics

- ✅ **Phase 1 Complete**: Infrastructure foundation created
- ⏳ All integration tests migrated to `/e2e-tests/`
- ⏳ Coverage maintained: ≥95% of current coverage
- ⏳ CI time reduced: ≤40 minutes (from ~60 minutes)
- ⏳ Zero test flakiness: <1% flaky test rate
- ⏳ Documentation complete: All guides updated and reviewed

---

## Quick Reference Commands

### Running Tests

```bash
# All tests
nx test:e2e:all e2e-tests

# Standard tests only
nx test:e2e:all:standard e2e-tests

# Edge case tests only
nx test:e2e:all:edge e2e-tests

# Individual packages
nx test:e2e:storage e2e-tests
nx test:e2e:postgrest:standard e2e-tests
nx test:e2e:functions e2e-tests
nx test:e2e:auth:standard e2e-tests
nx test:e2e:supabase e2e-tests

# Edge cases
nx test:e2e:auth:edge e2e-tests
nx test:e2e:postgrest:v12 e2e-tests
```

### Manual Infrastructure

```bash
# Setup
cd e2e-tests
bash scripts/setup-main.sh
source /tmp/e2e-supabase-keys.env

# Cleanup
bash scripts/cleanup-all.sh
```

---

## Current Status

**Last Updated**: February 11, 2025

**Phase 1**: ✅ COMPLETED
**Phase 2**: 📋 READY TO START (Task #2: storage-js)
**Phase 3**: 📋 PENDING
**Phase 4**: 📋 PENDING
**Phase 5**: 📋 PENDING

**Next Step**: Migrate storage-js integration tests (Task #2)
