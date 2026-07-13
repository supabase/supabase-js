# Migration Guide

Cross-cutting migration notes for the Supabase JavaScript SDK. One H2 section per migration theme.

> **Per-package migrations** (changes scoped to a single SDK like `@supabase/auth-js`) live alongside the package they affect, under `packages/core/<package>/migrations/`. The notes in this file cover changes that span multiple packages or the workspace as a whole.

## Edge Functions auth headers

Edge Function calls (`supabase.functions.invoke()`) now keep the `apikey` and `Authorization` headers distinct, matching the Server SDK pattern:

- The API key is always sent in the **`apikey`** header.
- **`Authorization`** carries the signed-in user's JWT (or a custom auth token). When there is no user session, a **new-format API key** (`sb_publishable_…` / `sb_secret_…`) is **no longer sent as `Authorization: Bearer <key>`** — new-format keys are not JWTs, and the gateway now accepts `apikey`-only requests (including for `verify_jwt=true` functions).

This does **not** affect other services (Database/PostgREST, Storage, Realtime), and **legacy JWT keys are unchanged** (they are still sent in `Authorization` for backward compatibility).

### What to do

Nothing for the vast majority of users — authenticated calls still send the user's JWT, and unauthenticated calls continue to work via the `apikey` header.

The only impacted case is code that **reads the API key out of the `Authorization` header inside an Edge Function** (e.g. a server-side check on `Bearer sb_...`). Those cases should read the `apikey` header instead, or migrate to [`@supabase/server`](https://supabase.com/blog/introducing-supabase-server) for edge functions.

### Unrecognized API key formats now throw

To keep the header handling correct as the `sb_` key family grows, `createClient()` now validates the key format at construction. A key that starts with `sb_` but is **not** a recognized subtype (`sb_publishable_…` / `sb_secret_…`) throws immediately, indicating that `@supabase/supabase-js` must be upgraded to a version that supports the new key type. Legacy JWT keys (which do not start with `sb_`) are unaffected.

## Node.js 18 support dropped (v2.79.0, 2025-10-31)

Starting with version `2.79.0`, all Supabase JavaScript libraries require **Node.js 20 or later**. The `@supabase/node-fetch` polyfill has been removed and native `fetch` is now required.

### Affected packages

`@supabase/supabase-js`, `@supabase/auth-js`, `@supabase/postgrest-js`, `@supabase/realtime-js`, `@supabase/storage-js`, `@supabase/functions-js`.

### Why

Node.js 18 reached end-of-life on April 30, 2025 and no longer receives security updates. Node.js 20+ ships with native `fetch`, eliminating the need for the polyfill and reducing bundle size.

### What to do

1. **Upgrade Node.js** to version 20 or later:

   ```bash
   # Check current version
   node --version

   # Via nvm
   nvm install 20
   nvm use 20

   # Or download from https://nodejs.org/
   ```

2. **Update your dependencies**:

   ```bash
   npm install @supabase/supabase-js@latest
   # or, per-package:
   npm install @supabase/auth-js@latest
   ```

3. **No code changes required** — APIs are unchanged.

### Supported runtimes

- Node.js 20+ (native fetch)
- Modern browsers
- Deno 2.x
- Bun 0.1+
- React Native and Expo (with the framework's bundled fetch polyfill)

### Troubleshooting

**`fetch is not defined`** — you're on Node.js < 20. Upgrade Node.js. If you absolutely cannot upgrade, pin to the last version that supported Node.js 18:

```bash
npm install @supabase/supabase-js@2.78.0
```

> ⚠️ Using Node.js 18 is not recommended — it no longer receives security updates.

### Reference

[Deprecation announcement](https://github.com/orgs/supabase/discussions/37217).
