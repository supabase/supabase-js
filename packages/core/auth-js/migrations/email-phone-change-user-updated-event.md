# `USER_UPDATED` on email and phone change verification

**Since:** v3.0.0
**Action required by:** v3.0.0

`@supabase/auth-js` now emits `USER_UPDATED` on `onAuthStateChange` after a successful email-change or phone-change verification. Previously it emitted `SIGNED_IN`.

This aligns the client with how the auth server (`supabase/auth`) already classifies these flows: an email or phone change is recorded as a user modification (`UserModifiedAction`), not as a sign-in.

## What changed

For sessions established via an `email_change` or `phone_change` verification — whether through `verifyOtp({ type: 'email_change' | 'phone_change', ... })`, an implicit-grant redirect (`?type=email_change|phone_change`), or the PKCE `exchangeCodeForSession` flow — subscribers to `onAuthStateChange` now receive:

```ts
event: 'USER_UPDATED'
```

instead of the previous:

```ts
event: 'SIGNED_IN'
```

All other event types are unchanged:

- `recovery` → `PASSWORD_RECOVERY` (unchanged)
- `signup`, `invite`, `magiclink`, `email`, `sms`, etc. → `SIGNED_IN` (unchanged)

## Who is affected

Anyone with an `onAuthStateChange` listener that runs sign-in logic (analytics events, route redirects, welcome toasts, fresh-data fetches scoped to a new session) on `SIGNED_IN` and previously relied on it firing after an email or phone change.

If you do not currently handle the post-email-change or post-phone-change case explicitly, you may also miss the event entirely unless you add a handler for `USER_UPDATED`.

## What to do

Move email/phone change handling onto `USER_UPDATED`:

```ts
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // first-login work: analytics, redirects, welcome UI
  } else if (event === 'USER_UPDATED') {
    // re-fetch profile, refresh email/phone display, etc.
    // also fires after supabase.auth.updateUser() — same handler covers both
  } else if (event === 'PASSWORD_RECOVERY') {
    // show password reset UI
  }
})
```

If your previous `SIGNED_IN` handler was doing profile-refresh work specifically to pick up the new email or phone, that work belongs in the `USER_UPDATED` branch now.

## Why

The auth server treats email and phone change verifications as user modifications, not sign-ins (see `internal/api/verify.go` — both `emailChangeVerify` and the `phone_change` branch of `smsVerify` write `UserModifiedAction` to the audit log). Emitting `SIGNED_IN` on the client diverged from the server's semantics and produced spurious sign-in events on what is fundamentally a profile mutation.

This change brings auth-js in line with the server and with the other Supabase SDKs (Flutter/Dart, Swift, Kotlin, Python), which are being updated to the same behavior.
