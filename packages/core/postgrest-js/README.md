# Postgrest JS

Isomorphic JavaScript client for [PostgREST](https://postgrest.org). The goal of this library is to make an "ORM-like" restful interface. 

## Documentation

Full documentation can be found on our [website](https://supabase.io/docs/postgrest/client/postgrest-client).

### Quick start

Install

```bash
npm install @supabase/postgrest-js
```

Usage

```js
import { PostgrestClient } from '@supabase/postgrest-js'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient(REST_URL)
```

- select(): https://supabase.io/docs/postgrest/client/select
- insert(): https://supabase.io/docs/postgrest/client/insert
- update(): https://supabase.io/docs/postgrest/client/update
- delete(): https://supabase.io/docs/postgrest/client/delete

## License

This repo is liscenced under MIT.

## Credits

- https://github.com/calebmer/postgrest-client - originally forked and adapted from @calebmer's library



## Sponsors

We are building the features of Firebase using enterprise-grade, open source products. We support existing communities wherever possible, and if the products don’t exist we build them and open source them ourselves. Thanks to these sponsors who are making the OSS ecosystem better for everyone.

[![New Sponsor](https://user-images.githubusercontent.com/10214025/90518111-e74bbb00-e198-11ea-8f88-c9e3c1aa4b5b.png)](https://github.com/sponsors/supabase)


![Watch this repo](https://gitcdn.xyz/repo/supabase/monorepo/master/web/static/watch-repo.gif "Watch this repo")
