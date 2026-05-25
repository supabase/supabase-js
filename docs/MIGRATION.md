# Migration Guide

Cross-cutting migration notes for the Supabase JavaScript SDK. One H2 section per migration theme.

> **Per-package migrations** (changes scoped to a single SDK like `@supabase/auth-js`) live alongside the package they affect, under `packages/core/<package>/migrations/`. The notes in this file cover changes that span multiple packages or the workspace as a whole.

## Node.js 18 support dropped (v2.79.0, 2025-10-31)

Starting with version `2.79.0`, all Supabase JavaScript libraries require **Node.js 20 or later**. The `@supabase/node-fetch` polyfill has been removed and native `fetch` is now required.

### Affected packages

`@supabase/supabase-js`, `@supabase/auth-js`, `@supabase/postgrest-js`, `@supabase/realtime-js`, `@supabase/storage-js`, `@supabase/functions-js`.

### Why

Node.js 18 reached end-of-life on April 30, 2025 and no longer receives security updates. Node.js 20+ ships with native `fetch`, eliminating the need for the polyfill and reducing bundle size.

### What to do

1. **Upgrade Node.js** to version 20 or later:

   ```bash
   # Check current version
   node --version

   # Via nvm
   nvm install 20
   nvm use 20

   # Or download from https://nodejs.org/
   ```

2. **Update your dependencies**:

   ```bash
   npm install @supabase/supabase-js@latest
   # or, per-package:
   npm install @supabase/auth-js@latest
   ```

3. **No code changes required** — APIs are unchanged.

### Supported runtimes

- Node.js 20+ (native fetch)
- Modern browsers
- Deno 2.x
- Bun 0.1+
- React Native and Expo (with the framework's bundled fetch polyfill)

### Troubleshooting

**`fetch is not defined`** — you're on Node.js < 20. Upgrade Node.js. If you absolutely cannot upgrade, pin to the last version that supported Node.js 18:

```bash
npm install @supabase/supabase-js@2.78.0
```

> ⚠️ Using Node.js 18 is not recommended — it no longer receives security updates.

### Reference

[Deprecation announcement](https://github.com/orgs/supabase/discussions/37217).
