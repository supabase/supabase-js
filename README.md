# `supabase-js` - Isomorphic JavaScript client for Supabase, [Wechat Miniprogram](https://developers.weixin.qq.com/miniprogram/dev/framework/) compatibility fixed

Forked from supabase/supabase-js, the origional documentation can be found [here](https://supabase.github.io/supabase/supabase-js).

## Changes

Changes are made on top of [this commit from @supabase/supabase-js, base version number v2.46.1](https://github.com/supabase/supabase-js/commit/ce1e2f0729068a2bcd794cc3937da07d5d38677e)

- feat: add submodule `supbase-wx/auth-js` as a workspace package
  - ci: remove workflows
  - ci: ignore generated `lib/version` file on build, remove actions
  - feat: update `node-fetch` dependency, mute navigator lock
- feat: add submodule `supabase-wx/node-fetch` as a workspace package
  - ci: remove workflows
  - fix(browser.js): remove wx incompatible node fetch binding
- feat: dd submodule `supabase-wx/postgrest-js` as a workspace package
  - ci: remove workflows
  - feat: update node-fetch dependency
- fix: add polyfills for `AbortController`, `localStorage` and `Headers`, see `wx/polyfills`
- feat: add wx fetch implementation
- feat: add wx `SocketTask` implementation for realtime subscription

Currently there is no plan to publish package versions based on these changes. To actively align every upcoming official supabase-js versions are meaningless. You can freely update the fork base locally as needed, and apply the above changes or use them as a reference.

## Usage

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
  // 3. Use your own implementation
  global: {
    fetch: YourCustomFetch // will override the above options
  }


  // Optional: Add `YourCustomWxSocketTask` for wx
  // Or leave it blank and use internal custom implementation `src/wx/socket-task`
  realtime: {
    transport: YourCustomWxSocketTask
  }
})
```

If you choose the `wxFetch: { type: 'wxCloud', wxCloudFnName: 'supabase-proxy' }` option, an example wxcloud function is here:

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
