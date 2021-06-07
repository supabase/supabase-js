# `supabase-js`

An isomorphic Javascript client for Supabase.

- Documentation: https://supabase.io/docs/client/supabase-client

## Usage

```sh
npm install @supabase/supabase-js
```

```js
import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')
```

### UMD

You can now use plain `<script>`s to import supabase-js from CDNs, like

`<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>`
or
`<script src="https://unpkg.com/@supabase/supabase-js"></script>`.

Then you can use it from a global `supabase` variable:

```html
<script>
    const { createClient } = supabase
    supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')
  ...
</script>
```

## Sponsors

We are building the features of Firebase using enterprise-grade, open source products. We support existing communities wherever possible, and if the products don’t exist we build them and open source them ourselves. Thanks to these sponsors who are making the OSS ecosystem better for everyone.

[![New Sponsor](https://user-images.githubusercontent.com/10214025/90518111-e74bbb00-e198-11ea-8f88-c9e3c1aa4b5b.png)](https://github.com/sponsors/supabase)
