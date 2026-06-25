# Testing Guide

This monorepo uses Nx for orchestrating tests across all packages. Each package has its own testing requirements and infrastructure.

## Quick Start

To run tests for any package:

```bash
# Complete test suites (recommended - handles Docker automatically)
pnpm nx test:auth auth-js                    # Complete auth-js test suite
pnpm nx test:storage storage-js              # Complete storage-js test suite
pnpm nx test:ci:postgrest postgrest-js      # Complete postgrest-js test suite
pnpm nx test functions-js                    # Standard test (uses testcontainers)
pnpm nx test realtime-js                     # Standard test (no Docker needed)
pnpm nx test supabase-js                    # Standard test (unit tests only)

# E2E tests (require local Supabase running — see E2E section below)
pnpm nx test:e2e auth-js                     # Auth-js Playwright e2e tests
pnpm nx test:e2e realtime-js                 # Realtime-js Playwright e2e tests
```

## Package-Specific Testing Guides

Each package has unique testing requirements. Please refer to the individual README files for detailed instructions:

### Core Packages

| Package          | Docker Required                          | Test Command                             | Documentation                                                    |
| ---------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| **auth-js**      | ✅ Yes (GoTrue + PostgreSQL)             | `pnpm nx test:auth auth-js`              | [Testing Guide](../packages/core/auth-js/README.md#testing)      |
| **functions-js** | ✅ Yes (Deno relay via testcontainers)   | `pnpm nx test functions-js`              | [Testing Guide](../packages/core/functions-js/README.md#testing) |
| **postgrest-js** | ✅ Yes (PostgREST + PostgreSQL)          | `pnpm nx test:ci:postgrest postgrest-js` | [Testing Guide](../packages/core/postgrest-js/README.md#testing) |
| **realtime-js**  | ❌ No (uses mock WebSockets)             | `pnpm nx test realtime-js`               | [Testing Guide](../packages/core/realtime-js/README.md#testing)  |
| **storage-js**   | ✅ Yes (Storage API + PostgreSQL + Kong) | `pnpm nx test:storage storage-js`        | [Testing Guide](../packages/core/storage-js/README.md#testing)   |
| **supabase-js**  | ❌ No (unit tests only)                  | `pnpm nx test supabase-js`               | [Testing Guide](../packages/core/supabase-js/TESTING.md)         |

### Coverage Commands

```bash
# Run tests with coverage
pnpm nx test supabase-js --coverage
pnpm nx test:coverage realtime-js
pnpm nx test:ci functions-js                 # Includes coverage
```

## E2E Tests (Playwright)

The `auth-js` and `realtime-js` packages include Playwright end-to-end tests that run against their example apps and a local Supabase instance.

### Prerequisites

- **Supabase running locally** — Start the local Supabase stack via the `supabase-js` setup target:
  ```bash
  pnpm nx test:supabase:setup supabase-js
  ```
- **Playwright Chromium** — Installed automatically by the `test:e2e` target (no separate install needed).

### Environment Variables

Each example directory ships with a `.env.local.ci` file pre-configured for the default local Supabase instance (`http://127.0.0.1:54321`). The `test:e2e` target copies this file to `.env.local` automatically.

If you're using a custom local Supabase setup, create `.env.local` manually in the example directory:

| Package       | Directory                              | Variables                                                          |
| ------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `auth-js`     | `packages/core/auth-js/example/react/` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`       |
| `realtime-js` | `packages/core/realtime-js/example/`   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

### Running E2E Tests

```bash
# Run individually
pnpm nx test:e2e auth-js
pnpm nx test:e2e realtime-js

# Run both sequentially (avoids port conflicts)
pnpm nx run-many --target=test:e2e --projects=auth-js,realtime-js --parallel=1
```

> **Note:** Run with `--parallel=1` when running both together — the apps use different ports (5173 and 3000) but share the same local Supabase, and sequential execution avoids potential resource conflicts.

### What the Tests Cover

| Package       | Test file                                | Scenarios                                                                   |
| ------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| `auth-js`     | `example/react/tests/auth-flows.spec.ts` | Sign-up, sign-in, sign-out, anonymous auth, magic link, session persistence |
| `realtime-js` | `example/tests/chat.spec.ts`             | Send messages, room switching, broadcast between clients, presence          |

### Playwright Reports

On failure, test traces and screenshots are saved locally. In CI, Playwright HTML reports are uploaded as workflow artifacts.

## Prerequisites

- **Node.js 20+** - Required for all packages
- **Docker** - Required for auth-js, functions-js, postgrest-js, and storage-js
- **Ports** - Various packages use different ports for test infrastructure (see individual READMEs)

## CI Testing

In CI environments, tests are run automatically using GitHub Actions. The CI pipeline:

1. Sets up Node.js and Docker
2. Installs dependencies
3. Runs tests for all affected packages
4. Generates coverage reports

For CI-specific test commands, many packages have a `test:ci` target that includes coverage reporting.

## Troubleshooting

For package-specific issues, consult the troubleshooting section in each package's README. Common issues:

- **Port conflicts**: Check if required ports are already in use
- **Docker not running**: Ensure Docker Desktop is started
- **Container cleanup**: Use `pnpm nx test:clean-post <package>` if containers weren't properly removed

## Contributing Tests

When adding new features or fixing bugs:

1. Write tests that cover your changes
2. Ensure all existing tests pass
3. Update test documentation if you change testing infrastructure
4. Follow the testing patterns established in each package

For more details on contributing, see [CONTRIBUTING.md](../CONTRIBUTING.md).
