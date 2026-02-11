/**
 * Storage Client Helpers for E2E Tests
 */
import { StorageClient } from '@supabase/storage-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const STORAGE_URL = `${SUPABASE_URL}/storage/v1`
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

/**
 * Create a storage client with service_role key (bypasses RLS)
 */
export function createStorageClient(): StorageClient {
  return new StorageClient(STORAGE_URL, {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  })
}

/**
 * Create a storage client with anon key
 */
export function createAnonStorageClient(): StorageClient {
  return new StorageClient(STORAGE_URL, {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  })
}

/**
 * Create or find a bucket for testing
 */
export async function findOrCreateBucket(
  client: StorageClient,
  name: string,
  isPublic = true
): Promise<string> {
  const { error: bucketNotFound } = await client.getBucket(name)

  if (bucketNotFound) {
    const { error } = await client.createBucket(name, { public: isPublic })
    if (error) {
      throw new Error(`Failed to create bucket: ${error.message}`)
    }
  }

  return name
}

/**
 * Create a new bucket with unique name
 */
export async function createNewBucket(
  client: StorageClient,
  isPublic = true,
  prefix = ''
): Promise<string> {
  const bucketName = `${prefix ? prefix + '-' : ''}bucket-${Date.now()}`
  const { error } = await client.createBucket(bucketName, { public: isPublic })
  if (error) {
    throw new Error(`Failed to create bucket: ${error.message}`)
  }
  return bucketName
}

/**
 * Delete a bucket
 */
export async function deleteBucket(client: StorageClient, name: string): Promise<void> {
  const { error } = await client.deleteBucket(name)
  if (error && !error.message.includes('not found')) {
    throw new Error(`Failed to delete bucket: ${error.message}`)
  }
}

/**
 * Get storage connection info
 */
export function getStorageInfo() {
  return {
    url: STORAGE_URL,
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    anonKey: SUPABASE_ANON_KEY,
  }
}
