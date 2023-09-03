# `supabase-js`

[![Coverage Status](https://coveralls.io/repos/github/supabase/supabase-js/badge.svg?branch=master)](https://coveralls.io/github/supabase/supabase-js?branch=master)

An isomorphic JavaScript client for Supabase.

- **Documentation:** [Supabase Documentation](https://supabase.com/docs/reference)
- TypeDoc: [Supabase TypeDoc](https://supabase.github.io/supabase-js/v2/)

## Installation

First, install the library via npm:

```sh
npm install @supabase/supabase-js
```

## Getting Started

Import the library and establish a connection with your Supabase database:

```js
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for interacting with your database
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')
```

### UMD (Universal Module Definition)

You can also use plain `<script>` tags to import supabase-js from CDNs:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>
```

Now you can access it through a global `supabase` variable:

```html
<script>
  const { createClient } = supabase
  const _supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')

  console.log('Supabase Instance: ', _supabase)
  // ...
</script>
```

### ESM (ECMAScript Modules)

```
<script type="module">
  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
  const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')

  console.log('Supabase Instance: ', supabase)
  // ...
</script>
```

### Custom `fetch` Implementation

`supabase-js` uses the [`cross-fetch`](https://www.npmjs.com/package/cross-fetch) library for making HTTP requests. However, you can provide a custom `fetch` implementation as an option, useful in certain environments:

```js
import { createClient } from '@supabase/supabase-js'

// Provide a custom `fetch` implementation as an option
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key', {
  global: {
    fetch: (...args) => fetch(...args),
  },
})
```

## Sponsors

We are building the features of Firebase using enterprise-grade, open source products. We support existing communities wherever possible, and if the products don’t exist we build them and open source them ourselves. Thanks to these sponsors who are making the OSS ecosystem better for everyone.

[![New Sponsor](https://user-images.githubusercontent.com/10214025/90518111-e74bbb00-e198-11ea-8f88-c9e3c1aa4b5b.png)](https://github.com/sponsors/supabase)
```
