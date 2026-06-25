/**
 * Docker-only tests: Phone OTP / SMS
 *
 * These tests require a GoTrue instance with an SMS provider (Twilio) configured.
 * Supabase CLI doesn't have an SMS provider enabled by default.
 *
 * Run with: npx nx test:docker auth-js
 */

import { phoneClient, autoConfirmClient } from './clients'
import { mockUserCredentials } from '../lib/utils'

const TEST_USER_DATA = { info: 'some info' }

describe('Docker: Phone Resend', () => {
  test.each([
    {
      name: 'resend with phone with options',
      params: {
        phone: mockUserCredentials().phone,
        type: 'phone_change' as const,
        options: {
          captchaToken: 'some_token',
        },
      },
    },
    {
      name: 'resend with phone with empty options',
      params: {
        phone: mockUserCredentials().phone,
        type: 'phone_change' as const,
        options: {},
      },
    },
  ])('$name', async ({ params }) => {
    const { error } = await phoneClient.resend(params)
    expect(error).toBeNull()
  })
})

describe('Docker: Phone OTP Auth', () => {
  test('signInWithOtp() with phone', async () => {
    const { phone } = mockUserCredentials()

    const { data, error } = await phoneClient.signInWithOtp({
      phone,
      options: {
        shouldCreateUser: true,
        data: { ...TEST_USER_DATA },
        channel: 'whatsapp',
        captchaToken: 'some_token',
      },
    })
    expect(error).not.toBeNull()
    expect(data.session).toBeNull()
    expect(data.user).toBeNull()
  })

  test('signUp() with phone and options', async () => {
    const { phone, password } = mockUserCredentials()

    const { error, data } = await phoneClient.signUp({
      phone,
      password,
      options: {
        data: { ...TEST_USER_DATA },
        channel: 'whatsapp',
        captchaToken: 'some_token',
      },
    })

    // Since auto-confirm is off, we should either:
    // 1. Get an error (e.g. invalid phone number, captcha token)
    // 2. Get a success response but with no session (needs verification)
    expect(data.session).toBeNull()
    if (error) {
      expect(error).not.toBeNull()
      expect(data.user).toBeNull()
    } else {
      expect(data.user).not.toBeNull()
      expect(data.user?.phone).toBe(phone)
      expect(data.user?.user_metadata).toMatchObject(TEST_USER_DATA)
    }
  })

  test('verifyOTP() fails with invalid token', async () => {
    const { phone } = mockUserCredentials()

    const { error } = await phoneClient.verifyOtp({
      phone,
      type: 'phone_change',
      token: '123456',
      options: {
        redirectTo: 'http://localhost:3000/callback',
        captchaToken: 'some_token',
      },
    })

    expect(error).not.toBeNull()
    expect(error?.message).toContain('Token has expired or is invalid')
  })
})

describe('Docker: Phone Password Auth', () => {
  test('signInWithPassword() for phone', async () => {
    const { phone, password } = mockUserCredentials()

    await autoConfirmClient.signUp({
      phone,
      password,
    })

    const { data, error } = await autoConfirmClient.signInWithPassword({
      phone,
      password,
    })
    expect(error).toBeNull()
    const expectedUser = {
      id: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      aud: expect.any(String),
      phone_confirmed_at: expect.any(String),
      last_sign_in_at: expect.any(String),
      created_at: expect.any(String),
      updated_at: expect.any(String),
      app_metadata: {
        provider: 'phone',
      },
    }
    expect(error).toBeNull()
    expect(data.session).toMatchObject({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
      expires_in: expect.any(Number),
      expires_at: expect.any(Number),
      user: expectedUser,
    })
    expect(data.user).toMatchObject(expectedUser)
    expect(data.user?.phone).toBe(phone)
  })
})

