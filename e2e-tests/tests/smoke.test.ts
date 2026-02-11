/**
 * Smoke test to verify E2E infrastructure is working
 */
import { createTestClient, createServiceRoleClient } from '../helpers/supabase-client'
import { testUsers, postgrestUsers } from '../fixtures/users'

describe('E2E Infrastructure Smoke Test', () => {
  describe('Supabase Client', () => {
    it('should create anon client', () => {
      const client = createTestClient()
      expect(client).toBeDefined()
    })

    it('should create service role client', () => {
      const client = createServiceRoleClient()
      expect(client).toBeDefined()
    })
  })

  describe('Database Connection', () => {
    const client = createServiceRoleClient()

    it('should query PostgREST users', async () => {
      const { data, error } = await client.from('users').select('username').limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should verify seed data', async () => {
      const { data, error } = await client
        .from('users')
        .select('username')
        .eq('username', postgrestUsers.supabot.username)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.username).toBe('supabot')
    })
  })

  describe('Auth Service', () => {
    const client = createTestClient()

    it('should access auth API', async () => {
      const { data, error } = await client.auth.getSession()

      // Should return no error (even if no session)
      expect(error).toBeNull()
    })
  })

  describe('Storage Service', () => {
    const client = createServiceRoleClient()

    it('should list storage buckets', async () => {
      const { data, error } = await client.storage.listBuckets()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(Array.isArray(data)).toBe(true)

      // Should have buckets from seed data
      const bucketNames = data?.map((b) => b.name) || []
      expect(bucketNames).toContain('bucket2')
    })
  })

  describe('Test Fixtures', () => {
    it('should have test users defined', () => {
      expect(testUsers.user1).toBeDefined()
      expect(testUsers.user1.email).toBe('test-user1@supabase.io')
      expect(testUsers.user1.id).toBe('317eadce-631a-4429-a0bb-f19a7a517b4a')
    })

    it('should have postgrest users defined', () => {
      expect(postgrestUsers.supabot).toBeDefined()
      expect(postgrestUsers.supabot.username).toBe('supabot')
      expect(postgrestUsers.supabot.status).toBe('ONLINE')
    })
  })
})
