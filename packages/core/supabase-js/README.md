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

## Requirements

- **Node.js 20 or later** (Node.js 18 support dropped as of October 31, 2025)
- For browser support, all modern browsers are supported

> ⚠️ **Node.js 18 Deprecation Notice**
>
> Node.js 18 reached end-of-life on April 30, 2025. As announced in [our deprecation notice](https://github.com/orgs/supabase/discussions/37217), support for Node.js 18 was dropped on October 31, 2025.

## Usage

First of all, you need to install the library:

```sh
npm install @supabase/supabase-js
```

Then you're able to import the library and establish the connection with the database:

```js
import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')
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
  const _supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')

  console.log('Supabase Instance: ', _supabase)
  // ...
</script>
```

### ESM

You can use `<script type="module">` to import supabase-js from CDNs, like:

```html
<script type="module">
  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
  const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')

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

`supabase-js` uses the [`cross-fetch`](https://www.npmjs.com/package/cross-fetch) library to make HTTP requests, but an alternative `fetch` implementation can be provided as an option. This is most useful in environments where `cross-fetch` is not compatible, for instance Cloudflare Workers:

```js
import { createClient } from '@supabase/supabase-js'

// Provide a custom `fetch` implementation as an option
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key', {
  global: {
    fetch: (...args) => fetch(...args),
  },
})
```

## Support Policy

This section outlines the scope of support for various runtime environments in Supabase JavaScript client.

### Node.js

We only support Node.js versions that are in **Active LTS** or **Maintenance** status as defined by the [official Node.js release schedule](https://nodejs.org/en/about/previous-releases#release-schedule). This means we support versions that are currently receiving long-term support and critical bug fixes.

When a Node.js version reaches end-of-life and is no longer in Active LTS or Maintenance status, Supabase will drop it in a **minor release**, and **this won't be considered a breaking change**.

### Deno

We support Deno versions that are currently receiving active development and security updates. We follow the [official Deno release schedule](https://docs.deno.com/runtime/fundamentals/stability_and_releases/) and only support versions from the `stable` and `lts` release channels.

When a Deno version reaches end-of-life and is no longer receiving security updates, Supabase will drop it in a **minor release**, and **this won't be considered a breaking change**.

### Important Notes

- **Experimental features**: Features marked as experimental may be removed or changed without notice

## Development

This package is part of the [Supabase JavaScript monorepo](https://github.com/supabase/supabase-js). To work on this package:

### Building

```bash
# From the monorepo root
npx nx build supabase-js

# Or with watch mode for development
npx nx build supabase-js --watch
```

### Testing

There's a complete guide on how to set up your environment for running locally the `supabase-js` integration tests. Please refer to [TESTING.md](./TESTING.md).

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.

## Badges

[![Coverage Status](https://coveralls.io/repos/github/supabase/supabase-js/badge.svg?branch=master)](https://coveralls.io/github/supabase/supabase-js?branch=master)
