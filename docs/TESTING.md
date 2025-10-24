# Testing Guide

This monorepo uses Nx for orchestrating tests across all packages. Each package has its own testing requirements and infrastructure.

## Quick Start

To run tests for any package:

```bash
# Basic pattern
npx nx test <package-name>

# Examples
npx nx test auth-js
npx nx test:storage storage-js  # Special command for storage-js
npx nx test postgrest-js
```

## Package-Specific Testing Guides

Each package has unique testing requirements. Please refer to the individual README files for detailed instructions:

### Core Packages

| Package          | Docker Required                          | Test Command                     | Documentation                                                    |
| ---------------- | ---------------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| **auth-js**      | ✅ Yes (GoTrue + PostgreSQL)             | `npx nx test:auth auth-js`       | [Testing Guide](../packages/core/auth-js/README.md#testing)      |
| **functions-js** | ✅ Yes (Deno relay via testcontainers)   | `npx nx test functions-js`       | [Testing Guide](../packages/core/functions-js/README.md#testing) |
| **postgrest-js** | ✅ Yes (PostgREST + PostgreSQL)          | `npx nx test postgrest-js`       | [Testing Guide](../packages/core/postgrest-js/README.md#testing) |
| **realtime-js**  | ❌ No (uses mock WebSockets)             | `npx nx test realtime-js`        | [Testing Guide](../packages/core/realtime-js/README.md#testing)  |
| **storage-js**   | ✅ Yes (Storage API + PostgreSQL + Kong) | `npx nx test:storage storage-js` | [Testing Guide](../packages/core/storage-js/README.md#testing)   |
| **supabase-js**  | ❌ No (unit tests only)                  | `npx nx test supabase-js`        | [Testing Guide](../packages/core/supabase-js/TESTING.md)         |

### Common Test Commands

```bash
# Run tests with coverage
npx nx test <package> --coverage

# Run tests in watch mode
npx nx test <package> --watch

# Run all tests across the monorepo
npx nx run-many --target=test --all
```

## Prerequisites

- **Node.js 18+** - Required for all packages
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
- **Container cleanup**: Use `npx nx test:clean <package>` if containers weren't properly removed

## Contributing Tests

When adding new features or fixing bugs:

1. Write tests that cover your changes
2. Ensure all existing tests pass
3. Update test documentation if you change testing infrastructure
4. Follow the testing patterns established in each package

For more details on contributing, see [CONTRIBUTING.md](../CONTRIBUTING.md).
