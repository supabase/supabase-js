# JSR Publishing Setup

This document explains how JSR (JavaScript Registry) publishing is configured in this monorepo.

## Overview

All Supabase JavaScript packages are published to both npm and JSR. JSR publishing happens automatically after npm publishing in both stable and canary releases.

## Current Status

✅ **JSR publishing is fully configured and ready to use**

The following packages are configured for JSR publishing:

- @supabase/auth-js
- @supabase/functions-js
- @supabase/postgrest-js
- @supabase/realtime-js
- @supabase/storage-js
- @supabase/supabase-js

## Authentication

JSR publishing uses **OpenID Connect (OIDC)** authentication from GitHub Actions, which is the recommended approach by JSR. This means:

- ✅ No secrets to manage or rotate
- ✅ Automatic authentication via GitHub
- ✅ Short-lived tokens for enhanced security
- ✅ Works automatically when `id-token: write` permission is set

The workflow already has the required permissions configured:

```yaml
permissions:
  contents: read
  id-token: write # Required for JSR OIDC authentication
```

**No additional setup is required** - JSR publishing works automatically in GitHub Actions.

## How It Works

1. **Version Synchronization**: The `jsr.json` files use placeholder versions (e.g., `"0.0.0"` or `"0.0.0-automated"`). The publish script updates these to match the package.json version before publishing, then restores the original placeholder to keep the working directory clean.

2. **OIDC Authentication**: When running in GitHub Actions with `id-token: write` permission, JSR automatically authenticates using GitHub's OIDC tokens. No manual token management is required.

3. **Type Checking**: Some packages have missing explicit return types and use the `--allow-slow-types` flag temporarily. Future improvements should add explicit return types to improve performance.

   Packages requiring `--allow-slow-types`:
   - `auth-js` - Missing return types in auth client methods
   - `postgrest-js` - Missing return types in query builder methods
   - `storage-js` - Missing return types in storage methods
   - `realtime-js` - Missing return types in channel and presence methods

   Packages with explicit return types (no flag needed):
   - `functions-js` - Has explicit return types
   - `supabase-js` - Has explicit return types (aggregates other packages)

4. **Provenance**: When running in GitHub Actions, the `--provenance` flag is added for trusted publishing, linking packages to their source repository.

5. **Failure Handling**: JSR publishing failures don't fail the entire release - npm releases will still succeed.

## Files Involved

- `scripts/publish-to-jsr.ts` - Main JSR publishing script
- `scripts/release-stable.ts` - Calls JSR publish after stable npm release
- `scripts/release-canary.ts` - Calls JSR publish after canary npm release
- `packages/core/*/jsr.json` - JSR configuration for each package
- `.github/workflows/publish.yml` - GitHub Actions workflow with OIDC permissions

## Testing Locally

To test JSR publishing locally:

```bash
# Dry run (no authentication needed)
npx tsx scripts/publish-to-jsr.ts --dry-run

# Actual publish (uses interactive browser authentication)
npx tsx scripts/publish-to-jsr.ts
```

When running locally, JSR will open your browser for interactive authentication. You don't need to set up any tokens manually.

## Troubleshooting

### Publishing fails with authentication error in GitHub Actions

Ensure your workflow has the `id-token: write` permission:

```yaml
permissions:
  contents: read
  id-token: write
```

### Publishing fails with "slow types" error

This means a package is missing explicit return types. Either:

1. Add explicit return types to the code (recommended)
2. Temporarily use `--allow-slow-types` flag (already configured for affected packages)

### Working directory is dirty after publish

The publish script automatically restores the original `jsr.json` files after publishing. If you see uncommitted changes, this indicates a bug in the cleanup logic.
