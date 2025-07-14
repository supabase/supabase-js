import { test, expect } from 'bun:test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  realtime: { heartbeatIntervalMs: 500 },
})

test('should subscribe to realtime channel', async () => {
  await supabase.auth.signOut()
  const email = `bun-test-${Date.now()}@example.com`
  const password = 'password123'
  await supabase.auth.signUp({ email, password })
  await supabase.realtime.setAuth()

  const channelName = `bun-channel-${crypto.randomUUID()}`
  const config = { broadcast: { self: true }, private: true }
  const channel = supabase.channel(channelName, { config })

  let subscribed = false
  let attempts = 0

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      subscribed = true
    }
  })

  // Wait for subscription
  while (!subscribed) {
    if (attempts > 100) throw new Error('Timeout waiting for subscription')
    await new Promise((resolve) => setTimeout(resolve, 100))
    attempts++
  }

  expect(subscribed).toBe(true)
  expect(supabase.realtime.getChannels().length).toBe(1)

  // Cleanup
  await supabase.removeAllChannels()
}, 10000)

test('should sign up a user', async () => {
  await supabase.auth.signOut()
  const email = `bun-auth-${Date.now()}@example.com`
  const password = 'password123'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  expect(error).toBeNull()
  expect(data.user).toBeDefined()
  expect(data.user!.email).toBe(email)
})

test('should sign in and out successfully', async () => {
  await supabase.auth.signOut()
  const email = `bun-signin-${Date.now()}@example.com`
  const password = 'password123'

  await supabase.auth.signUp({ email, password })

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  expect(error).toBeNull()
  expect(data.user).toBeDefined()
  expect(data.user!.email).toBe(email)

  const { error: signOutError } = await supabase.auth.signOut()

  expect(signOutError).toBeNull()
})

test('should get current user', async () => {
  await supabase.auth.signOut()
  const email = `bun-getuser-${Date.now()}@example.com`
  const password = 'password123'

  await supabase.auth.signUp({ email, password })
  await supabase.auth.signInWithPassword({ email, password })

  const { data, error } = await supabase.auth.getUser()

  expect(error).toBeNull()
  expect(data.user).toBeDefined()
  expect(data.user!.email).toBe(email)
})

test('should handle invalid credentials', async () => {
  await supabase.auth.signOut()
  const email = `bun-invalid-${Date.now()}@example.com`
  const password = 'password123'

  await supabase.auth.signUp({ email, password })

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: 'wrongpassword',
  })

  expect(error).not.toBeNull()
  expect(data.user).toBeNull()
})
