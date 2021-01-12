const express = require('express')
const cookieParser = require('cookie-parser')
const { resolve } = require('path')
const { GoTrueClient } = require('@supabase/gotrue-js')

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

const supabase = { auth }
const app = express()

app.use(express.static('./'))
app.use(express.json())
app.use(cookieParser())

app.get('/', (req, res) => {
  const path = resolve('./index.html')
  res.sendFile(path)
})

app.post('/api/auth', (req, res) => {
  supabase.auth.api.setAuthCookie(req, res)
})

app.get('/profile', async (req, res) => {
  const { user, error } = await supabase.auth.api.getUserByCookie(req)
  console.log(user, error)
  if (!user) {
    // If no user, redirect to index.
    return res.redirect('/')
  }

  // If there is a user, return it.
  res.json(user)
})

app.listen(3000, () => console.log(`Running at http://localhost:3000`))
