/**
 * Docker-only tests: Anonymous Sign-in Disabled
 *
 * These tests require a GoTrue instance with anonymous sign-ins disabled.
 * Supabase CLI has anonymous sign-ins enabled by default.
 *
 * Run with: npx nx test:docker auth-js
 */

import { phoneClient } from './clients'

describe('Docker: Anonymous Sign-in Disabled', () => {
  test('fail to sign in anonymously when it is disabled on the server', async () => {
    const { data, error } = await phoneClient.signInAnonymously()

    expect(data?.session).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Anonymous sign-ins are disabled')
  })
})

