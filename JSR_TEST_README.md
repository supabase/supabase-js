# Testing JSR Publishing (TEMPORARY)

This document explains how to test JSR publishing in CI without affecting npm.

## Test Files (DO NOT MERGE)

These files are temporary for testing only:

- `.github/workflows/test-jsr-publish.yml` - Test workflow
- `scripts/test-jsr-publish.ts` - Test script with hardcoded version
- `JSR_TEST_README.md` - This file

## How to Test

### 1. Commit the test files

```bash
git add .github/workflows/test-jsr-publish.yml scripts/test-jsr-publish.ts JSR_TEST_README.md
git commit -m "test: add temporary JSR publishing test"
git push
```

### 2. Run the test workflow

1. Go to: https://github.com/supabase/supabase-js/actions/workflows/test-jsr-publish.yml
2. Click "Run workflow"
3. Select your branch (`chore/release-jsr`)
4. Click "Run workflow"

### 3. Check results

The workflow will:

- ✅ Only publish to JSR (no npm)
- ✅ Use hardcoded test version `0.0.0-jsr-test.1`
- ✅ Only test with `functions-js` (simplest package)
- ✅ Use OIDC authentication automatically
- ✅ Restore original `jsr.json` files after publish

View published package at: https://jsr.io/@supabase/functions-js/versions

### 4. Test all packages (optional)

Edit `scripts/test-jsr-publish.ts` to include all packages:

```typescript
const packages = [
  'auth-js',
  'functions-js',
  'postgrest-js',
  'realtime-js',
  'storage-js',
  'supabase-js',
]
```

Change the version if needed:

```typescript
const TEST_VERSION = '0.0.0-jsr-test.2'
```

### 5. Clean up after testing

Once testing is complete, remove the test files:

```bash
git rm .github/workflows/test-jsr-publish.yml
git rm scripts/test-jsr-publish.ts
git rm JSR_TEST_README.md
git commit -m "test: remove temporary JSR test files"
git push
```

## Local Testing

You can also test locally (will prompt for browser authentication):

```bash
npx tsx scripts/test-jsr-publish.ts
```

## Troubleshooting

### Error: "Package already published"

JSR doesn't allow re-publishing the same version. Either:

1. Change `TEST_VERSION` in the script
2. Delete the test version from JSR (if you have access)

### Error: "Authentication failed"

Ensure the workflow has `id-token: write` permission (already configured).

### Error: "Slow types"

If testing packages with slow types, they're already configured with `--allow-slow-types`.
