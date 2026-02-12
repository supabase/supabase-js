# Functions-js Integration Tests

Integration tests for `@supabase/functions-js` running against Supabase CLI Edge Functions infrastructure.

## Test Files

### hello.spec.ts

Tests basic Edge Function invocation with various authentication scenarios:

- **invoke hello with auth header** - Basic function invocation with authentication
- **invoke hello with setAuth** - Using setAuth() method
- **invoke hello with setAuth wrong key** - Error handling for invalid JWT
- **auth override tests** - Testing auth header precedence and overrides
- **custom fetch tests** - Testing custom fetch implementations

### hijack.spec.ts

Tests connection hijacking behavior:

- **invoke func** - Verifies that connection upgrade is not supported

### params.spec.ts

Tests parameter passing, headers, regions, and body handling:

- **Core invocation** - Basic mirror function invocation
- **Headers** - Client headers, invoke headers, custom headers
- **Regions** - Setting and overriding function regions
- **Body types** - FormData, JSON, ArrayBuffer, Blob, URL params
- **Body stringify** - Testing automatic body stringification with custom Content-Type

### timeout.spec.ts

Tests timeout and abort signal handling:

- **invoke slow function without timeout** - Default behavior
- **invoke slow function with short timeout** - Timeout error handling
- **invoke slow function with long timeout** - Successful completion
- **timeout with custom AbortSignal** - Combining timeout with manual abort

## Running Tests

```bash
# Run all functions tests
nx test:e2e:functions e2e-tests

# Run specific test file
cd e2e-tests
npm run jest tests/functions/hello.spec.ts

# Run with coverage
nx test:e2e:functions e2e-tests -- --coverage
```

## Test Setup

Tests use shared helpers from `/e2e-tests/helpers/functions-client.ts`:

- `createFunctionsClient(options?)` - Creates client with anon key
- `createServiceRoleFunctionsClient(options?)` - Creates client with service_role key
- `createFunctionsClientWithKey(apiKey, options?)` - Creates client with custom API key
- `getFunctionsInfo()` - Get connection details
- `FUNCTIONS_URL_EXPORT` - Functions URL

## Edge Functions

Tests run against the following Edge Functions deployed in `/e2e-tests/supabase/functions/`:

- **hello** - Returns "Hello World", tests basic invocation
- **mirror** - Echoes back request details (headers, body, method, URL)
- **slow** - Delays response by 3 seconds, tests timeout handling
- **hijack** - Tests connection upgrade restrictions

## Configuration

Functions are configured in `/e2e-tests/supabase/config.toml`:

```toml
[functions.hello]
enabled = true
verify_jwt = false

[functions.mirror]
enabled = true
verify_jwt = false

[functions.slow]
enabled = true
verify_jwt = false

[functions.hijack]
enabled = true
verify_jwt = false
```

## Notes

- Tests run against local Supabase CLI (http://127.0.0.1:54321/functions/v1)
- Tests use anon key by default
- Tests run sequentially (`--runInBand`) to prevent race conditions
- Original tests location: `packages/core/functions-js/test/spec/`

## Migration Status

✅ **Completed**: Functions-js tests migrated from Testcontainers to Supabase CLI Edge Functions

**Migrated Test Files (4)**:

- ✅ hello.spec.ts (306 lines - auth scenarios)
- ✅ hijack.spec.ts (44 lines - connection upgrade)
- ✅ params.spec.ts (547 lines - parameters, headers, regions, bodies)
- ✅ timeout.spec.ts (122 lines - timeout handling)

**Key Changes**:

- Removed Testcontainers relay system
- Direct calls to Supabase CLI Edge Functions
- Use shared helper functions from `helpers/functions-client.ts`
- Simplified test setup (no container management)
- Maintained all test coverage

**Next Step**: Keep old tests running in CI alongside new e2e tests for validation period (1-2 weeks)
