# Purge CDN cache for individual objects

**Since:** v2.X.Y (update at release time)
**Action required by:** none — additive API

`@supabase/storage-js` now exposes `storage.from(bucket).purgeCache(path)`, mapping to the Storage API's `DELETE /cdn/{bucket}/{path}` endpoint. Calling it invalidates the Supabase CDN cache for the named object.

## What changed

- **New method `purgeCache(path, parameters?)`** on the file-bucket API. Returns `{ data: { message }, error: null }` on success or `{ data: null, error }` on failure. Accepts an optional `parameters` object for `AbortController` signals and other fetch parameters, matching the shape used by `download`.
- The method operates on a **single object path**. No wildcards, no recursion, no prefix purging. Pass the exact path of the object whose cache you want to invalidate.

## Who is affected

Only callers who want to issue CDN invalidations. The method is additive — existing code is unchanged.

## Requirements

This API is a thin wrapper over the Storage server's `/cdn/{bucket}/*` route. Two operational requirements live entirely on the server side:

- **`service_role` key required.** The Storage server enforces a `service_role` JWT on the `/cdn` route. Calls made with the anon key or a user JWT will be rejected by the server. Use `purgeCache` from trusted backends only — do not call it from a browser with the anon key.
- **Hosted CDN feature.** On hosted Supabase the endpoint is gated behind a tenant feature flag (`purgeCache`). On self-hosted deployments the Storage service must have `CDN_PURGE_ENDPOINT_URL` configured and the `purgeCache` tenant feature enabled, otherwise the server returns an error.

## Usage

```ts
import { createClient } from '@supabase/supabase-js'

// service_role key — must not be shipped to the browser
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { data, error } = await supabase.storage.from('avatars').purgeCache('folder/avatar1.png')

if (error) {
  // Server-side errors (404 not found, 403 wrong role, tenant feature disabled, etc.)
  // surface here as StorageApiError. Network failures surface as StorageUnknownError.
}
```

### Cancelling an in-flight purge

```ts
const controller = new AbortController()

const { error } = await supabase.storage
  .from('avatars')
  .purgeCache('folder/avatar1.png', { signal: controller.signal })

// controller.abort() at any point cancels the request.
```

## What is not included

There is intentionally no `purgeCacheByPrefix` or "purge folder" variant in this release. The Storage server has no native prefix-purge endpoint, and a client-side list-then-purge-each loop would be silently non-recursive (the list endpoint is not recursive), unpaginated past 1000 objects, and sequential per object. If you need bulk invalidation, purge the specific objects you care about, or open a request against the Storage server.

## Reference

- Storage server route: `src/http/routes/cdn/purgeCache.ts` in [supabase/storage](https://github.com/supabase/storage). The route is `fastify.delete('/:bucketName/*')` mounted under `/cdn`.
- Auth gate: `src/http/routes/cdn/index.ts` registers the route with `enforceJwtRoles: [dbServiceRole]` and `requireTenantFeature('purgeCache')`.
- CDN delegation: `src/storage/cdn/cdn-cache-manager.ts` forwards to `CDN_PURGE_ENDPOINT_URL` (or errors out if unset).
