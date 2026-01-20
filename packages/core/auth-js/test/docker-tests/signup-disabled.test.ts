/**
 * Docker-only tests: Signup Disabled
 *
 * These tests require a GoTrue instance with signup disabled.
 * This configuration is not possible with a single Supabase CLI instance.
 *
 * Run with: npx nx test:docker auth-js
 */

import { signupDisabledClient } from './clients'
import { mockUserCredentials } from '../lib/utils'

describe('Docker: Sign Up Disabled', () => {
  test('User cannot sign up when signups are disabled', async () => {
    const { email, password } = mockUserCredentials()

    const {
      error,
      data: { user },
    } = await signupDisabledClient.signUp({
      email,
      password,
    })

    expect(user).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toEqual('Signups not allowed for this instance')
  })
})

