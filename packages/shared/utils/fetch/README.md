# @supabase/utils-fetch

Internal shared fetch utilities for Supabase JavaScript SDKs.

## Overview

This is a **private, non-publishable** internal library that provides shared fetch functionality for all Supabase core packages.

## Purpose

- Consolidates fetch implementations from multiple packages
- Provides consistent fetch behavior across the SDK
- Reduces code duplication
- Simplifies testing and maintenance

## Usage

This library is consumed by all packages under `packages/core/*`:

```typescript
import { resolveFetch, resolveResponse, resolveHeadersConstructor } from '@supabase/utils-fetch'

// Resolve fetch implementation (custom or native)
const fetchImpl = resolveFetch(customFetch)

// Resolve Response constructor
const ResponseImpl = resolveResponse()

// Resolve Headers constructor
const HeadersImpl = resolveHeadersConstructor()
```

## API

### `resolveFetch(customFetch?: Fetch): Fetch`

Resolves the fetch implementation to use. If a custom fetch is provided, it will be wrapped and returned. Otherwise, the native fetch is used.

### `resolveResponse(): typeof Response`

Returns the native Response constructor.

### `resolveHeadersConstructor(): typeof Headers`

Returns the native Headers constructor.

## Development

This library uses Vitest for testing and TypeScript for compilation.

```bash
# Build the library
nx build fetch

# Run tests
nx test fetch

# Lint
nx lint fetch
```

## Note

This library is **bundled** into consuming packages and is not published separately to npm. End users will not see this package as a dependency.
