# Testing your changes locally

**Important:** The test suite includes tests for multiple runtime environments (Node.js, Deno, Bun, Expo, Next.js). Each environment has its own test runner and specific requirements.

## Prerequisites for All Integration Tests

1. **Docker** must be installed and running
2. **Supabase CLI** must be installed (`npm install -g supabase` or via package manager)
3. **Local Supabase instance** must be started:

```bash
# Navigate to the supabase-js package directory
cd packages/core/supabase-js

# Start Supabase (downloads and starts all required containers)
npx supabase start

# The output will show:
# - API URL: http://127.0.0.1:54321
# - Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
# - Studio URL: http://127.0.0.1:54323
# - Anon key: [your-anon-key]
# - Service role key: [your-service-role-key]  # Important for some tests!

# Return to monorepo root for running tests
cd ../../..
```

## Integration Testing

Integration tests verify that the SDK works correctly across different runtime environments (Node.js, Deno, Bun, Expo, Next.js). There are two approaches:

### Recommended: Verdaccio Workflow (Mirrors CI)

For the most accurate testing that mirrors CI exactly, use a local Verdaccio registry:

**Setup:**
```bash
# Terminal 1: Start local Verdaccio registry (stays running)
npx nx local-registry

# Terminal 2: Build and publish packages to local registry
npx nx run-many --target=build --all
npx nx populate-local-registry
```

**Run Tests:**
```bash
# Individual platform tests (from supabase-js directory)
npx nx test:verdaccio:bun supabase-js
npx nx test:verdaccio:expo supabase-js
npx nx test:verdaccio:next supabase-js
npx nx test:verdaccio:deno supabase-js

# Run all platform tests
npx nx test:verdaccio:all supabase-js
```

**Tips:**
- Keep Verdaccio running in Terminal 1 for multiple test runs
- Only rebuild/republish when you change source code
- Registry runs on `http://localhost:4873/`
- To stop Verdaccio: Ctrl+C in Terminal 1

### Alternative: Basic Integration Tests

For basic Node.js and browser integration testing (without platform-specific tests):

```bash
# Run Node.js integration tests
# IMPORTANT: Requires SUPABASE_SERVICE_ROLE_KEY environment variable
cd packages/core/supabase-js
export SUPABASE_SERVICE_ROLE_KEY="$(npx supabase status --output json | jq -r '.SERVICE_ROLE_KEY')"
cd ../../..
npx nx test:integration supabase-js

# Run browser-based integration tests (requires Deno)
npx nx test:integration:browser supabase-js

# Run Edge Functions tests
npx nx test:edge-functions supabase-js
```

**Note:** For platform-specific tests (Bun, Expo, Next.js), you still need Verdaccio running as these tests install packages from the registry.

## Test Scripts Overview

| Script                     | Description                               | Requirements                            |
| -------------------------- | ----------------------------------------- | --------------------------------------- |
| `test`                     | Runs unit tests + type checking           | None                                    |
| `test:all`                 | Unit + integration + browser tests        | Supabase running                        |
| `test:run`                 | Jest unit tests only                      | None                                    |
| `test:unit`                | Jest unit tests in test/unit directory    | None                                    |
| `test:coverage`            | Unit tests with coverage report           | None                                    |
| `test:integration`         | Node.js integration tests                 | Supabase running + SERVICE_ROLE_KEY     |
| `test:integration:browser` | Browser tests using Deno + Puppeteer      | Supabase running + Deno installed       |
| `test:edge-functions`      | Edge Functions tests                      | Supabase running + Deno installed       |
| `test:types`               | TypeScript type checking + JSR validation | None                                    |
| `test:bun`                 | Bun runtime compatibility tests           | Supabase running + Bun installed        |
| `test:node:playwright`     | WebSocket browser tests                   | Supabase running + Playwright           |
| Deno (see section below)   | Deno runtime compatibility tests          | Supabase running + Deno installed       |
| Expo (see section below)   | React Native/Expo tests                   | Supabase running + dependencies updated |
| Next.js (see below)        | Next.js SSR tests                         | Supabase running + dependencies updated |

## Unit Testing

```bash
# Run all unit tests (Jest)
npx nx test supabase-js

# Run only unit tests in test/unit directory
npx nx test:unit supabase-js

# Run tests in watch mode during development
npx nx test supabase-js --watch

# Run tests with coverage report
npx nx test:coverage supabase-js
```


## Running All Tests

```bash
# This runs type checking, unit tests, and integration tests sequentially
# NOTE: Will fail if Supabase is not running or dependencies not updated
npx nx test:all supabase-js
```

**Common Issues and Solutions:**

| Issue                                        | Solution                                                        |
| -------------------------------------------- | --------------------------------------------------------------- |
| "Cannot find module 'https://deno.land/...'" | Deno tests incorrectly run by Jest - check `jest.config.ts`     |
| "Port 54322 already allocated"               | Stop existing Supabase: `npx supabase stop --project-id <name>` |
| "503 Service Unavailable" for Edge Functions | Supabase not running - start with `npx supabase start`          |
| "Uncommitted changes" during type check      | Commit changes or add `--allow-dirty` to JSR publish            |
| Integration tests fail with auth errors      | Export `SUPABASE_SERVICE_ROLE_KEY` (see Integration Testing section)    |

## Additional Test Commands

#### WebSocket Browser Testing

```bash
# Build the UMD bundle first
npx nx build supabase-js

# Run WebSocket browser tests with Playwright
cd packages/core/supabase-js/test/integration/node-browser
npm install
cp ../../../dist/umd/supabase.js .
npm run test
cd ../../..
```

#### Playwright Setup (for Next.js tests)

```bash
# Install Playwright browsers and dependencies
npx playwright install --with-deps
```

## CI/CD Testing

When running on CI, the tests automatically publish packages to a local Verdaccio registry. The CI pipeline:

1. Builds all packages with current dependencies
2. Starts a local Verdaccio registry
3. Publishes all packages to Verdaccio
4. Integration tests install from Verdaccio, ensuring they test the actual built packages

**For local development:** Use the Verdaccio workflow described above. This mirrors CI exactly and allows you to test your local changes before pushing.

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
