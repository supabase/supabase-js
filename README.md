# `supabase-js` - Isomorphic JavaScript client for Supabase, [Wechat Miniprogram](https://developers.weixin.qq.com/miniprogram/dev/framework/) compatible

Forked from supabase/supabase-js, the origional documentation can be found [here](https://supabase.github.io/supabase/supabase-js).

## Changes

Changes are made on top of <https://github.com/supabase/supabase-js/commit/ce1e2f0729068a2bcd794cc3937da07d5d38677e>

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
- feat: add wx fetch implementation
- ci: update release workflow

## Usage

```ts
/* wx-app/path/to/supabase-client */

import { createClient } from '@supabase-wechat/supabase-js'

export const supabaseClient = createClient<Database>(api_url, anon_key, {
  auth: {
    // wx storage implementation
    storage: {
      getItem: (key: string) => wx.getStorageSync(key),
      setItem: (key: string, value: string) => {
        wx.setStorage({ key, data: value })
      },
      removeItem: (key: string) => {
        wx.removeStorage({ key })
      },
    },
  },
  // Directly send api request from wx client
  wxFetch: { type: 'wx' },
  // OR
  // Use wx cloud as a a proxy (This way, 备案 is required)
  wxFetch: { type: 'wxCloud', wxCloudFnName: 'supabase-proxy' },
})
```

The wxcloud function

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
