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

#### Typing

Query results are typed by a planner: a separate tool scans your queries and emits global interfaces (`SupabaseSelects`, `SupabaseOperands`, `SupabaseDatabase`, `SupabasePgrstStatus`, `SupabaseColumnTypes`) that the builders look up, so `select('id, channels(id)')` returns the row that query produces and filters take the column's type. The client no longer parses select strings at the type level and takes no `Database` type for inference; `new PostgrestClient<Database>()` still accepts a `supabase gen types typescript` database.

Without the generated interfaces every query is accepted and its rows are `Record<string, unknown>`; with `SupabasePgrstStatus['unplanned']` set to `'error'`, a query the planner didn't index is a type error. When you need to state a result yourself, use `.cast<T>()`, which replaces the builder's `.returns<T>()` and `.overrideTypes<T>()` and does nothing at runtime:

```ts
const { data } = await postgrest.from('users').select(columns).cast<{ id: number }>()
```

To type a column yourself everywhere it appears (selects, filters, mutation payloads), declare it in `SupabaseColumnTypes`, keyed by `schema.table.column`; the column's own nullability stays outside. Postgres arrays are typed with non-null, one-dimensional elements (`int4[]` is `number[]`), because Postgres doesn't enforce element nullability or dimensions; override a column that holds `NULL` elements or nested arrays:

```ts
declare global {
  interface SupabaseColumnTypes {
    'public.readings.samples': (number | null)[]
  }
}
```

Typing requires TypeScript 5.1 or later (the builders use `const` type parameters, and the argument checks rely on template literal inference that TypeScript 5.0 doesn't do).

#### Custom `fetch` implementation

`postgrest-js` uses the runtime's global `fetch` to make HTTP requests, but an alternative `fetch` implementation can be provided as an option. This is useful in environments where the global `fetch` is unavailable or where you want to customize request behavior:

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
pnpm nx build postgrest-js

# Build with watch mode for development
pnpm nx build:watch postgrest-js

# TypeScript type checking
pnpm nx type-check postgrest-js

# Generate documentation
pnpm nx docs postgrest-js
```

### Testing

**Supabase CLI Required!** The `postgrest-js` tests use the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) to run a local PostgreSQL database and PostgREST server.

#### Quick Start

```bash
# Run all tests (from monorepo root)
pnpm nx test:ci:postgrest postgrest-js
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
pnpm nx test:run postgrest-js

# Run type tests with tstyche
pnpm nx test:types postgrest-js

# Run smoke tests (CommonJS and ESM imports)
pnpm nx test:smoke postgrest-js

# Format code
pnpm nx format postgrest-js

# Check formatting
pnpm nx format:check postgrest-js
```

#### Test Infrastructure

The tests use Supabase CLI to spin up:

- **PostgreSQL** - Database with test schema and seed data (port 54322)
- **PostgREST** - REST API server that the client connects to (port 54321)

```bash
# Manually manage test infrastructure (from monorepo root)
pnpm nx test:infra postgrest-js      # Start containers
pnpm nx test:clean-pre postgrest-js  # Stop and remove containers
```

Or directly via Supabase CLI:

```bash
cd packages/core/postgrest-js
npx supabase --workdir ./test start        # Start all services
npx supabase --workdir ./test db reset     # Reset and seed database
npx supabase --workdir ./test stop         # Stop all services
```

#### Regenerating TypeScript Types

The tests are typed by declarations that `@supabase/postgrest-mapper` generates from the test schema and from the queries the tests make. After changing the schema or a query in a test, regenerate them:

```bash
# From the monorepo root
pnpm run codegen:postgrest
```

This command:

1. Uses the running test stack, or starts one for the run and stops it afterwards
2. Snapshots the schema into `test/postgrest-schema.json` (`postgrest-mapper snapshot`)
3. Generates `test/postgrest.generated.d.ts` from that snapshot and the queries in `test/**/*.test.ts` (`postgrest-mapper generate`, options in `tsconfig.test.json`)

`pnpm run codegen:check:postgrest` verifies both files without writing them.

#### Test Types Explained

- **Unit Tests** - Jest tests covering all client functionality (`pnpm nx test:run postgrest-js`)
- **Type Tests** - Validates the planner-typed builders using tstyche (`pnpm nx test:types postgrest-js`). The tests live in `test/types/` and run twice, against a loose and a strict `SupabasePgrstStatus` fixture (`tstyche.config.json` and `tstyche.strict.config.json`). `test/types/mutate.sh` is a negative control: it breaks one rule of the type machinery at a time and checks that the tests fail
- **Smoke Tests** - Basic import/require tests for CommonJS and ESM (`pnpm nx test:smoke postgrest-js`)

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
pnpm nx test:ci:v12 postgrest-js
```

This command:

1. Starts PostgREST v12 + PostgreSQL in Docker (ports 3012/5433)
2. Runs runtime tests that verify v12-specific behavior
3. Cleans up containers

**Note:** These v12 tests will be removed when v3 ships (sometime in 2026).

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.

## License

This repo is licensed under MIT License.
