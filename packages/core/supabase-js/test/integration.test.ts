import { assert } from 'console'
import { createClient, RealtimeChannel, SupabaseClient } from '../src/index'
import { sign } from 'jsonwebtoken'
// These tests assume that a local Supabase server is already running
// Start a local Supabase instance with 'supabase start' before running these tests
// Default local dev credentials from Supabase CLI
const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'
// For Node.js < 22, we need to provide a WebSocket implementation
// Node.js 22+ has native WebSocket support
let wsTransport: any = undefined
if (typeof WebSocket === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
  try {
    wsTransport = require('ws')
  } catch (error) {
    console.warn('WebSocket not available, Realtime features may not work')
  }
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  realtime: {
    heartbeatIntervalMs: 500,
    ...(wsTransport && { transport: wsTransport }),
  },
})

describe('Supabase Integration Tests', () => {
  test('should connect to Supabase instance', async () => {
    expect(supabase).toBeDefined()
    expect(supabase).toBeInstanceOf(SupabaseClient)
  })

  describe('PostgREST', () => {
    test('should connect to PostgREST API', async () => {
      const { data, error } = await supabase.from('todos').select('*').limit(5)

      // The default schema includes a 'todos' table, but it might be empty
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    // Test creating and deleting data
    test('should create and delete a todo', async () => {
      // Create a new todo
      const { data: createdTodo, error: createError } = await supabase
        .from('todos')
        .insert({ task: 'Integration Test Todo', is_complete: false })
        .select()
        .single()

      expect(createError).toBeNull()
      expect(createdTodo).toBeDefined()
      expect(createdTodo!.task).toBe('Integration Test Todo')
      expect(createdTodo!.is_complete).toBe(false)

      // Delete the created todo
      const { error: deleteError } = await supabase.from('todos').delete().eq('id', createdTodo!.id)

      expect(deleteError).toBeNull()

      // Verify the todo was deleted
      const { data: fetchedTodo, error: fetchError } = await supabase
        .from('todos')
        .select('*')
        .eq('id', createdTodo!.id)
        .single()

      expect(fetchError).not.toBeNull()
      expect(fetchedTodo).toBeNull()
    })
  })

  describe('PostgreSQL RLS', () => {
    let user1Email: string
    let user2Email: string
    let user1Id: string
    let user2Id: string
    let user1TodoId: string
    let user2TodoId: string

    beforeAll(async () => {
      // Create two test users
      user1Email = `user1-${Date.now()}@example.com`
      user2Email = `user2-${Date.now()}@example.com`
      const password = 'password123'

      const { data: user1Data } = await supabase.auth.signUp({
        email: user1Email,
        password,
      })
      user1Id = user1Data.user!.id

      const { data: user2Data } = await supabase.auth.signUp({
        email: user2Email,
        password,
      })
      user2Id = user2Data.user!.id

      // Create todos for both users
      await supabase.auth.signInWithPassword({ email: user1Email, password })
      const { data: user1Todo } = await supabase
        .from('todos')
        .insert({ task: 'User 1 Todo', is_complete: false, user_id: user1Id })
        .select()
        .single()
      user1TodoId = user1Todo!.id

      await supabase.auth.signInWithPassword({ email: user2Email, password })
      const { data: user2Todo } = await supabase
        .from('todos')
        .insert({ task: 'User 2 Todo', is_complete: false, user_id: user2Id })
        .select()
        .single()
      user2TodoId = user2Todo!.id
    })

    afterAll(async () => {
      await supabase.auth.signOut()
    })

    test('should allow anonymous access via RLS policies', async () => {
      await supabase.auth.signOut()

      const { data, error } = await supabase.from('todos').select('*').limit(5)

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    test('should allow authenticated user to access their own data', async () => {
      await supabase.auth.signInWithPassword({ email: user1Email, password: 'password123' })

      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('id', user1TodoId)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data!.task).toBe('User 1 Todo')
    })

    test('should prevent access to other users data', async () => {
      await supabase.auth.signInWithPassword({ email: user1Email, password: 'password123' })

      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('id', user2TodoId)
        .single()

      expect(error).not.toBeNull()
      expect(data).toBeNull()
    })

    test('should allow authenticated user to create their own data', async () => {
      await supabase.auth.signInWithPassword({ email: user1Email, password: 'password123' })

      const { data, error } = await supabase
        .from('todos')
        .insert({ task: 'New User 1 Todo', is_complete: false, user_id: user1Id })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data!.task).toBe('New User 1 Todo')
    })

    test('should allow authenticated user to update their own data', async () => {
      await supabase.auth.signInWithPassword({ email: user1Email, password: 'password123' })

      const { data, error } = await supabase
        .from('todos')
        .update({ task: 'Updated User 1 Todo' })
        .eq('id', user1TodoId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data!.task).toBe('Updated User 1 Todo')
    })
  })

  describe('Authentication', () => {
    afterAll(async () => {
      // Clean up by signing out the user
      await supabase.auth.signOut()
    })

    test('should sign up a user', async () => {
      const email = `test-${Date.now()}@example.com`
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
      const email = `test-${Date.now()}@example.com`
      const password = 'password123'

      await supabase.auth.signUp({ email, password })
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      expect(error).toBeNull()
      expect(data.user).toBeDefined()
      expect(data.user!.email).toBe(email)

      const { error: signOutError } = await supabase.auth.signOut()

      expect(signOutError).toBeNull()
    })

    test('should get current user', async () => {
      const email = `test-${Date.now()}@example.com`
      const password = 'password123'

      await supabase.auth.signUp({ email, password })
      await supabase.auth.signInWithPassword({ email, password })

      const { data, error } = await supabase.auth.getUser()

      expect(error).toBeNull()
      expect(data.user).toBeDefined()
      expect(data.user!.email).toBe(email)
    })

    test('should handle invalid credentials', async () => {
      const email = `test-${Date.now()}@example.com`
      const password = 'password123'

      await supabase.auth.signUp({ email, password })

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: 'wrongpassword',
      })

      expect(error).not.toBeNull()
      expect(data.user).toBeNull()
    })

    test('should handle non-existent user', async () => {
      const email = `nonexistent-${Date.now()}@example.com`
      const password = 'password123'

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      expect(error).not.toBeNull()
      expect(data.user).toBeNull()
    })
  })

  describe('Realtime', () => {
    const channelName = `channel-${crypto.randomUUID()}`
    let channel: RealtimeChannel
    let email: string
    let password: string

    beforeEach(async () => {
      await supabase.auth.signOut()
      email = `test-${Date.now()}@example.com`
      password = 'password123'
      await supabase.auth.signUp({ email, password })

      const config = { broadcast: { self: true }, private: true }
      channel = supabase.channel(channelName, { config })
    })

    afterEach(async () => {
      await supabase.removeAllChannels()
    })

    test('is able to connect and broadcast', async () => {
      const testMessage = { message: 'test' }
      let receivedMessage: any
      let subscribed = false
      let attempts = 0

      channel
        .on('broadcast', { event: '*' }, (payload) => (receivedMessage = payload))
        .subscribe((status, err) => {
          if (status == 'SUBSCRIBED') subscribed = true
        })

      // Wait for subscription
      while (!subscribed) {
        if (attempts > 50) throw new Error('Timeout waiting for subscription')
        await new Promise((resolve) => setTimeout(resolve, 100))
        attempts++
      }

      attempts = 0

      channel.send({ type: 'broadcast', event: 'test-event', payload: testMessage })

      // Wait on message
      while (!receivedMessage) {
        if (attempts > 50) throw new Error('Timeout waiting for message')
        await new Promise((resolve) => setTimeout(resolve, 100))
        attempts++
      }
      expect(receivedMessage).toBeDefined()
      expect(supabase.realtime.getChannels().length).toBe(1)
    }, 10000)
  })
})

describe('Storage API', () => {
  const bucket = 'test-bucket'
  const filePath = 'test-file.txt'
  const fileContent = new Blob(['Hello, Supabase Storage!'], { type: 'text/plain' })

  // use service_role key for bypass RLS
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'use-service-role-key'
  const supabaseWithServiceRole = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    realtime: {
      heartbeatIntervalMs: 500,
      ...(wsTransport && { transport: wsTransport }),
    },
  })

  test('upload and list file in bucket', async () => {
    // upload
    const { data: uploadData, error: uploadError } = await supabaseWithServiceRole.storage
      .from(bucket)
      .upload(filePath, fileContent, { upsert: true })
    expect(uploadError).toBeNull()
    expect(uploadData).toBeDefined()

    // list
    const { data: listData, error: listError } = await supabaseWithServiceRole.storage
      .from(bucket)
      .list()
    expect(listError).toBeNull()
    expect(Array.isArray(listData)).toBe(true)
    if (!listData) throw new Error('listData is null')
    const fileNames = listData.map((f: any) => f.name)
    expect(fileNames).toContain('test-file.txt')

    // delete file
    const { error: deleteError } = await supabaseWithServiceRole.storage
      .from(bucket)
      .remove([filePath])
    expect(deleteError).toBeNull()
  })
})

describe('Custom JWT', () => {
  describe('Realtime', () => {
    test('will connect with a properly signed jwt token', async () => {
      const jwtToken = sign(
        {
          sub: '1234567890',
          role: 'anon',
          iss: 'supabase-demo',
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      const supabaseWithCustomJwt = createClient(SUPABASE_URL, ANON_KEY, {
        accessToken: () => Promise.resolve(jwtToken),
        realtime: {
          ...(wsTransport && { transport: wsTransport }),
        },
      })

      try {
        // Wait for subscription using Promise to avoid polling
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for subscription'))
          }, 4000)

          supabaseWithCustomJwt.channel('test-channel').subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timeout)
              // Verify token was set
              expect(supabaseWithCustomJwt.realtime.accessTokenValue).toBe(jwtToken)
              resolve()
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              clearTimeout(timeout)
              reject(err || new Error(`Subscription failed with status: ${status}`))
            }
          })
        })
      } finally {
        // Always cleanup channels and connection, even if test fails
        await supabaseWithCustomJwt.removeAllChannels()
      }
    }, 5000)
  })
})
