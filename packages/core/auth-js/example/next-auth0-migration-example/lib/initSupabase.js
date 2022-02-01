import { GoTrueClient } from '@supabase/gotrue-js'

const supabaseURL = 'http://localhost:9999'

const auth = new GoTrueClient({
  url: `${supabaseURL}`,
  headers: {
    accept: 'json',
  },
  // cookieOptions: { path: '/', name: 'meowncookie',  }, // Optional
})

export const supabase = { auth }
