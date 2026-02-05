# Testing

**Important:** The test suite includes tests for multiple runtime environments (Node.js, Deno, Bun, Expo, Next.js). Each environment has its own test runner and specific requirements.

## Single Supabase Instance Workflow

**Key Concept:** Tests are designed to use a **single, shared Supabase instance** that you start once and reuse across multiple test runs. This approach is more efficient and mirrors real-world usage.

### Quick Start

```bash
# 1. Setup Supabase ONCE (includes database, storage, AND edge functions)
npx nx test:supabase:setup supabase-js

# 2. Run any tests (in any order, multiple times)
npx nx test:integration supabase-js
npx nx test:deno:all supabase-js
npx nx test:edge-functions supabase-js

# 3. Cleanup when done
npx nx test:supabase:stop supabase-js
```

### What `test:supabase:setup` Does

The setup command performs these steps automatically:

1. ✅ Starts Supabase local development stack (all containers)
2. ✅ Serves Edge Functions in the background (fixes 503 errors)
3. ✅ Resets database and applies migrations
4. ✅ Creates test storage bucket
5. ✅ Exports `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` environment variables
6. ✅ Verifies everything is working (database, storage, functions)

**Important:** Tests do NOT automatically restart Supabase. You control when it starts and stops.

## Test Scripts Overview

| Script                     | Description                               | Requirements                           |
| -------------------------- | ----------------------------------------- | -------------------------------------- |
| `test:supabase:setup`      | **Setup Supabase once** for all tests     | Docker running, Supabase CLI installed |
| `test:supabase:stop`       | **Cleanup** Supabase after testing        | None                                   |
| `test`                     | Runs unit tests + type checking           | None                                   |
| `test:all`                 | Unit + integration + browser tests        | **Run setup first**                    |
| `test:run`                 | Jest unit tests only                      | None                                   |
| `test:unit`                | Jest unit tests in test/unit directory    | None                                   |
| `test:coverage`            | Unit tests with coverage report           | None                                   |
| `test:integration`         | Node.js integration tests                 | **Run setup first**                    |
| `test:integration:browser` | Browser tests using Deno + Puppeteer      | **Run setup first** + Deno installed   |
| `test:edge-functions`      | Edge Functions tests                      | **Runs in CI only**                    |
| `test:deno:all`            | All Deno tests (integration + CORS)       | **Runs in CI only**                    |
| `test:types`               | TypeScript type checking + JSR validation | None                                   |
| `test:node:playwright`     | WebSocket browser tests                   | **Run setup first** + Playwright       |
| `test:bun`                 | Bun runtime compatibility tests           | **Runs in CI only**                    |
| `test:expo`                | React Native/Expo tests                   | **Runs in CI only**                    |
| `test:next`                | Next.js SSR tests                         | **Runs in CI only**                    |

## Prerequisites for Local Testing

1. **Docker** must be installed and running
2. **Supabase CLI** must be installed (`brew install supabase/tap/supabase` - [for other platforms read here](https://supabase.com/docs/guides/local-development/cli/getting-started?queryGroups=platform&platform=macos#installing-the-supabase-cli))
3. **jq** must be installed for parsing JSON output (`brew install jq` on macOS)
4. **Run the setup command** before any integration tests (see Quick Start above)

## Unit Testing

Run these from the root of the repo:

```bash
# Run only unit tests in test/unit directory
npx nx test:unit supabase-js

# Run tests in watch mode during development
npx nx test supabase-js --watch

# Run tests with coverage report
npx nx test:coverage supabase-js
```

## Integration Testing

### Local Testing (Basic Integration Tests)

Use the single Supabase instance workflow:

```bash
# 1. Setup once (exports keys automatically)
npx nx test:supabase:setup supabase-js

# 2. Run integration tests (keys already exported)
npx nx test:integration supabase-js

# 3. Run browser tests
npx nx test:integration:browser supabase-js

# 4. Cleanup when done
npx nx test:supabase:stop supabase-js
```

### Manual Setup (Alternative)

If you need manual control or want to export keys in your shell:

```bash
# Navigate to the supabase-js package directory
cd packages/core/supabase-js

# Start Supabase
npx supabase start

# Serve edge functions in background (if needed)
npx supabase functions serve &

# Export keys for tests
export SUPABASE_ANON_KEY="$(npx supabase status --output json | jq -r '.ANON_KEY')"
export SUPABASE_SERVICE_ROLE_KEY="$(npx supabase status --output json | jq -r '.SERVICE_ROLE_KEY')"

# Return to root and run tests
cd ../../..
npx nx test:integration supabase-js

# Cleanup
npx supabase stop
```

## Running All Local Tests

### Recommended Workflow

```bash
# 1. Setup Supabase once
npx nx test:supabase:setup supabase-js

# 2. Run all local tests (unit + integration + browser)
npx nx test:all supabase-js

# 3. Cleanup
npx nx test:supabase:stop supabase-js
```

**Checklist:**

- [x] Docker running
- [x] Supabase CLI installed
- [x] jq installed (for JSON parsing)
- [x] Run `test:supabase:setup` first (handles keys automatically)

**Common Issues and Solutions:**

| Issue                                        | Solution                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| "Port 54322 already allocated"               | Run `npx nx test:supabase:stop supabase-js` or `npx supabase stop`            |
| "503 Service Unavailable" for Edge Functions | Run `npx nx test:supabase:setup supabase-js` (serves functions automatically) |
| Integration tests fail with auth errors      | Run `npx nx test:supabase:setup supabase-js` (exports keys automatically)     |
| "jq: command not found"                      | Install jq: `brew install jq` (macOS) or `apt-get install jq` (Linux)         |
| Functions log filling up disk                | Logs are in `/tmp/supabase-functions.log`, cleanup removes them               |

## Platform-Specific Testing (CI Only)

Platform tests verify that the SDK works correctly across different runtime environments (Node.js, Deno, Bun, Expo, Next.js). These tests run **automatically in CI** on every pull request using [pkg.pr.new](https://github.com/stackblitz-labs/pkg.pr.new) for package publishing.

### How Platform Tests Work in CI

```text
Pull Request Created/Updated
  ↓
1. preview-release.yml workflow runs
  ↓
2. Builds all packages
  ↓
3. Publishes packages to pkg.pr.new
  ↓
4. Updates import URLs with commit hash
  ↓
5. integration-tests.yml workflow runs
  ↓
6. Tests all platforms:
   - Deno (via esm.sh/pkg.pr.new URLs)
   - Next.js (installs from pkg.pr.new)
   - Expo (installs from pkg.pr.new)
   - Bun (installs from pkg.pr.new)
   - Browser (Playwright)
```

### Why pkg.pr.new?

- ✅ **No local setup needed** - Tests use real published packages
- ✅ **Automatic on every PR** - Catches issues before merge
- ✅ **Real-world testing** - Tests actual npm install workflow
- ✅ **Consistent environment** - Same packages in CI and for manual testing

### Testing Platform-Specific Changes

If you need to test changes across different platforms:

1. **Push your changes to a PR** - This triggers the preview release
2. **Wait for CI to complete** (~5-10 minutes) - Packages are built and published
3. **Check workflow results** - All platform tests run automatically
4. **Fix issues and push again** - CI re-runs with updated packages

**Note:** Platform tests (Next.js, Expo, Bun) cannot be run locally because they require packages to be published. The basic integration tests (Node.js, Deno, Browser) can be run locally using the workflow described above.

## Edge Functions Testing (CI Only)

The project includes Edge Functions integration tests that import from published packages. These tests **cannot run locally** because they require packages published to pkg.pr.new.

### Why CI Only?

Edge functions import the CORS module:

```typescript
// Edge functions import the published package
import { corsHeaders } from '@supabase/supabase-js/cors'
```

The `supabase/deno.json` file maps this import to pkg.pr.new URLs:

```json
{
  "imports": {
    "@supabase/supabase-js/cors": "https://esm.sh/pr/supabase/supabase-js/@supabase/supabase-js@{COMMIT_HASH}/dist/cors.mjs"
  }
}
```

Locally, the `{COMMIT_HASH}` placeholder is not replaced, so Deno cannot fetch the package.

### Testing Edge Functions Changes

To test changes to edge functions or the CORS module:

1. **Push your changes to a PR**
2. **Wait for CI to complete** (~5-10 minutes)
3. **Check the integration-tests workflow** for results
4. **Fix issues and push again** if needed

### Local Workaround (Advanced)

If you need to test locally, you can temporarily replace the placeholder with a real commit hash from an existing PR:

```bash
# 1. Find a commit hash from a recent PR (check pkg.pr.new comment on any PR)
# 2. Run the URL update script with that hash
./scripts/update-pkg-pr-urls.sh abc123def456

# 3. Setup and run tests
npx nx test:supabase:setup supabase-js
npx nx test:edge-functions supabase-js

# 4. IMPORTANT: Don't commit the updated deno.json files!
git checkout packages/core/supabase-js/supabase/deno.json
git checkout packages/core/supabase-js/test/deno/deno.json
```

**Note:** This uses packages from someone else's PR, not your local changes. Only useful for testing the test infrastructure itself.

**Important Notes:**

- ✅ `test:supabase:setup` automatically serves Edge Functions in the background
- ✅ Functions are served on `http://127.0.0.1:54321/functions/v1/<function-name>`
- ✅ Function logs are written to `/tmp/supabase-functions.log`
- ❌ Edge Functions tests will fail with 503 errors if setup hasn't been run
- ❌ Running `npx supabase start` alone does NOT serve edge functions

**Available Edge Functions:**

- `hello` - Simple greeting function
- `echo` - Echoes request body
- `status` - Returns system status
- `cors-validation` - Tests CORS headers
- `cors-http-methods` - Tests HTTP method CORS
- `cors-errors` - Tests CORS error handling

**Debugging Edge Functions:**

```bash
# View function logs
tail -f /tmp/supabase-functions.log

# Test a function directly
curl -X POST \
  -H "Authorization: Bearer $(npx supabase status --output json | jq -r '.ANON_KEY')" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}' \
  http://127.0.0.1:54321/functions/v1/hello
```

## Deno Testing (CI Only)

Deno tests require packages published to pkg.pr.new and **cannot run locally** with the standard workflow.

### Why CI Only?

The `test/deno/deno.json` import map uses pkg.pr.new URLs with a `{COMMIT_HASH}` placeholder:

```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/pr/supabase/supabase-js/@supabase/supabase-js@{COMMIT_HASH}?target=deno"
  }
}
```

In CI, this placeholder is replaced with the actual commit hash after pkg.pr.new publishes. Locally, the placeholder remains, causing Deno imports to fail.

### Testing Deno Changes

To test Deno-specific changes:

1. **Push your changes to a PR**
2. **Wait for the preview-release workflow** to complete
3. **Check the integration-tests workflow** for Deno test results
4. **Iterate as needed**

### Local Workaround (Advanced)

Same as edge functions - you can use a commit hash from an existing PR, but this won't test your local changes:

```bash
# Use a real commit hash from an existing PR
./scripts/update-pkg-pr-urls.sh abc123def456

# Run tests
npx nx test:supabase:setup supabase-js
npx nx test:deno:all supabase-js

# Don't commit the changes
git checkout packages/core/supabase-js/test/deno/deno.json
```

## Test Coverage

### Viewing Coverage Reports

```bash
# Generate coverage report
npx nx test:coverage supabase-js

# Serve coverage report locally (opens interactive HTML report)
npx nx serve:coverage supabase-js
# This starts a local server at http://localhost:3000 with the coverage report
```

The coverage report shows:

- Line coverage
- Branch coverage
- Function coverage
- Uncovered lines with highlights

Coverage results are also automatically uploaded to Coveralls in CI for tracking over time.

## Summary: Local vs CI Testing

### Can Run Locally ✅

- ✅ Unit tests (`test:unit`)
- ✅ Type checking (`test:types`)
- ✅ Node.js integration tests (`test:integration`)
- ✅ Browser integration tests (`test:integration:browser`)
- ✅ Playwright WebSocket tests (`test:node:playwright`)

### CI Only (Requires pkg.pr.new) ❌

- ❌ Deno tests (`test:deno:all`)
- ❌ Edge Functions tests (`test:edge-functions`)
- ❌ Next.js tests (`test:next`)
- ❌ Expo/React Native tests (`test:expo`)
- ❌ Bun tests (`test:bun`)

**Why CI Only?** These tests require installing or importing packages from a registry. The CI workflow:

1. **Publishes to pkg.pr.new** - Creates installable packages on every PR
2. **Updates import URLs** - Replaces `{COMMIT_HASH}` placeholders with actual commit hash
3. **Runs tests** - Tests use the published packages, ensuring real-world compatibility

This approach eliminates complex local registry setup (like Verdaccio) while ensuring tests run against actual published packages.

### Testing CI-Only Changes Locally

If you need to test Deno or edge function changes:

1. **Make your changes** and commit locally
2. **Push to your PR branch**
3. **Wait for CI** (~5-10 minutes for preview-release + integration-tests)
4. **Check workflow results** for any failures
5. **Iterate** - Fix issues and push again

The fast feedback loop (5-10 min) and automatic testing on every PR push makes this workflow practical for daily development.
