# Lockless auth coordination

**Since:** v2.X.Y (update at release time)
**Action required by:** v3.0.0

`@supabase/auth-js` now coordinates session refreshes without a shared mutex by default. The legacy `lock` option is still honored when supplied, but it is deprecated and will be removed in v3.

## What changed

- **Default coordination is lockless.** A client constructed without a `lock` option no longer acquires `navigator.locks` or any in-process lock. In-tab concurrent refreshes are deduplicated via the pre-existing single-flight (`refreshingDeferred`); cross-tab refresh races are resolved by GoTrue's server-side parent-of-active mechanism on the v1 refresh-token path.
- **Commit guard inside `_callRefreshToken`.** The client snapshots storage before the rotated-token fetch and re-reads after. If a non-null pre-fetch snapshot was cleared between the two reads (typical case: a concurrent `signOut` ran `_removeSession`), the rotated tokens are discarded instead of being written back over the cleared storage. The discarded result resolves with `{ data: null, error: new AuthRefreshDiscardedError() }`.
- **New `AuthRefreshDiscardedError`** (with `isAuthRefreshDiscardedError` type guard). Surfaces through `refreshSession()` and `getSession()` results when the commit guard fires. Distinct from `AuthRetryableFetchError` (transient network) and `AuthApiError` (server rejection).
- **New `client.auth.dispose()`.** Tears down the auto-refresh interval, the `visibilitychange` listener, the `BroadcastChannel`, and registered `onAuthStateChange` subscribers. Idempotent. Designed for React Strict Mode and HMR cleanup hooks. In-flight `fetch` calls are not aborted — they run to completion.
- **`lock` and `lockAcquireTimeout` options.** Accepted and honored when supplied (legacy opt-in path); both are `@deprecated` and will be removed in v3.

## Who is affected

**Most callers: nothing to do.** If you do not pass a `lock` option to `createClient` / `GoTrueClient`, you are already on the lockless default path and will get the bug fixes and new APIs without any code change.

**Callers passing a custom `lock`** (typically React Native `processLock`, Node multi-process setups with shared AsyncStorage, or a custom lock implementation):

- v2.x (this release): your custom `lock` is still invoked exactly as before. The legacy `_acquireLock` machinery is preserved on an opt-in path gated by `settings.lock != null`. No code change required.
- v3.0.0 (planned): the `lock` and `lockAcquireTimeout` options will be removed entirely. Drop them from your client options before upgrading to v3.

## New APIs worth knowing

### `client.auth.dispose()`

Tears down the client's background work in one call. Safe to call repeatedly.

```ts
useEffect(() => {
  const supabase = createClient(URL, KEY)
  return () => {
    supabase.auth.dispose()
  }
}, [])
```

### `AuthRefreshDiscardedError`

Returned from `refreshSession()` / `getSession()` when the commit guard discards a successfully-rotated session.

```ts
import { isAuthRefreshDiscardedError } from '@supabase/auth-js'

const { data, error } = await supabase.auth.refreshSession()
if (isAuthRefreshDiscardedError(error)) {
  // A concurrent signOut cleared storage between fetch start and now.
  // The rotated tokens were discarded; the SIGNED_OUT event already fired.
  // Treat as a successful no-op — no need to retry.
}
```

## Behavior changes worth flagging

- **`_autoRefreshTokenTick` may run concurrently with `signOut` / `setSession` / `getUser`** on the lockless default path. Previously the tick used `_acquireLock(0, ...)` which skipped whenever any auth op held the lock. The lockless equivalent only skips when `refreshingDeferred` is set. The commit guard keeps storage consistent under the new concurrency. The legacy lock opt-in path retains the old skip-on-any-lock behavior.
- **`onAuthStateChange` async callbacks** that call `getUser`, `setSession`, or read the session from inside the callback are now safe on the default path (previously deadlocked through the lock). One residual hazard remains: calling `refreshSession` (or anything routing through `_callRefreshToken`) from inside a `TOKEN_REFRESHED` handler still deadlocks via `refreshingDeferred`. The `@deprecated` marker on the async overload is kept with its reason updated to point at this specific case.
- **Subscriber timing on the default path:** subscribers stay awaited; same as before. What changes is that `signOut` no longer waits for an in-flight refresh's HTTP and continuation to finish before its own fetch goes out. Both fetches now run concurrently, and the commit guard keeps storage consistent.

## Timing & concurrency notes for downstream consumers

Removing the default `_acquireLock(...)` wrapper changes the _microtask shape_ of `getSession`, `getUser`, `refreshSession`, `setSession`, `signOut`, `_initialize`, and `_reauthenticate`. Application behavior is unchanged — these methods still return the same values — but the await chain is shorter.

### What changed in the await chain

Previously, each of those methods looked like:

```ts
return await this._acquireLock(this.lockAcquireTimeout, async () => {
  return await this._getUser()
})
```

`_acquireLock` awaited `navigator.locks.request` (browser) or the in-process `processLock` (Node). That added a handful of microtasks before the inner operation ran. On the lockless default path, the wrapper is skipped and the inner operation runs directly:

```ts
if (this.lock) {
  return await this._acquireLock(this.lockAcquireTimeout, async () => {
    return await this._getUser()
  })
}
return await this._getUser()
```

### Downstream impact via `fetchWithAuth`

`supabase-js` wraps the user's `fetch` via `fetchWithAuth` (in `packages/core/supabase-js/src/SupabaseClient.ts`), which awaits `_getAccessToken()` before every PostgREST, Storage, and Functions request. With the shorter pre-fetch await chain, concurrent client calls — for example `Promise.all([supabase.rpc(...), supabase.rpc(...)])` or `Promise.all(rows.map((r) => supabase.from(...).insert(...)))` — may reach the network layer in a different micro-order than they did on v2.106 and earlier.

### What this can surface as

Tests that use order-sensitive mocks (nock, MSW, or any interceptor that matches requests in registration order) against parallel client calls may flip. A concrete example from the wild: a downstream worker repo registered two `nock(URL).post('/rest/v1/rpc/queue_job', body => expect(body).toMatchInlineSnapshot(...)).reply(200)` interceptors back-to-back, one expecting database `333`, the other expecting database `222`, and relied on the calls arriving in that order. The application code dispatched both via `Promise.all(replicas.map((r) => supabase.rpc('queue_job', ...)))`. On v2.107 the arrival order flipped, the first interceptor's body matcher ran against the wrong payload, vitest raised `toMatchInlineSnapshot with different snapshots cannot be called at the same location`, and the unmatched interceptor caused a "pending mocks left" failure at teardown.

The application behavior was correct in both versions: both RPCs completed, both rows ended up in the queue. Only the _test_ depended on an ordering that was never guaranteed.

### Recommended fix pattern

Make mocks order-independent. Two common shapes:

1. **Branch the body matcher on a discriminator field.** Register one interceptor with `.times(N)`; inside the body matcher, look at a field on the request body (e.g. an `id`) and assert against the expected payload for that id.

   ```ts
   const expected: Record<number, unknown> = {
     222: {
       /* expected body for replica 222 */
     },
     333: {
       /* expected body for replica 333 */
     },
   }

   nock(URL)
     .post('/path', (body) => {
       expect(body).toStrictEqual(expected[body.id])
       return true
     })
     .times(2)
     .reply(200)
   ```

2. **Capture and assert as a set.** Push each received body into an array from the matcher, return `true` to accept, then after the parallel block resolves assert the array's _contents_ (e.g. via `expect(received).toEqual(expect.arrayContaining([...]))`) without pinning order.

Do not pin behavior to lock-induced delays. They were incidental, not a guarantee — and they may shift again in future patch releases as internal awaits are refactored.

The custom-`lock` opt-in path retains the old await shape and is unaffected by this section.

## Migration steps

### If you do not pass a custom `lock` (most users)

No action required for v2. No action required for v3.

### If you pass a custom `lock` (e.g., React Native `processLock`)

No action required for v2 — your lock continues to work.

For v3 readiness:

1. Remove `lock` and `lockAcquireTimeout` from your `createClient` / `GoTrueClient` options before upgrading to v3.
2. If you depended on cross-process serialization (e.g., Node multi-process with shared AsyncStorage), validate that the lockless coordination (in-tab single-flight + server parent-of-active) is sufficient for your runtime. The default is safe for the cases the lock was originally added to handle (cross-tab refresh races), since the server resolves them.

```ts
// Before (v2.x, still works):
const supabase = createClient(URL, KEY, {
  auth: { lock: processLock, lockAcquireTimeout: 5000 },
})

// After (v3-ready):
const supabase = createClient(URL, KEY)
```

## Reference

- Server-side parent-of-active mechanism: `internal/tokens/service.go:376-385` in the [supabase/auth](https://github.com/supabase/auth) repo (v1 branch, the `*models.RefreshToken` type assertion). When a request arrives with a revoked refresh token whose child is the currently-active token, the server returns the active token instead of rejecting — both tabs receive the same rotated token under DB row locking.
- `lib/locks.ts` exports (`navigatorLock`, `processLock`, `LockAcquireTimeoutError`, `NavigatorLockAcquireTimeoutError`, `ProcessLockAcquireTimeoutError`, `internals`) remain available for direct imports, marked `@deprecated`. Direct callers who use these exports outside the `GoTrueClient` constructor option are unaffected.
