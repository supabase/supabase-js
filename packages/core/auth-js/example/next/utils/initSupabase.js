import { GoTrueClient } from '@supabase/gotrue-js'

const supabaseURL = 'https://evuqlpfsuimdzxurpcgn.supabase.co'
const supabaseAnon =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTYwNDIzODk3MywiZXhwIjoxOTE5ODE0OTczfQ.ud4NW5ZFc0Zky-ARnOzbzxqvLcYwVIyvk3GwW3aKC3Y'

const auth = new GoTrueClient({
  url: `${supabaseURL}/auth/v1`,
  headers: {
    accept: 'json',
    apikey: supabaseAnon,
  },
  // cookieOptions: { path: '/', name: 'meowncookie',  }, // Optional
})

export const supabase = { auth }
