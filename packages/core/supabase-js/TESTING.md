# Testing

**Important:** The test suite includes tests for multiple runtime environments (Node.js, Deno, Bun, Expo, Next.js). Each environment has its own test runner and specific requirements.

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
| `test:node:playwright`     | WebSocket browser tests                   | Supabase running + Playwright           |
| `test:bun`                 | Bun runtime compatibility tests           | Supabase running + Bun installed        |
| `test:types`               | Type testing                              | None                                    |
| `test:deno`                | Deno runtime compatibility tests          | Supabase running + Deno installed       |
| `test:expo`                | React Native/Expo tests                   | Supabase running + dependencies updated |
| `test:next`                | Next.js SSR tests                         | Supabase running + dependencies updated |

## Prerequisites for All Integration Tests

1. **Docker** must be installed and running
2. **Supabase CLI** must be installed (`brew install supabase/tap/supabase` - [for other platforms read here](https://supabase.com/docs/guides/local-development/cli/getting-started?queryGroups=platform&platform=macos#installing-the-supabase-cli))
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
# - Publishable key: [your-publishable-key]
# - Secret key: [your-secret-key]
# - Service role key: [your-service-role-key]  # Important for some tests!

# Return to monorepo root for running tests
cd ../../..
```

4. `SUPABASE_SERVICE_ROLE_KEY` env variable exported/available

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

### Exporting `SUPABASE_SERVICE_ROLE_KEY` environment variable:

```bash
# Prerequisites: Start Supabase first
cd packages/core/supabase-js
export SUPABASE_SERVICE_ROLE_KEY="$(npx supabase status --output json | jq -r '.SERVICE_ROLE_KEY')"
cd ../../..
npx nx test:integration supabase-js
```

To run these tests successfully, you also need to have the Supabase CLI installed. [Here are instructions](https://supabase.com/docs/guides/local-development/cli/getting-started?queryGroups=platform&platform=macos#installing-the-supabase-cli) on how you can install it. Then you can run these tests:

```bash
# Run browser-based integration tests (requires Deno)
npx nx test:integration:browser supabase-js
```

## Running All Tests

Checklist:

- [ ] Docker running
- [ ] Supabase local instance running
- [ ] Supabase CLI installed on machine
- [ ] `SUPABASE_SERVICE_ROLE_KEY` env var available/exported

```bash
# This runs type checking, unit tests, and integration tests sequentially
# NOTE: Will fail if Supabase is not running or dependencies not updated
npx nx test:all supabase-js
```

**Common Issues and Solutions:**

| Issue                                        | Solution                                                        |
| -------------------------------------------- | --------------------------------------------------------------- |
| "Port 54322 already allocated"               | Stop existing Supabase: `npx supabase stop --project-id <name>` |
| "503 Service Unavailable" for Edge Functions | Supabase not running - start with `npx supabase start`          |
| Integration tests fail with auth errors      | Export `SUPABASE_SERVICE_ROLE_KEY` (see Integration Testing)    |

## Platform-Specific Testing

Platform tests verify that the SDK works correctly across different runtime environments (Node.js, Deno, Bun, Expo, Next.js). To do that, we use a tool called [Verdaccio](https://verdaccio.org/), which will run a local Node.js private proxy registry, where we will publish our `@supabase/*-js` packages, and then install them in the different environments.

### Verdaccio Workflow

#### Setup

From the root of the workspace, run:

```bash
# Terminal 1: Start local Verdaccio registry (stays running)
npx nx local-registry

# Terminal 2: Build and publish packages to local registry
npx nx run-many --target=build --all
npx nx populate-local-registry
```

**Important!**

_After you finish_ testing, _reset_ your npm registry to point to npm:

```bash
npm config set registry https://registry.npmjs.org/
```

#### Update dependencies:

```bash
# This will run `npm i` in each of the intergration tests directories,
# fetching the locally published packages
npx nx update:test-deps supabase-js
```

**Tips:**

- Keep Verdaccio running in Terminal 1 for multiple test runs
- Only rebuild/republish when you change source code
- Registry runs on `http://localhost:4873/`
- To stop Verdaccio: Ctrl+C in Terminal 1

### Running the tests

#### Expo Testing (React Native)

```bash
cd packages/core/supabase-js
npx nx test:expo
```

or from the root of the workspace:

```bash
npx nx run @supabase/supabase-js:"test:expo"
```

### Next.js Testing (SSR)

```bash
cd packages/core/supabase-js
# Install Playwright browsers and dependencies
npx playwright install --with-deps
# Run the tests
npx nx test:next
```

or from the root of the workspace:

```bash
npx nx run @supabase/supabase-js:"test:next"
```

### Deno Testing

```bash
cd packages/core/supabase-js
# Deno must be installed (https://deno.land)
npx nx test:deno
```

or from the root of the workspace:

```bash
npx nx run @supabase/supabase-js:"test:deno"
```

## Edge Functions Testing

The project includes Edge Functions integration tests that require a local Supabase instance to be running.

```bash
cd packages/core/supabase-js
npx nx test:edge-functions
```

or from the root of the workspace:

```bash
npx nx run @supabase/supabase-js:"test:edge-functions"
```

**Important Notes:**

- The Edge Functions tests will fail with 503 errors if Supabase is not running
- If you encounter port conflicts (e.g., "port 54322 already allocated"), stop any existing Supabase instances:

```bash
npx supabase stop --project-id <project-name>
# Or stop all Docker containers if unsure:
docker ps | grep supabase  # List all Supabase containers
```

- The tests use the default local development credentials (anon key)
- Edge Functions are automatically served when `supabase start` is run

### Bun Testing

```bash
cd packages/core/supabase-js
npx nx test:bun
```

or from the root of the workspace:

```bash
npx nx run @supabase/supabase-js:"test:bun"
```

### WebSocket Browser Testing

```bash
cd packages/core/supabase-js
npx nx test:node:playwright
```

or from the root of the workspace:

```bash
npx nx run @supabase/supabase-js:"test:node:playwright"
```

**Important!**

After you finish testing, reset your npm registry to point to npm:

```bash
npm config set registry https://registry.npmjs.org/
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
