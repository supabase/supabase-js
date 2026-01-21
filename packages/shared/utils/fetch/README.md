# @supabase/utils-fetch

Internal shared library providing fetch utilities for Supabase JavaScript SDKs.

## Purpose

Eliminates code duplication of `resolveFetch()`, `resolveResponse()`, and `resolveHeadersConstructor()` across all client libraries.

## Usage

```typescript
import {
  Fetch,
  resolveFetch,
  resolveResponse,
  resolveHeadersConstructor,
} from '@supabase/utils-fetch'
```

**Note:** This is an internal workspace library. Client libraries reference it via TypeScript project references.

## Development

- Build: `nx build fetch`
- Test: `nx test fetch`
