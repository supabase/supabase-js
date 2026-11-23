# `signOut` keeps the session when the server logout fails

**Since:** the first release after v2.118.0
**Action required by:** none in v2.x. See [Planned for v3](#planned-for-v3).

`signOut({ scope: 'global' })` and `signOut({ scope: 'others' })` now report a server or network failure without touching the session they were asked to revoke. `signOut({ scope: 'local' })` always signs out this device.

## What changed

- **`global` (the default scope):** the local session is cleared, and `SIGNED_OUT` fires, only after the server accepts the logout. If the request fails, for example because the device is offline, the local session is kept, no `SIGNED_OUT` event fires and the error is returned.
- **`local`:** the local session is removed and `SIGNED_OUT` fires before the request to revoke the refresh token is sent, so signing out of this device never depends on the network. The request's error, if any, is still returned.
- **`others`:** the local session is never changed. A failed request returns the error.

Previously, a failed `global` sign out still cleared the local session. The refresh token then stayed valid on the server and the client no longer had the credentials to retry the revoke.

## Who is affected

**Callers that use the default scope** (`signOut()` or `signOut({ scope: 'global' })`) and assume it always ends the local session. If the device is offline or the auth server returns an error, `signOut()` now returns `{ error }` and the user stays signed in.

To always sign out this device, either use the `local` scope, or retry with it when `global` fails:

```ts
const { error } = await supabase.auth.signOut()
if (error) {
  // The server could not revoke the sessions and the user is still signed in locally.
  // Sign out this device regardless:
  await supabase.auth.signOut({ scope: 'local' })
}
```

If you only want to sign out the current tab or device, pass `{ scope: 'local' }` directly. This is usually what a "Sign out" button wants.

## Responses that still count as a successful sign out

A `401`, `403` or `404` response from the auth server is treated as "already signed out": the local session is cleared and `error` is `null`. Auth servers from v2.145.0 answer `403` with `user_not_found` (and from v2.150.0 `session_not_found`) when the user or session no longer exists, and servers before v2.145.0 answered `401` or `404`.

The status is also `403` for `bad_jwt` and `user_banned`, where nothing was revoked, so these are treated as a successful sign out too. This is known, and changing it would be a breaking change.

## Planned for v3

v3 is expected to match on the error code instead of the status: only `session_not_found` and `user_not_found` will count as already signed out, and every other error will be returned with the session kept. Callers that handle the `error` from `signOut()` as shown above need no change.
