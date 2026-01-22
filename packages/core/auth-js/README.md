<br />
<p align="center">
  <a href="https://supabase.io">
        <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--light.svg">
      <img alt="Supabase Logo" width="300" src="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/logo-preview.jpg">
    </picture>
  </a>

  <h1 align="center">Supabase Auth JS SDK</h1>

  <h3 align="center">An isomorphic JavaScript SDK for the <a href="https://github.com/supabase/auth">Supabase Auth</a> API.</h3>

  <p align="center">
    <a href="https://supabase.com/docs/guides/auth">Guides</a>
    ·
    <a href="https://supabase.com/docs/reference/javascript/auth-signup">Reference Docs</a>
    ·
    <a href="https://supabase.github.io/supabase-js/auth-js/v2/spec.json">TypeDoc</a>
  </p>
</p>

<div align="center">

[![Build](https://github.com/supabase/supabase-js/workflows/CI/badge.svg)](https://github.com/supabase/supabase-js/actions?query=branch%3Amaster)
[![Package](https://img.shields.io/npm/v/@supabase/auth-js)](https://www.npmjs.com/package/@supabase/auth-js)
[![License: MIT](https://img.shields.io/npm/l/@supabase/supabase-js)](#license)
[![pkg.pr.new](https://pkg.pr.new/badge/supabase/auth-js)](https://pkg.pr.new/~/supabase/auth-js)

</div>

## Requirements

- **Node.js 20 or later** (Node.js 18 support dropped as of October 31, 2025)
- For browser support, all modern browsers are supported

> ⚠️ **Node.js 18 Deprecation Notice**
>
> Node.js 18 reached end-of-life on April 30, 2025. As announced in [our deprecation notice](https://github.com/orgs/supabase/discussions/37217), support for Node.js 18 was dropped on October 31, 2025.

## Quick start

Install

```bash
npm install --save @supabase/auth-js
```

Usage

```js
import { AuthClient } from '@supabase/auth-js'

const GOTRUE_URL = 'http://localhost:9999'

const auth = new AuthClient({ url: GOTRUE_URL })
```

- `signUp()`: https://supabase.com/docs/reference/javascript/auth-signup
- `signIn()`: https://supabase.com/docs/reference/javascript/auth-signin
- `signOut()`: https://supabase.com/docs/reference/javascript/auth-signout

### Custom `fetch` implementation

`auth-js` uses the [`cross-fetch`](https://www.npmjs.com/package/cross-fetch) library to make HTTP requests, but an alternative `fetch` implementation can be provided as an option. This is most useful in environments where `cross-fetch` is not compatible, for instance Cloudflare Workers:

```js
import { AuthClient } from '@supabase/auth-js'

const AUTH_URL = 'http://localhost:9999'

const auth = new AuthClient({ url: AUTH_URL, fetch: fetch })
```

## Development

This package is part of the [Supabase JavaScript monorepo](https://github.com/supabase/supabase-js). To work on this package:

### Building

```bash
# Complete build (from monorepo root)
npx nx build auth-js

# Build with watch mode for development
npx nx build auth-js --watch

# Individual build targets
npx nx build:main auth-js    # CommonJS build (dist/main/)
npx nx build:module auth-js  # ES Modules build (dist/module/)

# Other useful commands
npx nx lint auth-js          # Run ESLint
npx nx typecheck auth-js     # TypeScript type checking
npx nx docs auth-js          # Generate documentation
```

#### Build Outputs

- **CommonJS (`dist/main/`)** - For Node.js environments
- **ES Modules (`dist/module/`)** - For modern bundlers (Webpack, Vite, Rollup)
- **TypeScript definitions (`dist/module/index.d.ts`)** - Type definitions for TypeScript projects

### Testing

The auth-js package has two test suites:

1. **CLI Tests** - Main test suite using Supabase CLI (331 tests)
2. **Docker Tests** - Edge case tests requiring specific GoTrue configurations (11 tests)

#### Prerequisites

- **Supabase CLI** - Required for main test suite ([installation guide](https://supabase.com/docs/guides/cli))
- **Docker** - Required for edge case tests

#### Running Tests

```bash
# Run main test suite with Supabase CLI (recommended)
npx nx test:auth auth-js

# Run Docker-only edge case tests
npx nx test:docker auth-js

# Run both test suites
npx nx test:auth auth-js && npx nx test:docker auth-js
```

#### Main Test Suite (Supabase CLI)

The `test:auth` command automatically:

1. Stops any existing Supabase instance
2. Starts a local Supabase instance via CLI
3. Runs the test suite (excludes `docker-tests/` folder)
4. Cleans up after tests complete

```bash
# Individual commands for manual control
npx nx test:infra auth-js    # Start Supabase CLI
npx nx test:suite auth-js    # Run tests only
npx nx test:clean-post auth-js  # Stop Supabase CLI
```

#### Docker Tests (Edge Cases)

The `test:docker` target runs tests that require specific GoTrue configurations not possible with a single Supabase CLI instance:

- **Signup disabled** - Tests for disabled signup functionality
- **Asymmetric JWT (RS256)** - Tests for RS256 JWT verification
- **Phone OTP / SMS** - Tests requiring Twilio SMS provider
- **Anonymous sign-in disabled** - Tests for disabled anonymous auth

These tests are located in `test/docker-tests/` and use the Docker Compose setup in `infra/docker-compose.yml`.

```bash
# Individual commands for manual control
npx nx test:docker:infra auth-js    # Start Docker containers
npx nx test:docker:suite auth-js    # Run Docker tests only
npx nx test:docker:clean-post auth-js  # Stop Docker containers
```

#### Development Testing

For actively developing and debugging tests:

```bash
# Start Supabase CLI once
npx nx test:infra auth-js

# Run tests multiple times (faster since instance stays up)
npx nx test:suite auth-js

# Clean up when done
npx nx test:clean-post auth-js
```

#### Test Infrastructure

| Suite        | Infrastructure | Configuration               |
| ------------ | -------------- | --------------------------- |
| CLI Tests    | Supabase CLI   | `test/supabase/config.toml` |
| Docker Tests | Docker Compose | `infra/docker-compose.yml`  |

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.
