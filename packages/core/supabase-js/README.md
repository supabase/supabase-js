<br />
<p align="center">
  <a href="https://supabase.io">
        <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--light.svg">
      <img alt="Supabase Logo" width="300" src="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/logo-preview.jpg">
    </picture>
  </a>

  <h1 align="center">Supabase JS SDK</h1>

  <h3 align="center">Isomorphic JavaScript SDK for Supabase - combining Auth, Database, Storage, Functions, and Realtime.</h3>

  <p align="center">
    <a href="https://supabase.com/docs/guides/getting-started">Guides</a>
    ·
    <a href="https://supabase.com/docs/reference/javascript/start">Reference Docs</a>
    ·
    <a href="https://supabase.github.io/supabase-js/supabase-js/v2/spec.json">TypeDoc</a>
  </p>
</p>

<div align="center">

[![Build](https://github.com/supabase/supabase-js/workflows/CI/badge.svg)](https://github.com/supabase/supabase-js/actions?query=branch%3Amaster)
[![Package](https://img.shields.io/npm/v/@supabase/supabase-js)](https://www.npmjs.com/package/@supabase/supabase-js)
[![License: MIT](https://img.shields.io/npm/l/@supabase/supabase-js)](#license)
[![pkg.pr.new](https://pkg.pr.new/badge/supabase/supabase-js)](https://pkg.pr.new/~/supabase/supabase-js)

</div>

## Usage

First of all, you need to install the library:

```sh
npm install @supabase/supabase-js
```

Then you're able to import the library and establish the connection with the database:

```js
import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
```

### UMD

You can use plain `<script>`s to import supabase-js from CDNs, like:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

or even:

```html
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
```

Then you can use it from a global `supabase` variable:

```html
<script>
  const { createClient } = supabase
  const _supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')

  console.log('Supabase Instance: ', _supabase)
  // ...
</script>
```

### ESM

You can use `<script type="module">` to import supabase-js from CDNs, like:

```html
<script type="module">
  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
  const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')

  console.log('Supabase Instance: ', supabase)
  // ...
</script>
```

### Deno

You can use supabase-js in the Deno runtime via [JSR](https://jsr.io/@supabase/supabase-js):

```js
import { createClient } from 'jsr:@supabase/supabase-js@2'
```

### Custom `fetch` implementation

`supabase-js` uses the runtime's global `fetch` to make HTTP requests, but an alternative `fetch` implementation can be provided as an option. This is useful in environments where the global `fetch` is unavailable or where you want to customize request behavior:

```js
import { createClient } from '@supabase/supabase-js'

// Provide a custom `fetch` implementation as an option
const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key', {
  global: {
    fetch: (...args) => fetch(...args),
  },
})
```

### Distributed Tracing with OpenTelemetry

The Supabase JS SDK can attach W3C/OpenTelemetry trace context headers (`traceparent`, `tracestate`, `baggage`) to outgoing requests, enabling end-to-end request tracing from your client application through Supabase services.

Trace propagation is **opt-in** and disabled by default. When enabled, headers are only attached to requests targeting Supabase domains (`*.supabase.co`, `*.supabase.in`, `localhost`).

#### Enable trace propagation

Opting in takes two steps: install `@opentelemetry/api`, and load the tracing runtime by importing the `@supabase/supabase-js/tracing` subpath once at your application entry point. The main bundle contains no OpenTelemetry code — the subpath import is what wires it up.

```js
import '@supabase/supabase-js/tracing'
import { createClient } from '@supabase/supabase-js'
import { trace } from '@opentelemetry/api'

const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key', {
  tracePropagation: true,
})

const tracer = trace.getTracer('my-app')
await tracer.startActiveSpan('fetch-users', async (span) => {
  // This request now includes the active trace context.
  const { data, error } = await supabase.from('users').select('*')
  span.end()
})
```

The subpath imports `@opentelemetry/api` directly, so module resolution fails loudly if it is not installed. If `tracePropagation` is enabled without the subpath import, the SDK logs a one-time warning and sends requests without trace headers; if no active context exists at request time, it silently no-ops.

Trace propagation is not available via the CDN/UMD build (`https://cdn.jsdelivr.net/.../supabase.js`) — there is no way to load the tracing runtime there.

#### Advanced configuration

```typescript
interface TracePropagationOptions {
  // Enable trace propagation (default: false).
  enabled?: boolean

  // Respect upstream sampling decisions (default: true).
  // When true, non-sampled requests carry only `traceparent` (flag preserved,
  // so nothing is recorded downstream) — Supabase logs still get a trace_id,
  // while `tracestate` and `baggage` are withheld.
  respectSamplingDecision?: boolean
}
```

```js
// Always propagate the full trace context, even for non-sampled traces.
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key', {
  tracePropagation: { enabled: true, respectSamplingDecision: false },
})
```

### Namespaces

The `namespace` option keeps a client's Realtime channels, Storage objects and auth session apart from other clients of the same project, for example several development sessions sharing one branch, or tenants of a multi-tenant app:

```js
const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key', {
  namespace: 's07',
})

supabase.channel('room') // joins `s07:room`
await supabase.storage.from('photos').upload('a.png', file) // stores `s07/a.png`
```

Every request also sends an `x-supabase-namespace` header, readable in Postgres with `current_setting('request.headers', true)::json->>'x-supabase-namespace'`, and the default auth storage key includes the namespace. Server-side code adopts the caller's namespace with `namespaceFrom`, so its broadcasts and uploads land in the same namespace:

```js
import { createClient, namespaceFrom } from '@supabase/supabase-js'
import { corsHeaders } from '@supabase/supabase-js/cors' // allows the x-supabase-namespace header

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
    namespace: namespaceFrom(req),
  })
  // ...
})
```

The namespace is a convention, not an access boundary: RLS policies still decide what each user can access, and anything outside a namespaced client (the SQL editor, cron jobs, triggers) ignores it.

#### Development sessions on a shared branch

`@supabase/supabase-js/dev` lets many development sessions (developers or coding agents) share one branch. Each session gets a slot that becomes its namespace and signs in as its own test identity, so existing RLS policies keep its rows apart. It is a separate entry point, so it never ends up in production bundles.

```js
import { devSession } from '@supabase/supabase-js/dev'

const { client, uniq, adminClient } = await devSession({
  slot: 's07',
  branchRef: 'abcd1234', // throws if SUPABASE_URL belongs to another project
  signInAs: 'admin', // signs in as s07+admin@example.com with SUPABASE_DEV_PASSWORD
})

await client.from('projects').insert({ slug: uniq('slug') }) // 's07-slug-k3j9x8f2'

// Service role client restricted to the session's rows. Unmapped tables throw.
const admin = adminClient({ scope: { orders: { org_id: orgId } } })
```

`devSession` reads `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`) unless `url` and `key` are passed, refuses secret and service role keys, and refuses to run when `NODE_ENV` is `production`. The test identities must already exist on the branch.

## Support Policy

This section outlines the scope of support for various runtime environments in Supabase JavaScript client.

### Node.js

We only support Node.js versions that are in **Active LTS** or **Maintenance** status as defined by the [official Node.js release schedule](https://nodejs.org/en/about/previous-releases#release-schedule). This means we support versions that are currently receiving long-term support and critical bug fixes.

When a Node.js version reaches end-of-life and is no longer in Active LTS or Maintenance status, Supabase will drop it in a **minor release**, and **this won't be considered a breaking change**.

> ⚠️ **Node.js 18 Deprecation Notice**
>
> Node.js 18 reached end-of-life on April 30, 2025. As announced in [our deprecation notice](https://github.com/orgs/supabase/discussions/37217), support for Node.js 18 was dropped in version `2.79.0`.
>
> If you must use Node.js 18, please use version `2.78.0`, which is the last version that supported Node.js 18.

> ⚠️ **Node.js 20 Deprecation Notice**
>
> Node.js 20 reached end-of-life on April 30, 2026. As announced in [our deprecation notice](https://github.com/orgs/supabase/discussions/45715), support for Node.js 20 was dropped in version `2.110.0`.
>
> If you must use Node.js 20, please use version `2.109.0`, which is the last version that supported Node.js 20.

### Deno

We support Deno versions that are currently receiving active development and security updates. We follow the [official Deno release schedule](https://docs.deno.com/runtime/fundamentals/stability_and_releases/) and only support versions from the `stable` and `lts` release channels.

When a Deno version reaches end-of-life and is no longer receiving security updates, Supabase will drop it in a **minor release**, and **this won't be considered a breaking change**.

### Browsers

All modern browsers are supported. We support browsers that provide native `fetch` API. For Realtime features, browsers must also support native `WebSocket` API.

### Bun

We support Bun runtime environments. Bun provides native fetch support and is compatible with Node.js APIs. Since Bun does not follow a structured release schedule like Node.js or Deno, we support current stable versions of Bun and may drop support for older versions in minor releases without considering it a breaking change.

### React Native

We support React Native environments with fetch polyfills provided by the framework. Since React Native does not follow a structured release schedule, we support current stable versions and may drop support for older versions in minor releases without considering it a breaking change.

### Cloudflare Workers

We support Cloudflare Workers runtime environments. Cloudflare Workers provides native fetch support. Since Cloudflare Workers does not follow a structured release schedule, we support current stable versions and may drop support for older versions in minor releases without considering it a breaking change.

### Important Notes

- **Experimental features**: Features marked as experimental may be removed or changed without notice

## Supabase Service Compatibility

`@supabase/supabase-js` only guarantees compatibility with the latest release of
each Supabase service, unless a minimum supported version is explicitly listed
below.

Older service releases are supported on a best-effort basis, but compatibility
is not guaranteed.

If you self-host Supabase, we recommend upgrading your services to their latest
releases when upgrading the SDK.

| Service   | SDK package                                                                                                | Server releases                                                            | Lowest supported version |
| --------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------ |
| Auth      | [`@supabase/auth-js`](https://github.com/supabase/supabase-js/tree/master/packages/core/auth-js)           | [supabase/auth](https://github.com/supabase/auth/releases)                 | Latest release           |
| Storage   | [`@supabase/storage-js`](https://github.com/supabase/supabase-js/tree/master/packages/core/storage-js)     | [supabase/storage](https://github.com/supabase/storage/releases)           | Latest release           |
| Functions | [`@supabase/functions-js`](https://github.com/supabase/supabase-js/tree/master/packages/core/functions-js) | [supabase/edge-runtime](https://github.com/supabase/edge-runtime/releases) | Latest release           |
| PostgREST | [`@supabase/postgrest-js`](https://github.com/supabase/supabase-js/tree/master/packages/core/postgrest-js) | [PostgREST/postgrest](https://github.com/PostgREST/postgrest/releases)     | v12                      |
| Realtime  | [`@supabase/realtime-js`](https://github.com/supabase/supabase-js/tree/master/packages/core/realtime-js)   | [supabase/realtime](https://github.com/supabase/realtime/releases)         | Latest release           |

Where a lowest supported version is listed, some features still need a newer
server version. Those requirements are noted in the API reference for the
feature.

## Known Build Warnings

### `UNUSED_EXTERNAL_IMPORT` in Vite / Rollup / Nuxt

When bundling your app, you may see warnings like:

```
"PostgrestError" is imported from external module "@supabase/postgrest-js" but never used in "...supabase-js/dist/index.mjs".
"FunctionRegion", "FunctionsError", "FunctionsFetchError", "FunctionsHttpError" and "FunctionsRelayError" are imported from external module "@supabase/functions-js" but never used in "...".
```

**This is a false positive — your bundle is fine.** Here is why it happens:

`@supabase/supabase-js` re-exports `PostgrestError`, `FunctionsError`, and related symbols so you can import them directly from `@supabase/supabase-js`. However, our build tool merges all imports from the same package into a single import statement in the built output:

```js
// dist/index.mjs (simplified)
import { PostgrestClient, PostgrestError } from '@supabase/postgrest-js'
//       ^ used internally    ^ re-exported for you
```

Your bundler checks which names from that import are used _in the code body_, and flags `PostgrestError` as unused because it only appears in an `export` statement — not called or assigned. The export itself is the usage, but downstream bundlers don't track this correctly. This is a known Rollup/Vite limitation with re-exported external imports.

**Nothing is broken.** Tree-shaking and bundle size are unaffected.

To suppress the warning:

**Vite / Rollup (`vite.config.js` or `rollup.config.js`):**

```js
export default {
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT' && warning.exporter?.includes('@supabase/'))
          return
        warn(warning)
      },
    },
  },
}
```

**Nuxt (`nuxt.config.ts`):**

```ts
export default defineNuxtConfig({
  vite: {
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'UNUSED_EXTERNAL_IMPORT' && warning.exporter?.includes('@supabase/'))
            return
          warn(warning)
        },
      },
    },
  },
})
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.

### Building

```bash
# From the monorepo root
pnpm nx build supabase-js

# Or with watch mode for development
pnpm nx build supabase-js --watch
```

### Testing

There's a complete guide on how to set up your environment for running locally the `supabase-js` integration tests. Please refer to [TESTING.md](./TESTING.md).

## Badges

[![Coverage Status](https://coveralls.io/repos/github/supabase/supabase-js/badge.svg?branch=master)](https://coveralls.io/github/supabase/supabase-js?branch=master)
