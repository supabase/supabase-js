# `supabase-js` - Isomorphic JavaScript client for Supabase, [Wechat Miniprogram](https://developers.weixin.qq.com/miniprogram/dev/framework/) compatibility fixed

Forked from supabase/supabase-js, the origional documentation can be found [here](https://supabase.github.io/supabase/supabase-js).

## Changes

Changes are made on top of [this commit from @supabase/supabase-js, base version number v2.46.1](https://github.com/supabase/supabase-js/commit/ce1e2f0729068a2bcd794cc3937da07d5d38677e)

- feat: add submodule `packages/node-fetch` as a workspace package
  - fixes `@supabase/node-fetch`, which is statically imported in more than one `@supabase/` libs, which will throw `binding` errors in wx.
  - ci: remove workflows
  - fix(browser.js): remove wx incompatible node fetch binding
- fix(`src/wx/polyfills`): add polyfills for `AbortController`, `localStorage` and `Headers`
  - polyfills are dynamically imported in `src/lib/index > createClient`
- fix(`src/wx/navigator-lock`): add navigator lock polyfill.

  ```js
  /* src/index.ts > createClient */
  new SupabaseClient(url, key, {
    ...options,
    auth: {
      ...(extraOptions.auth ?? {}),
      lock: navigatorLockNoOp,
    },
  })
  ```

- feat(`src/wx/local-storage`): add wx compatible custom localStorage implementation

  ```js
  /* src/index.ts > createClient */
  new SupabaseClient(url, key, {
    ...options,
    auth: {
      storage: wxLocalStorage,
      ...(extraOptions.auth ?? {}),
    },
  })
  ```

- feat(`src/wx/fetch`, `src/wx/fetch-cloud`): add wx compatible custom fetch implementations

  ```js
  /* src/index.ts > createClient */
  new SupabaseClient(url, key, {
    ...options,
    global: {
      fetch: customFetch,
      ...(extraOptions.global ?? {}),
    },
  })
  ```

- feat(`src/wx/socket-task`): add wx `SocketTask` implementation for realtime subscription

  ```js
  /* src/index.ts > createClient */
  new SupabaseClient(url, key, {
    ...options,
    realtime: {
      transport: WxSocketTask,
      ...(extraOptions.realtime ?? {}),
    },
  })
  ```

There may not be plan to publish package versions based on these changes. To actively align every upcoming official supabase-js versions are meaningless. You can freely update the fork base locally as needed, and apply the above changes or use them as a reference.

## Usage

### Add `@supabase/node-fetch` resolution

In your `root/path/to/package.json`, add the following resolution for yarn ([The resolutions field can only be set at the root of the project, and will generate a warning if used in any other workspace.](https://yarnpkg.com/configuration/manifest#resolutions))

```json
{
  // ...
  "resolutions": {
    "@supabase/node-fetch": "portal:./path/to/supabase-wx/packages/node-fetch"
  }
}
```

### Configure supabase client

```ts
/* your-wx-app/path/to/supabase-client */

import { createClient } from '@supabase-wechat/supabase-js'

export const supabaseClient = createClient<Database>(api_url, anon_key, {
  // Choose the custom fetch from the following alternatives
  // 1. Directly send api request from wx
  // uses `src/wx/wx-fetch`
  wxFetch: { type: 'wx' },
  // OR
  // 2. A tencent cloud function serves as a proxy, This way, traffics are handled, 备案 for an independent supabase host is not required. (However, supabase realtime is not option here.)
  // uses `src/wx/wxcloud-fetch`
  wxFetch: { type: 'wxCloud', wxCloudFnName: 'supabase-proxy' },
  // OR
  // 3. Use your own implementation and override the above options
  global: {
    // ...
    fetch: YourCustomFetch,
  },

  // Optional: Add your custom `transport` to override `src/wx/socket-task`
  realtime: {
    // ...
    transport: YourCustomTransport,
  },

  // Optional: Add your custom `storage` to override `src/wx/local-storage`
  auth: {
    // ...
    storage: YourCustomLocalStorage,
  },
})
```

### [Optional] Configure wx cloud function

If you chose the `wxFetch: { type: 'wxCloud', wxCloudFnName: 'supabase-proxy' }` option, an example wxcloud function is here:

```js
/* wxcloudfunctions/supabase-proxy/index.js */

const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

exports.main = async (event) => {
  const { url, method, data, headers, responseType } = event.reqeustOptions

  const response = await axios({
    url: url,
    method,
    data,
    responseType,
    headers,
  })
  return {
    headers: response.headers,
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  }
}
```
