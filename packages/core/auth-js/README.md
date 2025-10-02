# `auth-js`

An isomorphic JavaScript client library for the [Supabase Auth](https://github.com/supabase/auth) API.

<div align="center">

[![pkg.pr.new](https://pkg.pr.new/badge/supabase/auth-js)](https://pkg.pr.new/~/supabase/auth-js)

</div>

## Docs

- Using `auth-js`: https://supabase.com/docs/reference/javascript/auth-signup
- TypeDoc: https://supabase.github.io/supabase-js/auth-js/v2/spec.json

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

- `signUp()`: https://supabase.io/docs/reference/javascript/auth-signup
- `signIn()`: https://supabase.io/docs/reference/javascript/auth-signin
- `signOut()`: https://supabase.io/docs/reference/javascript/auth-signout

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
npx nx clean auth-js         # Clean build artifacts
npx nx format auth-js        # Format code with Prettier
npx nx lint auth-js          # Run ESLint
npx nx typecheck auth-js     # TypeScript type checking
npx nx docs auth-js          # Generate documentation
```

#### Build Outputs

- **CommonJS (`dist/main/`)** - For Node.js environments
- **ES Modules (`dist/module/`)** - For modern bundlers (Webpack, Vite, Rollup)
- **TypeScript definitions (`dist/module/index.d.ts`)** - Type definitions for TypeScript projects

### Testing

**Docker Required!** The auth-js tests require a local Supabase Auth server (GoTrue) running in Docker.

```bash
# Run complete test suite (from monorepo root)
npx nx test:auth auth-js
```

This command automatically:

1. Stops any existing test containers
2. Starts a Supabase Auth server (GoTrue) and PostgreSQL database in Docker
3. Waits for services to be ready (30 seconds)
4. Runs the test suite
5. Cleans up Docker containers after tests complete

#### Individual Test Commands

```bash
# Run just the test suite (requires infrastructure to be running)
npx nx test:suite auth-js

# Manually manage test infrastructure
npx nx test:infra auth-js   # Start Docker containers
npx nx test:clean auth-js   # Stop and remove containers
```

#### Development Testing

For actively developing and debugging tests:

```bash
# Start infrastructure once
npx nx test:infra auth-js

# Run tests multiple times (faster since containers stay up)
npx nx test:suite auth-js

# Clean up when done
npx nx test:clean auth-js
```

#### Test Infrastructure

The Docker setup includes:

- **Supabase Auth (GoTrue)** - The authentication server
- **PostgreSQL** - Database for auth data
- Pre-configured with test users and settings

#### Prerequisites

- **Docker** must be installed and running
- Ports used by test infrastructure (check `infra/docker-compose.yml`)
- No full Supabase instance needed - just the Auth server

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.

## Sponsors

We are building the features of Firebase using enterprise-grade, open source products. We support existing communities wherever possible, and if the products don't exist we build them and open source them ourselves.

[![New Sponsor](https://user-images.githubusercontent.com/10214025/90518111-e74bbb00-e198-11ea-8f88-c9e3c1aa4b5b.png)](https://github.com/sponsors/supabase)
