# Hash-based default auth storage key

**Since:** v2.117.0
**Action required by:** anyone reading the `sb-<project-ref>-auth-token` key directly (see below). Most apps need no change.

`createClient` now persists the auth session under `sb-<hash>-auth-token`, where `<hash>` is a short hash of the Supabase URL origin. Previously the key was `sb-<first-hostname-label>-auth-token`, which is the project ref on hosted Supabase but collides for any two projects that share a first hostname label (`localhost:54321` vs `localhost:8000`, `api.foo.com` vs `api.bar.com`, self-hosted stacks behind one reverse proxy). Colliding keys meant one client silently read another project's session and PKCE verifiers.

## What changed

- **New default key.** `sb-${shortHash(new URL(supabaseUrl).origin)}-auth-token`. The hash is FNV-1a 32-bit rendered as 8 lowercase hex characters. Only the origin (scheme, host, port) is hashed; the path is ignored, so `https://xyz.supabase.co` and `https://xyz.supabase.co/` produce the same key.
- **`getDefaultStorageKey(url)` is exported** from `@supabase/supabase-js` so server code and cookie adapters can compute the exact key a browser client uses:

  ```ts
  import { getDefaultStorageKey } from '@supabase/supabase-js'

  const key = getDefaultStorageKey(process.env.SUPABASE_URL!)
  // 'sb-1a2b3c4d-auth-token'
  ```

- **Automatic one-time migration.** When `auth.storageKey` is not set, the client passes the old `sb-<ref>-auth-token` key to `@supabase/auth-js` as a legacy key. On initialization, if nothing is stored under the new key, the session, its separate `-user` entry and any pending PKCE verifiers are moved from the old key to the new one and the old entries are removed. If the new key already holds a session, the old entries are removed without being copied. Existing users stay signed in; an in-flight PKCE sign-in started before the upgrade still completes.
- **New `legacyStorageKeys` option on `GoTrueClient`** (`@supabase/auth-js`). Array of previous storage keys to migrate from; the behaviour above is what it does. Useful if you rename your own `storageKey`.

Derived keys move with the base key: `<key>-user`, `<key>-code-verifier`, `<key>-flow-<id>-code-verifier`, `<key>-flows-code-verifier`. The `BroadcastChannel` name used for cross-tab auth events is the storage key too, so tabs running the old and new SDK versions no longer share events until the old tabs reload.

## Who is affected

**Most apps: nothing to do.** If you call `createClient` and only use `supabase.auth`, the migration is transparent.

**You must act if any code reads the storage key by name:**

- `@supabase/ssr` and other server-side cookie readers that reconstruct `sb-<ref>-auth-token` themselves. Until they switch to `getDefaultStorageKey`, pin the key explicitly on both sides so browser and server agree:

  ```ts
  const supabase = createClient(url, key, {
    auth: { storageKey: `sb-${projectRef}-auth-token` },
  })
  ```

  Setting `auth.storageKey` also disables the automatic migration, so this restores the exact previous behaviour.

- End-to-end tests, browser extensions, or analytics that read `localStorage['sb-<ref>-auth-token']`. Replace the literal with `getDefaultStorageKey(url)`.
- Multi-tab deployments during rollout: a tab still running the old SDK will see its session disappear after another tab (running the new SDK) migrates it. The stale tab recovers on reload. This is deliberate: leaving the old refresh token in storage would let the stale tab rotate it later and trip GoTrue's refresh-token reuse detection for the whole session family.

## Opting out

Set `auth.storageKey` to any value, including the old default, and no hashing or migration happens.
