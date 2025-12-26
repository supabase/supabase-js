<br />
<p align="center">
  <a href="https://supabase.io">
        <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--light.svg">
      <img alt="Supabase Logo" width="300" src="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/logo-preview.jpg">
    </picture>
  </a>

  <h1 align="center">Supabase PostgREST JS SDK</h1>

  <h3 align="center">Isomorphic JavaScript SDK for <a href="https://postgrest.org">PostgREST</a> with an ORM-like interface.</h3>

  <p align="center">
    <a href="https://supabase.com/docs/guides/database">Guides</a>
    ·
    <a href="https://supabase.com/docs/reference/javascript/select">Reference Docs</a>
    ·
    <a href="https://supabase.github.io/supabase-js/postgrest-js/v2/spec.json">TypeDoc</a>
  </p>
</p>

<div align="center">

[![Build](https://github.com/supabase/supabase-js/workflows/CI/badge.svg)](https://github.com/supabase/supabase-js/actions?query=branch%3Amaster)
[![Package](https://img.shields.io/npm/v/@supabase/postgrest-js)](https://www.npmjs.com/package/@supabase/postgrest-js)
[![License: MIT](https://img.shields.io/npm/l/@supabase/supabase-js)](#license)
[![pkg.pr.new](https://pkg.pr.new/badge/supabase/postgrest-js)](https://pkg.pr.new/~/supabase/postgrest-js)

</div>

### Quick start

Install

```bash
npm install @supabase/postgrest-js
```

Usage

```js
import { PostgrestClient } from '@supabase/postgrest-js'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient(REST_URL)
```

- [select()](https://supabase.com/docs/reference/javascript/select)
- [insert()](https://supabase.com/docs/reference/javascript/insert)
- [update()](https://supabase.com/docs/reference/javascript/update)
- [delete()](https://supabase.com/docs/reference/javascript/delete)

#### Custom `fetch` implementation

`postgrest-js` uses the [`cross-fetch`](https://www.npmjs.com/package/cross-fetch) library to make HTTP requests, but an alternative `fetch` implementation can be provided as an option. This is most useful in environments where `cross-fetch` is not compatible, for instance Cloudflare Workers:

```js
import { PostgrestClient } from '@supabase/postgrest-js'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient(REST_URL, {
  fetch: (...args) => fetch(...args),
})
```

## Development

This package is part of the [Supabase JavaScript monorepo](https://github.com/supabase/supabase-js). To work on this package:

### Building

```bash
# Build (from monorepo root)
npx nx build postgrest-js

# Build with watch mode for development
npx nx build:watch postgrest-js

# TypeScript type checking
npx nx type-check postgrest-js

# Generate documentation
npx nx docs postgrest-js
```

### Testing

**Supabase CLI Required!** The `postgrest-js` tests use the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) to run a local PostgreSQL database and PostgREST server.

#### Quick Start

```bash
# Run all tests (from monorepo root)
npx nx test:ci:postgrest postgrest-js
```

This single command automatically:

1. Stops any existing Supabase CLI containers
2. Starts PostgreSQL database and PostgREST server via Supabase CLI
3. Resets and seeds the database
4. Runs all Jest unit tests with coverage
5. Cleans up containers

#### Individual Test Commands

```bash
# Run Jest tests with coverage (requires infrastructure running)
npx nx test:run postgrest-js

# Run type tests with tstyche
npx nx test:types postgrest-js

# Run smoke tests (CommonJS and ESM imports)
npx nx test:smoke postgrest-js

# Format code
npx nx format postgrest-js

# Check formatting
npx nx format:check postgrest-js
```

#### Test Infrastructure

The tests use Supabase CLI to spin up:

- **PostgreSQL** - Database with test schema and seed data (port 54322)
- **PostgREST** - REST API server that the client connects to (port 54321)

```bash
# Manually manage test infrastructure (from monorepo root)
npx nx test:infra postgrest-js      # Start containers
npx nx test:clean-pre postgrest-js  # Stop and remove containers
```

Or directly via Supabase CLI:

```bash
cd packages/core/postgrest-js/test
supabase start        # Start all services
supabase db reset     # Reset and seed database
supabase stop         # Stop all services
```

#### Regenerating TypeScript Types

When the database schema changes, regenerate TypeScript types from the actual database:

```bash
npx nx db:generate-test-types postgrest-js
```

This connects to the running Supabase instance and generates types in `test/types.generated.ts`.

#### Test Types Explained

- **Unit Tests** - Jest tests covering all client functionality (`npx nx test:run postgrest-js`)
- **Type Tests** - Validates TypeScript types using tstyche (`npx nx test:types postgrest-js`)
- **Smoke Tests** - Basic import/require tests for CommonJS and ESM (`npx nx test:smoke postgrest-js`)

#### Prerequisites

- **Supabase CLI** must be installed ([instructions](https://supabase.com/docs/guides/local-development/cli/getting-started)) or can be used through `npx` (`npx supabase`)
- **Docker** must be installed and running (Supabase CLI uses Docker under the hood)
- **Port 54321** - PostgREST API
- **Port 54322** - PostgreSQL database
- **Port 54323** - Supabase Studio (used for type generation)

#### PostgREST v12 Backward Compatibility Tests

We maintain backward compatibility tests for PostgREST v12 (the current Supabase CLI uses v14+). These tests ensure the SDK works correctly for users still running older PostgREST versions.

```bash
# Run v12 compatibility tests (requires Docker)
npx nx test:ci:v12 postgrest-js
```

This command:

1. Starts PostgREST v12 + PostgreSQL in Docker (ports 3012/5433)
2. Runs runtime tests that verify v12-specific behavior
3. Cleans up containers

**Type-only tests** for v12 compatibility also run as part of the regular type tests:

```bash
npx nx test:types postgrest-js  # Includes v12-compat.test-d.ts
```

**Note:** These v12 tests will be removed when v3 ships (sometime in 2026).

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.

## License

This repo is licensed under MIT License.
