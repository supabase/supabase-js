import { createClient, RealtimeChannel, SupabaseClient } from '../src/index'

// These tests assume that a local Supabase server is already running
// Start a local Supabase instance with 'supabase start' before running these tests
describe('Supabase Integration Tests', () => {
  // Default local dev credentials from Supabase CLI
  const SUPABASE_URL = 'http://127.0.0.1:54321'
  const ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    realtime: { heartbeatIntervalMs: 500 },
  })

  test('should connect to Supabase instance', async () => {
    expect(supabase).toBeDefined()
    expect(supabase).toBeInstanceOf(SupabaseClient)
  })

  describe('PostgREST', () => {
    test('should query data from public schema', async () => {
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

      await supabase.realtime.setAuth()
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
        .subscribe((status) => {
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
