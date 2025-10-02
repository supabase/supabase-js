import 'node:buffer'
import { assertEquals, assertExists } from 'https://deno.land/std@0.220.1/assert/mod.ts'
import { createClient, SupabaseClient } from '../../dist/module/index.js'
import type { RealtimeChannel } from '../../dist/module/index.js'

// These tests assume that a local Supabase server is already running
// Start a local Supabase instance with 'supabase start' before running these tests

// TODO: Remove sanitizeOps and sanitizeResources once the issue is fixed
Deno.test(
  'Supabase Integration Tests',
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    // Default local dev credentials from Supabase CLI
    const SUPABASE_URL = 'http://127.0.0.1:54321'
    const ANON_KEY =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      realtime: { heartbeatIntervalMs: 500 },
    })

    // Cleanup function to be called after all tests
    const cleanup = async () => {
      await supabase.auth.signOut()
      await supabase.auth.stopAutoRefresh()
      await supabase.removeAllChannels()
      // Give some time for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    try {
      await t.step('should connect to Supabase instance', () => {
        assertExists(supabase)
        assertEquals(supabase instanceof SupabaseClient, true)
      })

      await t.step('PostgREST - should query data from public schema', async () => {
        const { data, error } = await supabase.from('todos').select('*').limit(5)

        // The default schema includes a 'todos' table, but it might be empty
        assertEquals(error, null)
        assertEquals(Array.isArray(data), true)
      })

      await t.step('PostgREST - should create and delete a todo', async () => {
        // Create a new todo
        const { data: createdTodo, error: createError } = await supabase
          .from('todos')
          .insert({ task: 'Integration Test Todo', is_complete: false })
          .select()
          .single()

        assertEquals(createError, null)
        assertExists(createdTodo)
        assertEquals(createdTodo!.task, 'Integration Test Todo')
        assertEquals(createdTodo!.is_complete, false)

        // Delete the created todo
        const { error: deleteError } = await supabase
          .from('todos')
          .delete()
          .eq('id', createdTodo!.id)

        assertEquals(deleteError, null)

        // Verify the todo was deleted
        const { data: fetchedTodo, error: fetchError } = await supabase
          .from('todos')
          .select('*')
          .eq('id', createdTodo!.id)
          .single()

        assertExists(fetchError)
        assertEquals(fetchedTodo, null)
      })

      await t.step('Authentication - should sign up a user', async () => {
        const email = `test-${Date.now()}@example.com`
        const password = 'password123'

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        assertEquals(error, null)
        assertExists(data.user)
        assertEquals(data.user!.email, email)
      })

      await t.step('Authentication - should sign in and out successfully', async () => {
        const email = `deno-signout-${Date.now()}@example.com`
        const password = 'password123'

        await supabase.auth.signUp({ email, password })
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        assertEquals(error, null)
        assertExists(data.user)
        assertEquals(data.user!.email, email)

        const { error: signOutError } = await supabase.auth.signOut()

        assertEquals(signOutError, null)
      })

      await t.step('Authentication - should get current user', async () => {
        const email = `deno-getuser-${Date.now()}@example.com`
        const password = 'password123'

        await supabase.auth.signUp({ email, password })
        await supabase.auth.signInWithPassword({ email, password })

        const { data, error } = await supabase.auth.getUser()

        assertEquals(error, null)
        assertExists(data.user)
        assertEquals(data.user!.email, email)
      })

      await t.step('Authentication - should handle invalid credentials', async () => {
        const email = `deno-invalid-${Date.now()}@example.com`
        const password = 'password123'

        await supabase.auth.signUp({ email, password })

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: 'wrongpassword',
        })

        assertExists(error)
        assertEquals(data.user, null)
      })

      await t.step('Authentication - should handle non-existent user', async () => {
        const email = `deno-nonexistent-${Date.now()}@example.com`
        const password = 'password123'

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        assertExists(error)
        assertEquals(data.user, null)
      })

      await t.step('Realtime - is able to connect and broadcast', async () => {
        const channelName = `channel-${crypto.randomUUID()}`
        let channel: RealtimeChannel
        const email = `test-${Date.now()}@example.com`
        const password = 'password123'

        // Sign up and create channel
        await supabase.auth.signUp({ email, password })
        const config = { broadcast: { self: true }, private: true }
        channel = supabase.channel(channelName, { config })

        const testMessage = { message: 'test' }
        let receivedMessage: any
        let subscribed = false
        let attempts = 0

        channel
          .on('broadcast', { event: '*' }, (payload: unknown) => (receivedMessage = payload))
          .subscribe((status: string) => {
            if (status == 'SUBSCRIBED') subscribed = true
          })

        // Wait for subscription
        while (!subscribed) {
          if (attempts > 50) throw new Error('Timeout waiting for subscription')
          await new Promise((resolve) => setTimeout(resolve, 100))
          attempts++
        }

        attempts = 0

        channel.send({
          type: 'broadcast',
          event: 'test-event',
          payload: testMessage,
        })

        // Wait on message
        while (!receivedMessage) {
          if (attempts > 50) throw new Error('Timeout waiting for message')
          await new Promise((resolve) => setTimeout(resolve, 100))
          attempts++
        }

        assertExists(receivedMessage)
        assertEquals(supabase.realtime.getChannels().length, 1)

        // Cleanup channel
        await channel.unsubscribe()
      })

      await t.step('Storage - should upload and list file in bucket', async () => {
        const bucket = 'test-bucket'
        const filePath = 'test-file.txt'
        const fileContent = new Blob(['Hello, Supabase Storage!'], { type: 'text/plain' })

        // use service_role key for bypass RLS
        const SERVICE_ROLE_KEY =
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
        const supabaseWithServiceRole = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          realtime: { heartbeatIntervalMs: 500 },
        })

        // upload
        const { data: uploadData, error: uploadError } = await supabaseWithServiceRole.storage
          .from(bucket)
          .upload(filePath, fileContent, { upsert: true })
        assertEquals(uploadError, null)
        assertExists(uploadData)

        // list
        const { data: listData, error: listError } = await supabaseWithServiceRole.storage
          .from(bucket)
          .list()
        assertEquals(listError, null)
        assertEquals(Array.isArray(listData), true)
        if (!listData) throw new Error('listData is null')
        const fileNames = listData.map((f: any) => f.name)
        assertEquals(fileNames.includes('test-file.txt'), true)

        // delete file
        const { error: deleteError } = await supabaseWithServiceRole.storage
          .from(bucket)
          .remove([filePath])
        assertEquals(deleteError, null)
      })
    } finally {
      // Ensure cleanup runs even if tests fail
      await cleanup()
    }
  }
)
