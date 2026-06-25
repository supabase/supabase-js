# Testing

## Prerequisites

- Docker & docker compose

### Basic testing

Run all tests:

```sh
npm run test
```

> Note: If tests fail due to connection issues, your tests may be running too soon and the infra is not yet ready.
> If that's the case, adjust the `sleep 10` duration in:
> `"test:infra": "cd infra && docker-compose down && docker-compose pull && docker-compose up -d && sleep 10",`
> to a value that works for your system setup.

### Advanced

**Start all the infrastructure:**

```sh
npm run test:infra
```

You can now open the mock mail server on `http://localhost:9000`

**Run the tests only:**

```sh
npm run test:suite
```

All emails will appear in the mock mail server.

## Passkey (WebAuthn) Tests

Passkey coverage is split across three files:

- `passkey.test.ts` — experimental-flag gating (no infra needed)
- `passkey.methods.test.ts` — unit tests for all `auth.passkey.*`, `signInWithPasskey()`,
  `registerPasskey()` and `admin.passkey.*` methods with mocked `fetch` and a simulated
  browser environment (no infra needed)
- `passkey.e2e.test.ts` — full registration/authentication ceremonies against the
  Supabase CLI Auth server

The e2e tests rely on:

- `[auth.passkey]` and `[auth.webauthn]` in `test/supabase/config.toml` (requires
  Supabase CLI >= 2.105.0)
- `test/lib/software-authenticator.ts`, a minimal software WebAuthn authenticator
  (ES256, "none" attestation, discoverable credentials) that stands in for
  `navigator.credentials` since the tests run in Node

## RSA Signing Keys

### Security Model

The auth-js tests require RSA signing keys to verify RS256 JWT tokens. **These keys are NEVER committed to the repository** for security reasons.

### Key Generation

Keys are automatically generated before tests run:

- **Locally**: `nx test:auth auth-js` or `nx test:docker auth-js` automatically generates keys via the `test:generate-keys` target
- **CI**: GitHub Actions generates fresh keys before each test run

### Manual Key Generation

If you need to generate keys manually:

```bash
cd packages/core/auth-js/test
node generate-signing-keys.js
```

This creates `test/supabase/signing_keys.json` (gitignored).

### JWT Token Generation

JWT tokens (anon, service_role, admin) are **automatically generated** at runtime from the signing keys in `test/lib/clients.ts`. No manual updates needed!

For debugging/inspection only:

```bash
cd packages/core/auth-js/test
node generate-jwt.js
```

This displays the tokens but you don't need to copy them anywhere - they're generated automatically.

## Important Notes

⚠️ **NEVER commit `signing_keys.json`** - It's in `.gitignore` for security

⚠️ **These are TEST KEYS only** - Never use in production

✅ **Fresh keys per test run** - CI generates new keys every time for maximum security
