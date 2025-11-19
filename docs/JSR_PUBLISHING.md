# JSR Publishing Setup

This document explains how JSR (JavaScript Registry) publishing is configured in this monorepo.

## Overview

All Supabase JavaScript packages are published to both npm and JSR. JSR publishing happens automatically after npm publishing in both stable and canary releases.

## Current Status

✅ **JSR publishing is configured but requires authentication setup**

The following packages are configured for JSR publishing:

- @supabase/auth-js
- @supabase/functions-js
- @supabase/postgrest-js
- @supabase/realtime-js
- @supabase/storage-js
- @supabase/supabase-js

## Setup Requirements

### 1. Create JSR Access Token

1. Go to https://jsr.io/account/tokens
2. Create a new access token with publish permissions
3. Copy the token (it won't be shown again)

### 2. Add GitHub Secret

Add the token as a GitHub secret named `JSR_TOKEN` in your repository settings.

## How It Works

1. **Version Synchronization**: The `jsr.json` files use `"0.0.0-automated"` as a placeholder. The publish script updates this to match the package.json version before publishing.

2. **Type Checking**: Some packages have missing explicit return types. These use the `--allow-slow-types` flag temporarily. Future improvements should add explicit return types to improve performance.

3. **Provenance**: When running in GitHub Actions with proper authentication, the `--provenance` flag is added for trusted publishing.

4. **Failure Handling**: JSR publishing failures don't fail the entire release - npm releases will still succeed.

## Files Involved

- `scripts/publish-to-jsr.ts` - Main JSR publishing script
- `scripts/release-stable.ts` - Calls JSR publish after stable npm release
- `scripts/release-canary.ts` - Calls JSR publish after canary npm release
- `packages/core/*/jsr.json` - JSR configuration for each package

## Testing

To test JSR publishing locally:

```bash
# Dry run (no authentication needed)
npx tsx scripts/publish-to-jsr.ts --dry-run

# Actual publish (requires authentication)
JSR_TOKEN=your-token-here npx tsx scripts/publish-to-jsr.ts
```
