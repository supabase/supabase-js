# JSR Publishing Setup

This document explains how JSR (JavaScript Registry) publishing is configured in this monorepo.

## Overview

Supabase JavaScript packages are published to npm, and select packages with explicit return types are also published to JSR. JSR publishing happens automatically after npm publishing in both stable and canary releases.

Currently, only packages with complete TypeScript typing (explicit return types) are published to JSR to maintain high quality standards and optimal type-checking performance.

## Current Status

**JSR publishing is configured for packages with explicit return types**

The following packages are currently published to JSR:

- @supabase/functions-js (has explicit return types)
- @supabase/supabase-js (has explicit return types)

## Authentication

JSR publishing uses **OpenID Connect (OIDC)** authentication from GitHub Actions, which is the recommended approach by JSR. This means:

- No secrets to manage or rotate
- Automatic authentication via GitHub
- Short-lived tokens for enhanced security
- Works automatically when `id-token: write` permission is set

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

3. **Type Checking**: Only packages with explicit return types are published to JSR. This ensures optimal performance and aligns with JSR's quality standards.

Published packages (with explicit return types):

- `functions-js` - Has explicit return types
- `supabase-js` - Has explicit return types (aggregates other packages)

4. **Failure Handling**: JSR publishing failures don't fail the entire release - npm releases will still succeed.

## Files Involved

- `scripts/publish-to-jsr.ts` - Main JSR publishing script
- `scripts/release-stable.ts` - Calls JSR publish after stable npm release
- `scripts/release-canary.ts` - Calls JSR publish after canary npm release
- `packages/core/*/jsr.json` - JSR configuration for each package
- `.github/workflows/publish.yml` - GitHub Actions workflow with OIDC permissions
