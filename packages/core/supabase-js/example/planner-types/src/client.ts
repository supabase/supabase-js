import { createClient } from '@supabase/supabase-js'

// `createClient()` takes no type argument: the types come from the declarations `postgrest-mapper` generates in
// src/supabase.types.d.ts (global `SupabaseDatabase`, `SupabaseSelects`, ...). Hover `supabase` to see the client.
//
// supabase-js talks to `<url>/rest/v1`, the path of the Supabase API gateway. This example runs a bare PostgREST,
// which has no such prefix, so the fetch below removes it. A real project would not need this.
const url = process.env.REST_URL ?? 'http://localhost:53000'

// An `anon` JWT signed with the demo PostgREST secret (docker-compose.yml). Local demo value only.
const anonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => {
      const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      return fetch(href.replace('/rest/v1', ''), init)
    },
  },
})
