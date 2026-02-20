# Auth-js Integration Tests

Integration tests for `@supabase/auth-js` running against Supabase CLI auth infrastructure.

## Test Files

### standard/GoTrueClient.test.ts (~3,600 lines)

The main auth client integration test suite covering:

- Sign up / sign in flows (email, phone, OAuth, magic link, OTP, SSO)
- Session management (refresh, persistence, expiry, signOut)
- User management (update, metadata, factors)
- MFA (TOTP, phone factor enrollment and verification)
- WebAuthn credential flows
- PKCE flow and code exchange
- Auth state change subscriptions
- Token refresh race conditions and locks
- Anonymous sign-in
- Admin API via authAdminApiAutoConfirmEnabledClient

### standard/GoTrueClient.browser.test.ts (~1,400 lines)

Browser-specific auth tests using jsdom environment:

- OAuth PKCE flow with session retrieval from URL
- localStorage and sessionStorage persistence
- Custom storage adapters
- Tab visibility and auto-refresh behavior
- Solana Web3 credentials

### standard/GoTrueApi.test.ts (~825 lines)

GoTrueAdminApi integration tests covering:

- User CRUD (createUser, getUserById, updateUserById, deleteUser)
- Email/phone link generation
- User listing and filtering
- App metadata and user metadata updates
- OAuth client management (create, list, update, delete)
- OTP verification

## Running Tests

```bash
# Run all auth standard tests
nx test:e2e:auth:standard e2e-tests

# Run specific test file
cd e2e-tests
npm run jest tests/auth/standard/GoTrueClient.test.ts

# Run with coverage
nx test:e2e:auth:standard e2e-tests -- --coverage
```

## Test Setup

Tests use pre-configured clients from `/e2e-tests/helpers/auth/clients.ts`:

| Export                                 | Type           | Description                         |
| -------------------------------------- | -------------- | ----------------------------------- |
| `authClient`                           | GoTrueClient   | Standard client with memory storage |
| `authClientWithSession`                | GoTrueClient   | Client for session-based tests      |
| `authSubscriptionClient`               | GoTrueClient   | Client for subscription tests       |
| `clientApiAutoConfirmEnabledClient`    | GoTrueClient   | Client for signup-enabled tests     |
| `pkceClient`                           | GoTrueClient   | Client with PKCE flow enabled       |
| `autoRefreshClient`                    | GoTrueClient   | Client with auto-refresh enabled    |
| `authAdminApiAutoConfirmEnabledClient` | GoTrueAdminApi | Admin API client                    |
| `serviceRoleApiClient`                 | GoTrueAdminApi | Service role API client             |

Utility functions from `/e2e-tests/helpers/auth/utils.ts`:

- `mockUserCredentials()` - Generate random email/phone/password
- `mockUserMetadata()` - Generate random user metadata
- `mockAppMetadata()` - Generate random app metadata
- `createNewUserWithEmail()` - Create a user via admin API
- `mockOAuthClientParams()` - Generate OAuth client test params
- `createTestOAuthClient()` - Create an OAuth client via admin API

## Infrastructure

### RSA Signing Keys

Auth tests use asymmetric JWT signing (RS256) configured in `supabase/config.toml`:

```toml
[auth]
signing_keys_path = "./signing_keys.json"
```

Keys are generated at setup time by `scripts/generate-signing-keys.js` and are **not committed** to git (gitignored via `**/signing_keys.json`).

### Auth Endpoint

All clients connect to: `http://127.0.0.1:54321/auth/v1`

### Email Testing

Auth tests that send emails can inspect them via Inbucket at: `http://127.0.0.1:54324`

## Edge Cases (Phase 3)

The following tests require a separate Docker setup and are NOT included here:

- `docker-tests/asymmetric-jwt.test.ts` - Tests asymmetric JWT configuration
- `docker-tests/signup-disabled.test.ts` - Tests with signup disabled
- `docker-tests/anonymous-disabled.test.ts` - Tests with anonymous sign-in disabled
- `docker-tests/phone-otp.test.ts` - Phone OTP tests (requires SMS provider)

These will be migrated in Phase 3 with their own Docker infrastructure.

## Migration Status

✅ **Completed**: Auth-js standard tests migrated from package to e2e-tests

**Migrated Test Files (3)**:

- ✅ GoTrueClient.test.ts (3,594 lines - main integration suite)
- ✅ GoTrueClient.browser.test.ts (1,373 lines - browser-specific)
- ✅ GoTrueApi.test.ts (825 lines - admin API)

**Key Changes**:

- Imports updated from `'../src'` to `'@supabase/auth-js'`
- Helper imports updated to use `helpers/auth/` centralized helpers
- No functional test changes - same tests, same assertions

**Remaining (Phase 3)**:

- ⏳ docker-tests/ edge cases (signup-disabled, asymmetric-jwt, phone-otp)
