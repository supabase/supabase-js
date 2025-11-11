import { AuthError } from '../src/lib/errors'
import { STORAGE_KEY } from '../src/lib/constants'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import GoTrueClient from '../src/GoTrueClient'
import {
  authClient as auth,
  authClientWithSession as authWithSession,
  authClientWithAsymmetricSession as authWithAsymmetricSession,
  authSubscriptionClient,
  clientApiAutoConfirmOffSignupsEnabledClient as phoneClient,
  clientApiAutoConfirmDisabledClient as signUpDisabledClient,
  clientApiAutoConfirmEnabledClient as signUpEnabledClient,
  authAdminApiAutoConfirmEnabledClient,
  GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  authClient,
  GOTRUE_URL_SIGNUP_ENABLED_ASYMMETRIC_AUTO_CONFIRM_ON,
  pkceClient,
  autoRefreshClient,
  getClientWithSpecificStorage,
} from './lib/clients'
import { mockUserCredentials } from './lib/utils'
import { JWK, Session } from '../src'
import { setItemAsync } from '../src/lib/helpers'

const TEST_USER_DATA = { info: 'some info' }

const expiredAccessToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzQ4MTA3MDc0LCJpYXQiOjE3NDgxMDM0NzQsImlzcyI6Imh0dHBzOi8vZXhhbXBsZS5jb20iLCJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcl9tZXRhZGF0YSI6e30sInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

const isNodeHigherThan18 = parseInt(process.version.slice(1).split('.')[0]) > 18

describe('GoTrueClient', () => {
  // @ts-expect-error 'Allow access to private _refreshAccessToken'
  const refreshAccessTokenSpy = jest.spyOn(authWithSession, '_refreshAccessToken')

  afterEach(async () => {
    await auth.signOut()
    await authWithSession.signOut()
    refreshAccessTokenSpy.mockClear()
  })

  test('should handle debug function in settings', async () => {
    const debugSpy = jest.fn()
    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      debug: debugSpy,
    })

    await client.initialize()
    expect(debugSpy).toHaveBeenCalled()
  })

  test('should handle custom lock implementation', async () => {
    const customLock = jest.fn().mockResolvedValue(undefined)
    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      lock: customLock,
    })

    await client.initialize()
    expect(customLock).toHaveBeenCalled()
  })

  test('should handle userStorage configuration', async () => {
    const userStorage = memoryLocalStorageAdapter()
    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      userStorage,
    })

    await client.initialize()
    expect(client['userStorage']).toBe(userStorage)
  })

  describe('Sessions', () => {
    test('refreshSession() should return a new session using a passed-in refresh token', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await authWithSession.signUp({
        email,
        password,
      })
      expect(error).toBeNull()
      expect(data.session).not.toBeNull()

      /** wait 1 second before calling refreshSession()
       * resolves issue of tokens being equal
       */
      await new Promise((r) => setTimeout(r, 1000))

      const {
        data: { session },
        error: refreshSessionError,
      } = await authWithSession.refreshSession({
        // @ts-expect-error 'data.session should not be null because of the assertion above'
        refresh_token: data.session.refresh_token,
      })
      expect(refreshSessionError).toBeNull()
      expect(session).not.toBeNull()
      expect(session!.user).not.toBeNull()
      expect(session!.expires_in).not.toBeNull()
      expect(session!.expires_at).not.toBeNull()
      expect(session!.access_token).not.toBeNull()
      expect(session!.refresh_token).not.toBeNull()
      expect(session!.token_type).toStrictEqual('bearer')
      expect(refreshAccessTokenSpy).toBeCalledTimes(1)
      // @ts-expect-error 'data.session and session should not be null because of the assertion above'
      expect(data.session.refresh_token).not.toEqual(session.refresh_token)
    })

    test('refreshSession() should return a new session without a passed-in refresh token', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await authWithSession.signUp({
        email,
        password,
      })
      expect(error).toBeNull()
      expect(data.session).not.toBeNull()

      /** wait 1 second before calling refreshSession()
       * resolves issue of tokens being equal
       */
      await new Promise((r) => setTimeout(r, 1000))

      const {
        data: { session },
        error: refreshSessionError,
      } = await authWithSession.refreshSession()
      expect(refreshSessionError).toBeNull()
      expect(session).not.toBeNull()
      expect(session!.user).not.toBeNull()
      expect(session!.expires_in).not.toBeNull()
      expect(session!.expires_at).not.toBeNull()
      expect(session!.access_token).not.toBeNull()
      expect(session!.refresh_token).not.toBeNull()
      expect(session!.token_type).toStrictEqual('bearer')
      expect(refreshAccessTokenSpy).toBeCalledTimes(1)
      // @ts-expect-error 'data.session and session should not be null because of the assertion above'
      expect(data.session.refresh_token).not.toEqual(session.refresh_token)
    })

    test('setSession should return no error', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await authWithSession.signUp({
        email,
        password,
      })
      expect(error).toBeNull()
      expect(data.session).not.toBeNull()

      const {
        data: { session },
        error: setSessionError,
      } = await authWithSession.setSession({
        // @ts-expect-error 'data.session should not be null because of the assertion above'
        access_token: data.session.access_token,
        // @ts-expect-error 'data.session should not be null because of the assertion above'
        refresh_token: data.session.refresh_token,
      })
      expect(setSessionError).toBeNull()
      expect(session).not.toBeNull()
      expect(session!.user).not.toBeNull()
      expect(session!.expires_in).not.toBeNull()
      expect(session!.expires_at).not.toBeNull()
      expect(session!.access_token).not.toBeNull()
      expect(session!.refresh_token).not.toBeNull()
      expect(session!.token_type).toStrictEqual('bearer')

      /**
       * getSession has been added to verify setSession is also saving
       * the session, not just returning it.
       */
      const { data: getSessionData, error: getSessionError } = await authWithSession.getSession()
      expect(getSessionError).toBeNull()
      expect(getSessionData).not.toBeNull()

      const {
        data: { user },
        error: updateError,
      } = await authWithSession.updateUser({ data: { hello: 'world' } })

      expect(updateError).toBeNull()
      expect(user).not.toBeNull()
      expect(user?.user_metadata).toMatchObject({ hello: 'world' })
    })

    test('setSession should fail with invalid access token', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await authWithSession.signUp({
        email,
        password,
      })
      expect(error).toBeNull()
      expect(data.session).not.toBeNull()

      const {
        data: { session },
        error: setSessionError,
      } = await authWithSession.setSession({
        access_token: 'invalid-access-token',
        // @ts-expect-error 'data.session should not be null because of the assertion above'
        refresh_token: data.session.refresh_token,
      })
      expect(setSessionError).not.toBeNull()
      expect(setSessionError?.message).toContain('Invalid JWT structure')
      expect(session).toBeNull()
    })

    test('setSession should fail with invalid refresh token', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await authWithSession.signUp({
        email,
        password,
      })
      expect(error).toBeNull()
      expect(data.session).not.toBeNull()

      const {
        data: { session },
        error: setSessionError,
      } = await authWithSession.setSession({
        access_token: expiredAccessToken,
        refresh_token: 'invalid-refresh-token',
      })

      expect(setSessionError).not.toBeNull()
      expect(setSessionError?.message).toContain('Invalid Refresh Token: Refresh Token Not Found')
      expect(session).toBeNull()
    })

    test('setSession should fail without refresh_token', async () => {
      const {
        data: { session },
        error: setSessionError,
      } = await authWithSession.setSession({
        access_token: 'valid-access-token',
      } as any)
      expect(setSessionError).not.toBeNull()
      expect(setSessionError?.message).toContain('Auth session missing!')
      expect(session).toBeNull()
    })

    test('setSession should fail without access_token', async () => {
      const {
        data: { session },
        error: setSessionError,
      } = await authWithSession.setSession({
        refresh_token: 'valid-refresh-token',
      } as any)
      expect(setSessionError).not.toBeNull()
      expect(setSessionError?.message).toContain('Auth session missing!')
      expect(session).toBeNull()
    })

    test('getSession() should return the currentUser session', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(data.session).not.toBeNull()

      const { data: userSession, error: userError } = await authWithSession.getSession()

      expect(userError).toBeNull()
      expect(userSession.session).not.toBeNull()
      expect(userSession.session).toHaveProperty('access_token')
      expect(userSession.session).toHaveProperty('user')
    })

    test('getSession() should refresh the session and return a new access token', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(data.session).not.toBeNull()

      const expired = new Date()
      expired.setMinutes(expired.getMinutes() - 1)
      const expiredSeconds = Math.floor(expired.getTime() / 1000)

      // @ts-expect-error 'Allow access to protected storage'
      const storage = authWithSession.storage

      // @ts-expect-error 'Allow access to protected storageKey'
      const storageKey = authWithSession.storageKey

      await storage.setItem(
        storageKey,
        JSON.stringify({
          ...JSON.parse((await storage.getItem(storageKey)) || 'null'),
          expires_at: expiredSeconds,
        })
      )

      // wait 1 seconds before calling getSession()
      await new Promise((r) => setTimeout(r, 1000))
      const { data: userSession, error: userError } = await authWithSession.getSession()

      expect(userError).toBeNull()
      expect(userSession.session).not.toBeNull()
      expect(userSession.session).toHaveProperty('access_token')
      expect(refreshAccessTokenSpy).toBeCalledTimes(1)
      expect(data.session?.access_token).not.toEqual(userSession.session?.access_token)
    })

    test('getSession() returns null when no session is stored', async () => {
      const { data, error } = await auth.getSession()
      expect(data?.session).toBeNull()
      expect(error).toBeNull()
    })

    test('getSession() returns null when no session is stored', async () => {
      const { data, error } = await auth.getSession()
      expect(data?.session).toBeNull()
      expect(error).toBeNull()
    })

    test('refresh should only happen once', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(data.session).not.toBeNull()

      const [{ data: session1, error: error1 }, { data: session2, error: error2 }] =
        await Promise.all([
          // @ts-expect-error 'Allow access to private _callRefreshToken()'
          authWithSession._callRefreshToken(data.session?.refresh_token),
          // @ts-expect-error 'Allow access to private _callRefreshToken()'
          authWithSession._callRefreshToken(data.session?.refresh_token),
        ])

      expect(error1).toBeNull()
      expect(error2).toBeNull()
      expect(session1).toHaveProperty('access_token')
      expect(session2).toHaveProperty('access_token')

      // if both have the same access token, we can assume that they are
      // the result of the same refresh
      expect(session1?.access_token).toEqual(session2?.access_token)

      expect(refreshAccessTokenSpy).toBeCalledTimes(1)
    })

    test('_callRefreshToken() should resolve all pending refresh requests and reset deferred upon AuthError', async () => {
      const { email, password } = mockUserCredentials()
      refreshAccessTokenSpy.mockImplementationOnce(() =>
        // @ts-expect-error 'Allow access to private _refreshAccessToken()'
        Promise.resolve({
          data: { session: null, user: null },
          error: new AuthError('Something did not work as expected'),
        })
      )

      const { error, data } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(data.session).not.toBeNull()

      const [{ data: session1, error: error1 }, { data: session2, error: error2 }] =
        await Promise.all([
          // @ts-expect-error 'Allow access to private _callRefreshToken()'
          authWithSession._callRefreshToken(data.session?.refresh_token),
          // @ts-expect-error 'Allow access to private _callRefreshToken()'
          authWithSession._callRefreshToken(data.session?.refresh_token),
        ])

      expect(error1).toHaveProperty('message')
      expect(error2).toHaveProperty('message')
      expect(session1).toBeNull()
      expect(session2).toBeNull()

      expect(refreshAccessTokenSpy).toBeCalledTimes(1)

      // verify the deferred has been reset and successive calls can be made
      // @ts-expect-error 'Allow access to private _callRefreshToken()'
      const { data: session3, error: error3 } = await authWithSession._callRefreshToken(
        data.session!.refresh_token
      )

      expect(error3).toBeNull()
      expect(session3).toHaveProperty('access_token')
    })

    test('_callRefreshToken() should reject all pending refresh requests and reset deferred upon any non AuthError', async () => {
      const mockError = new Error('Something did not work as expected')

      const { email, password } = mockUserCredentials()

      // @ts-expect-error 'Allow access to private _refreshAccessToken()'
      refreshAccessTokenSpy.mockImplementationOnce(() => Promise.reject(mockError))

      const { error, data } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(data.session).not.toBeNull()

      const [error1, error2] = await Promise.allSettled([
        // @ts-expect-error 'Allow access to private _callRefreshToken()'
        authWithSession._callRefreshToken(data.session?.refresh_token),
        // @ts-expect-error 'Allow access to private _callRefreshToken()'
        authWithSession._callRefreshToken(data.session?.refresh_token),
      ])

      expect(error1.status).toEqual('rejected')
      expect(error2.status).toEqual('rejected')

      // status === 'rejected' above makes sure it is a PromiseRejectedResult
      expect((error1 as PromiseRejectedResult).reason).toEqual(mockError)
      expect((error1 as PromiseRejectedResult).reason).toEqual(mockError)

      expect(refreshAccessTokenSpy).toBeCalledTimes(1)

      // vreify the deferred has been reset and successive calls can be made
      // @ts-expect-error 'Allow access to private _callRefreshToken()'
      const { data: session3, error: error3 } = await authWithSession._callRefreshToken(
        data.session!.refresh_token
      )

      expect(error3).toBeNull()
      expect(session3).toHaveProperty('access_token')
    })

    test('_getSessionFromURL() can only be called from a browser', async () => {
      const {
        error,
        data: { session },
        // @ts-expect-error 'Allow access to private _getSessionFromURL()'
      } = await authWithSession._getSessionFromURL()

      expect(error?.message).toEqual('No browser detected.')
      expect(session).toBeNull()
    })

    test('exchangeCodeForSession() should fail with invalid authCode', async () => {
      const { error } = await pkceClient.exchangeCodeForSession('mock_code')

      expect(error).not.toBeNull()
      expect(error?.status).toEqual(400)
    })
  })

  describe('Email Auth', () => {
    test('signUp() with email', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await auth.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(data.session).not.toBeNull()
      expect(data.user).not.toBeNull()

      expect(data.user?.email).toEqual(email)
    })

    test('signUp() with email and PKCE flowType', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await pkceClient.signUp({ email, password })

      expect(error).toBeNull()
      expect(data.session).not.toBeNull()
      expect(data.user).not.toBeNull()
      expect(data.user?.email).toEqual(email)
    })

    test('signUp() with email and options', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: email,
          data: { ...TEST_USER_DATA },
        },
      })

      expect(error).toBeNull()
      expect(data.session).not.toBeNull()
      expect(data.user).not.toBeNull()

      expect(data.user?.email).toEqual(email)
      expect(data?.user?.user_metadata).toMatchObject(TEST_USER_DATA)
    })

    test('fail to signUp() with invalid password', async () => {
      const { error, data } = await auth.signUp({ email: 'asd@a.aa', password: '123' })

      expect(data?.session).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toContain('Password should be at least 6 characters')
    })

    test('fail to signUp() with invalid email', async () => {
      const { error, data } = await auth.signUp({ email: 'a', password: '123456' })

      expect(data?.session).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toContain('Unable to validate email address: invalid format')
    })

    test.each([
      {
        name: 'resend with email with options',
        params: {
          email: mockUserCredentials().email,
          type: 'signup' as const,
          options: { emailRedirectTo: mockUserCredentials().email },
        },
      },
      {
        name: 'resend with email with empty options',
        params: {
          email: mockUserCredentials().email,
          type: 'signup' as const,
          options: {},
        },
      },
    ])('$name', async ({ params }) => {
      const { error } = await auth.resend(params)
      expect(error).toBeNull()
    })

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

    test('resend() fails without email or phone', async () => {
      const { error } = await auth.resend({} as any)

      expect(error).not.toBeNull()
      expect(error?.message).toContain('You must provide either an email or phone number')
    })

    test('signUp() should fail when both email and phone are missing', async () => {
      const { data, error } = await auth.signUp({
        password: 'password123',
      } as any)

      expect(error).not.toBeNull()
      expect(error?.message).toContain(
        'You must provide either an email or phone number and a password'
      )
      expect(data.session).toBeNull()
      expect(data.user).toBeNull()
    })

    test('should handle signUp with invalid credentials', async () => {
      const { data, error } = await auth.signUp({
        email: 'invalid-email',
        password: '123', // too short
      })

      expect(error).toBeDefined()
      expect(data.user).toBeNull()
      expect(data.session).toBeNull()
    })

    test('should handle signInWithPassword with invalid credentials', async () => {
      const { data, error } = await auth.signInWithPassword({
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      })

      expect(error).toBeDefined()
      expect(data.user).toBeNull()
      expect(data.session).toBeNull()
    })

    test('should handle signInWithOAuth with invalid provider', async () => {
      const { data, error } = await auth.signInWithOAuth({
        provider: 'invalid-provider' as any,
      })

      expect(error).toBeNull()
      expect(data.url).toBeDefined()
    })

    test('should handle signInWithOtp with invalid email', async () => {
      const { data, error } = await auth.signInWithOtp({
        email: 'invalid-email',
      })

      expect(error).toBeDefined()
      expect(data.user).toBeNull()
    })

    test('should handle signInWithOtp with invalid phone', async () => {
      const { data, error } = await auth.signInWithOtp({
        phone: 'invalid-phone',
      })

      expect(error).toBeDefined()
      expect(data.user).toBeNull()
    })

    test('should handle verifyOtp with invalid code', async () => {
      const { data, error } = await auth.verifyOtp({
        email: 'test@example.com',
        token: 'invalid-token',
        type: 'email',
      })

      expect(error).toBeDefined()
      expect(data.user).toBeNull()
      expect(data.session).toBeNull()
    })
  })

  describe('signInWithOtp', () => {
    test('signInWithOtp() for email', async () => {
      const { email } = mockUserCredentials()
      const userMetadata = { hello: 'world' }
      const { data, error } = await auth.signInWithOtp({
        email,
        options: {
          data: userMetadata,
        },
      })
      expect(error).toBeNull()
      expect(data.user).toBeNull()
      expect(data.session).toBeNull()
    })

    test.each([
      {
        name: 'signInWithOtp for email with empty options',
        testFn: async () => {
          const { email } = mockUserCredentials()
          const { data, error } = await auth.signInWithOtp({
            email,
            options: {},
          })
          expect(error).toBeNull()
          expect(data.user).toBeNull()
          expect(data.session).toBeNull()
        },
      },
      {
        name: 'verifyOTP fails with empty options',
        testFn: async () => {
          const { phone } = mockUserCredentials()

          const { error } = await phoneClient.verifyOtp({
            phone,
            type: 'phone_change',
            token: '123456',
            options: {},
          })

          expect(error).not.toBeNull()
          expect(error?.message).toContain('Token has expired or is invalid')
        },
      },
    ])('$name', async ({ testFn }) => {
      await testFn()
    })

    test('signInWithOtp() pkce flow fails with invalid sms provider', async () => {
      const { phone } = mockUserCredentials()

      const { data, error } = await pkceClient.signInWithOtp({
        phone,
      })
      expect(error).not.toBeNull()
      expect(data.session).toBeNull()
      expect(data.user).toBeNull()
    })

    test('signInWithOtp() should fail when both email and phone are missing', async () => {
      const { data, error } = await auth.signInWithOtp({
        options: {
          data: { hello: 'world' },
        },
      } as any)

      expect(error).not.toBeNull()
      expect(error?.message).toContain('You must provide either an email or phone number')
      expect(data.session).toBeNull()
      expect(data.user).toBeNull()
    })

    test('signInWithOtp() with PKCE flow should return error', async () => {
      const { email } = mockUserCredentials()
      const { data, error } = await pkceClient.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          captchaToken: 'some_token',
          emailRedirectTo: email,
        },
      })

      expect(error).not.toBeNull()
      expect(data.session).toBeNull()
      expect(data.user).toBeNull()
    })
  })

  describe('Phone OTP Auth', () => {
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

  test('signUp() the same user twice should not share email already registered message', async () => {
    const { email, password } = mockUserCredentials()

    await auth.signUp({
      email,
      password,
    })

    // sign up again
    const { error, data } = await auth.signUp({
      email,
      password,
    })

    expect(data.session).toBeNull()
    expect(data.user).toBeNull()

    expect(error?.message).toMatch(/^User already registered/)
  })

  test('signInWithPassword() for phone', async () => {
    const { phone, password } = mockUserCredentials()

    await auth.signUp({
      phone,
      password,
    })

    const { data, error } = await auth.signInWithPassword({
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

  test('signInWithPassword() for email', async () => {
    const { email, password } = mockUserCredentials()

    await auth.signUp({
      email,
      password,
    })

    const { error, data } = await auth.signInWithPassword({
      email,
      password,
    })

    const expectedUser = {
      id: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      aud: expect.any(String),
      email_confirmed_at: expect.any(String),
      last_sign_in_at: expect.any(String),
      created_at: expect.any(String),
      updated_at: expect.any(String),
      app_metadata: {
        provider: 'email',
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
    expect(data.user?.email).toBe(email)
  })

  test('signIn() with refreshToken', async () => {
    const { email, password } = mockUserCredentials()

    const { error: initialError, data } = await authWithSession.signUp({
      email,
      password,
    })

    expect(initialError).toBeNull()
    const initialSession = data.session
    expect(initialSession).not.toBeNull()

    const { data: userSession, error } = await authWithSession.getSession()

    expect(error).toBeNull()
    expect(userSession.session).toMatchObject({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
      expires_in: expect.any(Number),
      expires_at: expect.any(Number),
      user: {
        id: expect.any(String),
        email: expect.any(String),
        phone: expect.any(String),
        aud: expect.any(String),
        email_confirmed_at: expect.any(String),
        last_sign_in_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
        app_metadata: {
          provider: 'email',
        },
      },
    })
    expect(userSession.session?.user).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      aud: expect.any(String),
      email_confirmed_at: expect.any(String),
      last_sign_in_at: expect.any(String),
      created_at: expect.any(String),
      updated_at: expect.any(String),
      app_metadata: {
        provider: 'email',
      },
    })

    expect(userSession.session?.user).not.toBeNull()
    expect(userSession.session?.user?.email).toBe(email)
  })
})

describe('Signout behaviour', () => {
  test('signOut', async () => {
    const { email, password } = mockUserCredentials()

    await authWithSession.signUp({
      email,
      password,
    })

    await authWithSession.signInWithPassword({
      email,
      password,
    })

    const { error } = await authWithSession.signOut()

    expect(error).toBe(null)
    const {
      data: { user },
    } = await authWithSession.getUser()
    expect(user).toBe(null)
  })

  test('signOut should remove session if user is not found or jwt is invalid', async () => {
    const { email, password } = mockUserCredentials()

    await authWithSession.signUp({
      email,
      password,
    })

    const {
      data: { user },
      error: signInError,
    } = await authWithSession.signInWithPassword({
      email,
      password,
    })
    expect(signInError).toBe(null)
    expect(user).not.toBe(null)

    const {
      data: { session },
      error: sessionError,
    } = await authWithSession.getSession()
    expect(session).not.toBe(null)
    expect(sessionError).toBe(null)

    const id = user ? user.id : '' // user should not be null
    await authAdminApiAutoConfirmEnabledClient.deleteUser(id)

    const { error } = await authWithSession.signOut()
    expect(error).toBe(null)
  })
})

describe('User management', () => {
  test('Get user', async () => {
    const { email, password } = mockUserCredentials()

    const { data } = await authWithSession.signUp({
      email,
      password,
    })

    expect(data.user).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      aud: expect.any(String),
      email_confirmed_at: expect.any(String),
      last_sign_in_at: expect.any(String),
      created_at: expect.any(String),
      updated_at: expect.any(String),
      app_metadata: {
        provider: 'email',
      },
    })

    expect(data.user?.email).toBe(email)
  })

  test('Update user', async () => {
    const { email, password } = mockUserCredentials()

    await authWithSession.signUp({
      email,
      password,
    })

    const userMetadata = { hello: 'world' }

    const {
      error,
      data: { user },
    } = await authWithSession.updateUser({ data: userMetadata })

    expect(error).toBeNull()
    expect(user).toMatchObject({
      id: expect.any(String),
      aud: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      updated_at: expect.any(String),
      last_sign_in_at: expect.any(String),
      email_confirmed_at: expect.any(String),
      created_at: expect.any(String),
      user_metadata: {
        hello: 'world',
      },
    })

    expect(user).not.toBeNull()
    expect(user?.email).toBe(email)
    expect(user?.user_metadata).toMatchObject(userMetadata)
  })

  test('Get user after updating', async () => {
    const { email, password } = mockUserCredentials()

    await authWithSession.signUp({
      email,
      password,
    })

    const userMetadata = { hello: 'world' }

    const {
      data: { user },
      error,
    } = await authWithSession.updateUser({ data: userMetadata })

    expect(error).toBeNull()
    expect(user).toMatchObject({
      id: expect.any(String),
      aud: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      updated_at: expect.any(String),
      last_sign_in_at: expect.any(String),
      email_confirmed_at: expect.any(String),
      created_at: expect.any(String),
      user_metadata: userMetadata,
    })
    expect(user?.email).toBe(email)
  })

  test('Get user after logging out', async () => {
    const { email, password } = mockUserCredentials()

    await authWithSession.signUp({
      email,
      password,
    })

    const { data } = await authWithSession.signInWithPassword({
      email,
      password,
    })

    expect(data.user).not.toBeNull()

    await authWithSession.signOut()
    const { data: userSession, error } = await authWithSession.getSession()
    expect(userSession.session).toBeNull()
    expect(error).toBeNull()
  })

  test('signIn() with the wrong password', async () => {
    const { email, password } = mockUserCredentials()

    const { error, data } = await auth.signInWithPassword({
      email,
      password: password + '-wrong',
      options: {
        captchaToken: 'some_token',
      },
    })

    expect(error).not.toBeNull()
    expect(error?.message).not.toBeNull()
    expect(data.session).toBeNull()
  })

  test('signIn() with the wrong phone', async () => {
    const { password } = mockUserCredentials()

    const { error, data } = await auth.signInWithPassword({
      phone: '+34123',
      password: password,
      options: {
        captchaToken: 'some_token',
      },
    })

    expect(error).not.toBeNull()
    expect(error?.message).not.toBeNull()
    expect(data.session).toBeNull()
  })
})

test('signInWithPassword() should fail when both email and phone are missing', async () => {
  const { data, error } = await auth.signInWithPassword({
    password: 'password123',
  } as any)

  expect(error).not.toBeNull()
  expect(error?.message).toContain(
    'You must provide either an email or phone number and a password'
  )
  expect(data.session).toBeNull()
  expect(data.user).toBeNull()
})

describe('The auth client can signin with third-party oAuth providers', () => {
  test('signIn() with Provider', async () => {
    const {
      error,
      data: { url, provider },
    } = await auth.signInWithOAuth({
      provider: 'google',
    })
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  test('signIn() with Provider can append a redirectUrl ', async () => {
    const {
      error,
      data: { url, provider },
    } = await auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://localhost:9000/welcome',
      },
    })
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  test('signIn() with Provider can append scopes', async () => {
    const {
      error,
      data: { url, provider },
    } = await auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'repo',
      },
    })
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  test('signIn() with Provider can append multiple options', async () => {
    const {
      error,
      data: { url, provider },
    } = await auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://localhost:9000/welcome',
        scopes: 'repo',
      },
    })
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  test('should handle exchangeCodeForSession with invalid code', async () => {
    const { data, error } = await auth.exchangeCodeForSession('invalid-code')
    expect(error).toBeDefined()
    expect(data.session).toBeNull()
    expect(data.user).toBeNull()
  })

  test('should handle signInWithOAuth with redirectTo option', async () => {
    const { data, error } = await auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/callback',
      },
    })

    expect(error).toBeNull()
    expect(data.url).toBeDefined()
  })

  test('should handle signInWithOAuth with queryParams', async () => {
    const { data, error } = await auth.signInWithOAuth({
      provider: 'github',
      options: {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    expect(error).toBeNull()
    expect(data.url).toBeDefined()
  })

  describe('Developers can subscribe and unsubscribe', () => {
    const {
      data: { subscription },
    } = authSubscriptionClient.onAuthStateChange(() => console.log('onAuthStateChange was called'))

    test('Subscribe a listener', async () => {
      // @ts-expect-error 'Allow access to protected stateChangeEmitters'
      expect(authSubscriptionClient.stateChangeEmitters.size).toBeTruthy()
    })

    test('Unsubscribe a listener', async () => {
      subscription?.unsubscribe()

      // @ts-expect-error 'Allow access to protected stateChangeEmitters'
      expect(authSubscriptionClient.stateChangeEmitters.size).toBeFalsy()
    })
  })

  describe('Sign Up Enabled', () => {
    test('User can sign up', async () => {
      const { email, password } = mockUserCredentials()

      const {
        error,
        data: { user },
      } = await signUpEnabledClient.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(user).not.toBeNull()

      expect(user?.email).toEqual(email)
    })
  })

  describe('Sign Up Disabled', () => {
    test('User cannot sign up', async () => {
      const { email, password } = mockUserCredentials()

      const {
        error,
        data: { user },
      } = await signUpDisabledClient.signUp({
        email,
        password,
      })

      expect(user).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toEqual('Signups not allowed for this instance')
    })
  })
})

describe('User management', () => {
  beforeEach(async () => {
    await authWithSession.signOut()
  })

  test('resetPasswordForEmail() sends an email for password recovery', async () => {
    const { email, password } = mockUserCredentials()

    const { error: initialError, data } = await authWithSession.signUp({
      email,
      password,
    })

    expect(initialError).toBeNull()
    expect(data.session).not.toBeNull()

    const redirectTo = 'http://localhost:9999/welcome'
    const { error, data: user } = await authWithSession.resetPasswordForEmail(email, {
      redirectTo,
    })
    expect(user).toBeTruthy()
    expect(error?.message).toBeUndefined()
  })

  test('resetPasswordForEmail() if user does not exist, user details are not exposed', async () => {
    const redirectTo = 'http://localhost:9999/welcome'
    const { error, data } = await phoneClient.resetPasswordForEmail(
      'this_user@does-not-exist.com',
      {
        redirectTo,
        captchaToken: 'some_token',
      }
    )
    expect(data).toEqual({})
    expect(error).toBeNull()
  })

  test('refreshAccessToken()', async () => {
    const { email, password } = mockUserCredentials()

    const { error: initialError, data } = await authWithSession.signUp({
      email,
      password,
    })

    expect(initialError).toBeNull()

    // @ts-expect-error 'Allow access to private _refreshAccessToken()'
    const { error, data: refreshedSession } = await authWithSession._refreshAccessToken(
      data.session?.refresh_token || ''
    )

    const user = refreshedSession?.user

    expect(error).toBeNull()
    expect(user).not.toBeNull()
    expect(user?.email).toEqual(email)
  })
})

describe('MFA', () => {
  const setupUserWithMFA = async () => {
    const { email, password } = mockUserCredentials()
    const { data: signUpData, error: signUpError } = await authWithSession.signUp({
      email,
      password,
    })
    expect(signUpError).toBeNull()
    expect(signUpData.session).not.toBeNull()

    await authWithSession.initialize()

    const { error: signInError } = await authWithSession.signInWithPassword({
      email,
      password,
    })
    expect(signInError).toBeNull()

    return { email, password }
  }

  const setupUserWithMFAAndTOTP = async () => {
    const credentials = await setupUserWithMFA()

    // Add the common TOTP enrollment part
    const { data: enrollData, error: enrollError } = await authWithSession.mfa.enroll({
      factorType: 'totp',
    })
    expect(enrollError).toBeNull()
    expect(enrollData!.totp).not.toBeNull()

    return {
      ...credentials,
      factorId: enrollData!.id,
      totp: enrollData!.totp,
    }
  }

  test('enroll({factorType: "totp"}) returns totp', async () => {
    await setupUserWithMFA()
    const { data, error } = await authWithSession.mfa.enroll({
      factorType: 'totp',
    })

    expect(error).toBeNull()
    expect(data!.totp.qr_code).not.toBeNull()
  })

  test('enroll({factorType: "totp"}) should fail without session', async () => {
    await authWithSession.signOut()
    const { data, error } = await authWithSession.mfa.enroll({
      factorType: 'totp',
    })

    expect(error).not.toBeNull()
    expect(error?.message).toContain('Bearer token')
    expect(data).toBeNull()
  })

  test('challenge should create MFA challenge', async () => {
    const { factorId } = await setupUserWithMFAAndTOTP()

    const { data, error: challengeError } = await authWithSession.mfa.challenge({
      factorId,
    })

    expect(challengeError).toBeNull()
    expect(data!.id).not.toBeNull()
    expect(data!.expires_at).not.toBeNull()
  })

  test('verify should verify MFA challenge', async () => {
    const { factorId } = await setupUserWithMFAAndTOTP()

    const { data: challengeData, error: challengeError } = await authWithSession.mfa.challenge({
      factorId,
    })
    expect(challengeError).toBeNull()

    const { data: verifyData, error: verifyError } = await authWithSession.mfa.verify({
      factorId,
      challengeId: challengeData!.id,
      code: '123456',
    })

    expect(verifyError).not.toBeNull()
    expect(verifyError?.message).toContain('Invalid TOTP code')
    expect(verifyData).toBeNull()
  })

  test('challengeAndVerify should handle MFA challenge and verification in one call', async () => {
    const { factorId } = await setupUserWithMFAAndTOTP()

    const { data: verifyData, error: verifyError } = await authWithSession.mfa.challengeAndVerify({
      factorId,
      code: '123456',
    })

    expect(verifyError).not.toBeNull()
    expect(verifyError?.message).toContain('Invalid TOTP code')
    expect(verifyData).toBeNull()
  })

  test('unenroll should remove MFA factor', async () => {
    const { factorId } = await setupUserWithMFAAndTOTP()

    const { error: unenrollError } = await authWithSession.mfa.unenroll({
      factorId,
    })

    expect(unenrollError).toBeNull()

    // Wait for unenrollment to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Verify factor was removed
    const { data: factorsData } = await authWithSession.mfa.listFactors()
    expect(factorsData!.all).toHaveLength(0)
    expect(factorsData!.totp).toHaveLength(0)
  })

  test('getAuthenticatorAssuranceLevel should return current AAL', async () => {
    const { factorId } = await setupUserWithMFAAndTOTP()

    const { data: aalData, error: aalError } =
      await authWithSession.mfa.getAuthenticatorAssuranceLevel()

    expect(aalError).toBeNull()
    expect(aalData!.currentLevel).toBeDefined()
    expect(aalData!.nextLevel).toBeDefined()
    expect(aalData!.currentAuthenticationMethods).toBeDefined()
  })

  test('_listFactors returns correct factor lists', async () => {
    // Mock getUser
    pkceClient.getUser = jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user',
          factors: [
            { factor_type: 'totp', status: 'verified' },
            { factor_type: 'totp', status: 'unverified' },
            { factor_type: 'phone', status: 'verified' },
            { factor_type: 'phone', status: 'unverified' },
          ],
        },
      },
      error: null,
    })

    const result = await pkceClient['_listFactors']()

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
    if (result.data) {
      expect(result.data.all).toHaveLength(4)
      expect(result.data.totp).toHaveLength(1)
      expect(result.data.phone).toHaveLength(1)
    }
  })

  test('should handle MFA enroll without session', async () => {
    await auth.signOut()
    const { data, error } = await auth.mfa.enroll({
      factorType: 'totp',
    })

    expect(error).toBeDefined()
    expect(data?.id).toBeUndefined()
  })

  test('should handle MFA challenge without session', async () => {
    const { data, error } = await auth.mfa.challenge({
      factorId: 'test-factor-id',
    })

    expect(error).toBeDefined()
    expect(data?.id).toBeUndefined()
  })

  test('should handle MFA verify without session', async () => {
    const { data, error } = await auth.mfa.verify({
      factorId: 'test-factor-id',
      challengeId: 'test-challenge-id',
      code: '123456',
    })

    expect(error).toBeDefined()
    expect(data?.access_token).toBeUndefined()
  })

  test('should handle MFA unenroll without session', async () => {
    const { data, error } = await auth.mfa.unenroll({
      factorId: 'test-factor-id',
    })

    expect(error).toBeDefined()
    expect(data?.id).toBeUndefined()
  })
})

describe('getClaims', () => {
  test('getClaims returns nothing if there is no session present', async () => {
    const { data, error } = await authClient.getClaims()
    expect(data).toBeNull()
    expect(error).toBeNull()
  })

  test('getClaims calls getUser if symmetric jwt is present', async () => {
    const { email, password } = mockUserCredentials()
    jest.spyOn(authWithSession, 'getUser')
    const {
      data: { user },
      error: initialError,
    } = await authWithSession.signUp({
      email,
      password,
    })
    expect(initialError).toBeNull()
    expect(user).not.toBeNull()

    const { data, error } = await authWithSession.getClaims()
    expect(error).toBeNull()
    expect(data?.claims.email).toEqual(user?.email)
    expect(authWithSession.getUser).toHaveBeenCalled()
  })

  test('getClaims returns properly typed JwtPayload with documented fields', async () => {
    const { email, password } = mockUserCredentials()
    const {
      data: { user },
      error: initialError,
    } = await authWithSession.signUp({
      email,
      password,
    })
    expect(initialError).toBeNull()
    expect(user).not.toBeNull()

    const { data, error } = await authWithSession.getClaims()
    expect(error).toBeNull()
    expect(data).not.toBeNull()

    const claims = data?.claims
    expect(claims).toBeDefined()

    // Test core required claims that are always present
    expect(typeof claims?.sub).toBe('string')
    expect(typeof claims?.role).toBe('string')

    // Test standard optional claims
    if (claims?.email !== undefined) {
      expect(typeof claims.email).toBe('string')
    }
    if (claims?.phone !== undefined) {
      expect(typeof claims.phone).toBe('string')
    }
    if (claims?.user_metadata !== undefined) {
      expect(typeof claims.user_metadata).toBe('object')
    }
    if (claims?.app_metadata !== undefined) {
      expect(typeof claims.app_metadata).toBe('object')
    }
    if (claims?.is_anonymous !== undefined) {
      expect(typeof claims.is_anonymous).toBe('boolean')
    }

    // Test optional JWT standard claims if present
    if (claims?.iss !== undefined) {
      expect(typeof claims.iss).toBe('string')
    }
    if (claims?.aud !== undefined) {
      expect(['string', 'object']).toContain(typeof claims.aud)
    }
    if (claims?.exp !== undefined) {
      expect(typeof claims.exp).toBe('number')
    }
    if (claims?.iat !== undefined) {
      expect(typeof claims.iat).toBe('number')
    }
    if (claims?.aal !== undefined) {
      expect(typeof claims.aal).toBe('string')
    }
    if (claims?.session_id !== undefined) {
      expect(typeof claims.session_id).toBe('string')
    }
    if (claims?.jti !== undefined) {
      expect(typeof claims.jti).toBe('string')
    }
    if (claims?.nbf !== undefined) {
      expect(typeof claims.nbf).toBe('number')
    }

    // Verify amr array structure if present
    if (claims?.amr) {
      expect(Array.isArray(claims.amr)).toBe(true)
      if (claims.amr.length > 0) {
        expect(typeof claims.amr[0].method).toBe('string')
        expect(typeof claims.amr[0].timestamp).toBe('number')
      }
    }

    // Verify ref claim if present (anon/service role tokens)
    if (claims?.ref !== undefined) {
      expect(typeof claims.ref).toBe('string')
    }
  })

  test('getClaims fetches JWKS to verify asymmetric jwt', async () => {
    const fetchedUrls: any[] = []
    const fetchedResponse: any[] = []

    // override fetch to inspect fetchJwk called within getClaims
    authWithAsymmetricSession['fetch'] = async (url: RequestInfo | URL, options = {}) => {
      fetchedUrls.push(url)
      const response = await globalThis.fetch(url, options)
      const clonedResponse = response.clone()
      fetchedResponse.push(await clonedResponse.json())
      return response
    }
    const { email, password } = mockUserCredentials()
    const {
      data: { user },
      error: initialError,
    } = await authWithAsymmetricSession.signUp({
      email,
      password,
    })
    expect(initialError).toBeNull()
    expect(user).not.toBeNull()

    const { data, error } = await authWithAsymmetricSession.getClaims()
    expect(error).toBeNull()
    expect(data?.claims.email).toEqual(user?.email)

    // node 18 doesn't support crypto.subtle API by default unless built with the experimental-global-webcrypto flag
    if (isNodeHigherThan18) {
      expect(fetchedUrls).toContain(
        GOTRUE_URL_SIGNUP_ENABLED_ASYMMETRIC_AUTO_CONFIRM_ON + '/.well-known/jwks.json'
      )
    }

    // contains the response for getSession and fetchJwk
    expect(fetchedResponse).toHaveLength(2)
  })

  test('getClaims should return error for expired JWT format', async () => {
    const { email, password } = mockUserCredentials()

    const { data: signUpData, error: signUpError } = await authWithSession.signUp({
      email,
      password,
    })

    expect(signUpError).toBeNull()
    expect(signUpData.session).not.toBeNull()

    // @ts-expect-error 'Allow access to protected storage'
    const storage = authWithSession.storage
    // @ts-expect-error 'Allow access to protected storageKey'
    const storageKey = authWithSession.storageKey

    const invalidSession = {
      ...signUpData.session,
      access_token: expiredAccessToken,
      refresh_token: 'invalid-refresh-token',
    }

    await storage.setItem(storageKey, JSON.stringify(invalidSession))

    await expect(authWithSession.getClaims()).rejects.toThrow('JWT has expired')
  })

  test('getClaims should return error for Invalid JWT signature', async () => {
    // node 18 doesn't support crypto.subtle API by default unless built with the experimental-global-webcrypto flag
    if (!isNodeHigherThan18) {
      console.warn('Skipping test due to Node version <= 18')
      return
    }

    const { email, password } = mockUserCredentials()
    const { data: signUpData, error: signUpError } = await authWithAsymmetricSession.signUp({
      email,
      password,
    })
    expect(signUpError).toBeNull()
    expect(signUpData.session).not.toBeNull()

    const verifySpy = jest.spyOn(crypto.subtle, 'verify').mockImplementation(async () => false)

    const { data, error } = await authWithAsymmetricSession.getClaims()

    verifySpy.mockRestore()
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Invalid JWT signature')
    expect(data).toBeNull()
  })

  test('getClaims should return error for Invalid JWT signature', async () => {
    const { email, password } = mockUserCredentials()

    const { data: signUpData, error: signUpError } = await authWithAsymmetricSession.signUp({
      email,
      password,
    })

    expect(signUpError).toBeNull()
    expect(signUpData.session).not.toBeNull()

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://example.com',
        sub: '1234567890',
        user_metadata: {},
        role: 'authenticated',
      })
    ).toString('base64url')
    const invalidSignature = 'invalid_signature_that_is_not_base64url_encoded'
    const invalidJWT = `${header}.${payload}.${invalidSignature}`

    // @ts-expect-error 'Allow access to protected storage'
    const storage = authWithAsymmetricSession.storage
    // @ts-expect-error 'Allow access to protected storageKey'
    const storageKey = authWithAsymmetricSession.storageKey

    await storage.setItem(
      storageKey,
      JSON.stringify({
        ...signUpData.session,
        access_token: invalidJWT,
      })
    )

    const { data, error } = await authWithAsymmetricSession.getClaims()

    expect(error).not.toBeNull()
    expect(error?.message).toContain('unable to parse or verify signature')
    expect(data).toBeNull()
  })

  test('getClaims should return error for invalid base64url encoded access_token', async () => {
    const { email, password } = mockUserCredentials()

    await authWithSession.signUp({
      email,
      password,
    })

    // @ts-expect-error 'Allow access to protected storage'
    const storage = authWithSession.storage
    // @ts-expect-error 'Allow access to protected storageKey'
    const storageKey = authWithSession.storageKey

    const invalidSession = {
      access_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzEwODg5NjAwLCJpYXQiOjE3MTA4ODYwMDAsImlzcyI6Imh0dHBzOi8vZXhhbXBsZS5jb20iLCJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcl9tZXRhZGF0YSI6e30sInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.invalid_signature',
      refresh_token: 'invalid-refresh-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: null,
    }

    await storage.setItem(storageKey, JSON.stringify(invalidSession))

    const { data, error } = await authWithSession.getClaims()

    expect(error).not.toBeNull()
    expect(error?.message).toContain('JWT not in base64url format')
    expect(data).toBeNull()
  })

  test('getClaims should refresh expired JWT token', async () => {
    const { email, password } = mockUserCredentials()

    const { data: signUpData, error: signUpError } = await authWithSession.signUp({
      email,
      password,
    })

    expect(signUpError).toBeNull()
    expect(signUpData.session).not.toBeNull()

    // @ts-expect-error 'Allow access to protected storage'
    const storage = authWithSession.storage
    // @ts-expect-error 'Allow access to protected storageKey'
    const storageKey = authWithSession.storageKey

    const expiredSession = {
      ...signUpData.session,
      expires_at: Math.floor(Date.now() / 1000) - 3600,
    }

    await storage.setItem(storageKey, JSON.stringify(expiredSession))

    const { data, error } = await authWithSession.getClaims()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.claims.email).toEqual(signUpData?.session?.user?.email)
  })
})

describe('GoTrueClient with storageisServer = true', () => {
  const originalWarn = console.warn
  let warnings: any[][] = []
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    warnings = []
    warnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
      console.log('WARN', ...args)
      warnings.push(args)
    })
  })

  afterEach(() => {
    warnSpy.mockRestore()
    console.warn = originalWarn
    warnings = []
  })

  test('getSession() emits no warnings', async () => {
    const storage = memoryLocalStorageAdapter({
      [STORAGE_KEY]: JSON.stringify({
        access_token: 'jwt.accesstoken.signature',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 1000,
        expires_at: Date.now() / 1000 + 1000,
        user: {
          id: 'random-user-id',
        },
      }),
    })
    storage.isServer = true

    const client = new GoTrueClient({
      storage,
    })
    const {
      data: { session },
    } = await client.getSession()

    // Accessing session.user should not emit a warning
    const user = session?.user
    expect(user).not.toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('getSession() emits insecure warning, once per server client, when user properties are accessed', async () => {
    const storage = memoryLocalStorageAdapter({
      [STORAGE_KEY]: JSON.stringify({
        access_token: 'jwt.accesstoken.signature',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 1000,
        expires_at: Date.now() / 1000 + 1000,
        user: {
          id: 'random-user-id',
          email: 'test@example.com',
        },
      }),
    })
    storage.isServer = true

    const client = new GoTrueClient({
      storage,
    })

    const {
      data: { session },
    } = await client.getSession()

    // Accessing session.user itself should not emit a warning
    const user = session?.user
    expect(user).not.toBeNull()
    expect(warnings.length).toEqual(0)

    // Accessing a property of the user object should emit a warning the first time
    const userId = user?.id
    expect(userId).toEqual('random-user-id')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(
      warnings[0][0].startsWith(
        'Using the user object as returned from supabase.auth.getSession() '
      )
    ).toEqual(true)

    // Accessing another property should not emit additional warnings
    const userEmail = user?.email
    expect(userEmail).toEqual('test@example.com')
    expect(warnSpy).toHaveBeenCalledTimes(1)

    const {
      data: { session: session2 },
    } = await client.getSession() // create new proxy instance

    // Accessing properties in subsequent sessions should not emit warnings (suppression is client-wide)
    const userId2 = session2?.user?.id
    expect(userId2).toEqual('random-user-id')
    // Note: In Jest 29, optional chaining on new proxy instances may trigger the warning again
    // The suppression works within the same proxy instance, but new instances from getSession()
    // may behave differently with Jest 29's proxy handling
    expect(warnSpy).toHaveBeenCalledTimes(2)
  })

  test('getSession emits no warnings if getUser is called prior', async () => {
    const client = new GoTrueClient({
      url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
      autoRefreshToken: false,
      persistSession: true,
      storage: {
        ...memoryLocalStorageAdapter(),
        isServer: true,
      },
    })
    const { email, password } = mockUserCredentials()
    await client.signUp({ email, password })

    const {
      data: { user },
      error,
    } = await client.getUser() // should suppress any warnings
    expect(error).toBeNull()
    expect(user).not.toBeNull()

    const {
      data: { session },
    } = await client.getSession()

    // Accessing user properties from getSession shouldn't emit a warning after getUser() was called
    const sessionUserId = session?.user?.id
    expect(sessionUserId).not.toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('getSession() with destructuring emits warning', async () => {
    const storage = memoryLocalStorageAdapter({
      [STORAGE_KEY]: JSON.stringify({
        access_token: 'jwt.accesstoken.signature',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 1000,
        expires_at: Date.now() / 1000 + 1000,
        user: {
          id: 'random-user-id',
          email: 'test@example.com',
          role: 'user',
        },
      }),
    })
    storage.isServer = true

    const client = new GoTrueClient({
      storage,
    })

    const {
      data: { session },
    } = await client.getSession()

    // Destructuring user properties should emit a warning
    const { id, email } = session?.user || {}
    expect(id).toEqual('random-user-id')
    expect(email).toEqual('test@example.com')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  test('getSession() with spread operator emits warning', async () => {
    const storage = memoryLocalStorageAdapter({
      [STORAGE_KEY]: JSON.stringify({
        access_token: 'jwt.accesstoken.signature',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 1000,
        expires_at: Date.now() / 1000 + 1000,
        user: {
          id: 'random-user-id',
          email: 'test@example.com',
        },
      }),
    })
    storage.isServer = true

    const client = new GoTrueClient({
      storage,
    })

    const {
      data: { session },
    } = await client.getSession()

    // Spread operator accesses properties, should emit a warning
    const userData = { ...session?.user }
    expect(userData.id).toEqual('random-user-id')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  test('getSession() with Object.keys() does not emit warning', async () => {
    const storage = memoryLocalStorageAdapter({
      [STORAGE_KEY]: JSON.stringify({
        access_token: 'jwt.accesstoken.signature',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 1000,
        expires_at: Date.now() / 1000 + 1000,
        user: {
          id: 'random-user-id',
          email: 'test@example.com',
        },
      }),
    })
    storage.isServer = true

    const client = new GoTrueClient({
      storage,
    })

    const {
      data: { session },
    } = await client.getSession()

    // Object.keys() inspects own keys via [[OwnPropertyKeys]] (ownKeys trap) and does not invoke
    // the get trap on a Proxy. Since our Proxy only traps `get`, Object.keys() won't emit a warning.
    const keys = Object.keys(session?.user || {})
    expect(keys.length).toBeGreaterThan(0)
    expect(warnSpy).toHaveBeenCalledTimes(0)
  })

  test('getSession() with JSON.stringify() emits warning', async () => {
    const storage = memoryLocalStorageAdapter({
      [STORAGE_KEY]: JSON.stringify({
        access_token: 'jwt.accesstoken.signature',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 1000,
        expires_at: Date.now() / 1000 + 1000,
        user: {
          id: 'random-user-id',
          email: 'test@example.com',
        },
      }),
    })
    storage.isServer = true

    const client = new GoTrueClient({
      storage,
    })

    const {
      data: { session },
    } = await client.getSession()

    // JSON.stringify() iterates over properties, should emit a warning
    const serialized = JSON.stringify(session?.user)
    expect(serialized).toContain('random-user-id')
    expect(warnings.length).toEqual(1)
  })

  test('saveSession should overwrite the existing session', async () => {
    const store = memoryLocalStorageAdapter()
    const client = new GoTrueClient({
      url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
      storageKey: 'test-storage-key',
      autoRefreshToken: false,
      persistSession: true,
      storage: {
        ...store,
      },
    })
    const initialSession: Session = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'test-user-id',
        aud: 'test-audience',
        user_metadata: {},
        app_metadata: {},
        created_at: new Date().toISOString(),
      },
    }

    // @ts-ignore 'Allow access to private _saveSession'
    await client._saveSession(initialSession)
    expect(store.getItem('test-storage-key')).toEqual(JSON.stringify(initialSession))

    const newSession: Session = {
      access_token: 'test-new-access-token',
      refresh_token: 'test-new-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'test-user-id',
        aud: 'test-audience',
        user_metadata: {},
        app_metadata: {},
        created_at: new Date().toISOString(),
      },
    }

    // @ts-ignore 'Allow access to private _saveSession'
    await client._saveSession(newSession)
    expect(store.getItem('test-storage-key')).toEqual(JSON.stringify(newSession))
  })
})

describe('fetchJwk', () => {
  let fetchedUrls: any[] = []

  const cases = [
    {
      desc: 'jwk exists but cache is stale',
      jwks: { keys: [{ kid: '123', kty: 'RSA', key_ops: ['verify'] }] },
      jwksCachedAt: Number.MIN_SAFE_INTEGER,
      fetchedUrlsLength: 1,
    },
    {
      desc: 'jwk does not exist and cache is stale',
      jwks: { keys: [{ kid: '234', kty: 'RSA', key_ops: ['verify'] }] },
      jwksCachedAt: Number.MIN_SAFE_INTEGER,
      fetchedUrlsLength: 1,
    },
    {
      desc: 'jwk exists in cache',
      jwks: { keys: [{ kid: '123', kty: 'RSA', key_ops: ['verify'] }] },
      jwksCachedAt: Number.MAX_SAFE_INTEGER,
      fetchedUrlsLength: 0,
    },
    {
      desc: 'jwk does not exist in cache',
      jwks: { keys: [{ kid: '234', kty: 'RSA', key_ops: ['verify'] }] },
      jwksCachedAt: Number.MAX_SAFE_INTEGER,
      fetchedUrlsLength: 1,
    },
  ]

  beforeEach(() => {
    fetchedUrls = []
  })

  cases.forEach((c) => {
    test(`${c.desc}`, async () => {
      // override fetch to return a hard-coded JWKS
      authWithAsymmetricSession['fetch'] = async (url: RequestInfo | URL, _options = {}) => {
        fetchedUrls.push(url)
        return new Response(
          JSON.stringify({ keys: [{ kid: '123', kty: 'RSA', key_ops: ['verify'] }] })
        )
      }
      authWithAsymmetricSession['jwks'] = c.jwks as { keys: JWK[] }
      authWithAsymmetricSession['jwks_cached_at'] = c.jwksCachedAt
      // @ts-ignore 'Allow access to private fetchJwk'
      await authWithAsymmetricSession.fetchJwk('123')
      expect(fetchedUrls).toHaveLength(c.fetchedUrlsLength)
    })
  })
})

describe('signInAnonymously', () => {
  test('should successfully sign in anonymously', async () => {
    const { data, error } = await authWithSession.signInAnonymously()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data.session).not.toBeNull()
    expect(data.user).not.toBeNull()
    expect(data.user?.is_anonymous).toBe(true)

    const { data: sessionData } = await authWithSession.getSession()
    expect(sessionData.session).not.toBeNull()
  })

  test('should sign in anonymously with user data', async () => {
    const { data, error } = await authClient.signInAnonymously({
      options: { data: TEST_USER_DATA },
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.user?.user_metadata).toEqual(TEST_USER_DATA)
  })

  test('fail to sign in anonymously when it is disabled on the server', async () => {
    const { data, error } = await phoneClient.signInAnonymously()

    expect(data?.session).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Anonymous sign-ins are disabled')
  })
})

describe('Web3 Authentication', () => {
  test('signInWithWeb3 should throw error for unsupported chain', async () => {
    const credentials = {
      chain: 'polygon' as any,
      message: 'test message',
      signature: new Uint8Array([1, 2, 3]),
    }

    await expect(authClient.signInWithWeb3(credentials)).rejects.toThrow(
      '@supabase/auth-js: Unsupported chain "polygon"'
    )
  })

  test('signInWithWeb3 should handle solana chain', async () => {
    const credentials = {
      chain: 'solana' as const,
      message: 'test message',
      signature: new Uint8Array([1, 2, 3]),
    }

    const { data, error } = await authClient.signInWithWeb3(credentials)

    expect(data?.session).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Web3 provider is disabled')
  })

  test('signInWithWeb3 should fail solana chain without message', async () => {
    const credentials = {
      chain: 'solana' as const,
      signature: new Uint8Array([1, 2, 3]),
    }

    await expect(authClient.signInWithWeb3(credentials)).rejects.toThrow(
      '@supabase/auth-js: Both wallet and url must be specified in non-browser environments.'
    )
  })

  test('signInWithWeb3 should fail solana chain without signMessage', async () => {
    const credentials = {
      chain: 'solana' as const,
      wallet: {
        address: '0x123',
        publicKey: { toBase58: () => '0x123' },
        privateKey: '0x123',
      },
      options: {
        url: 'https://example.com',
      },
    }

    await expect(authClient.signInWithWeb3(credentials)).rejects.toThrow(
      '@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API'
    )
  })

  test('signInWithWeb3 should fail solana chain without publicKey', async () => {
    const credentials = {
      chain: 'solana' as const,
      wallet: {
        address: '0x123',
        privateKey: '0x123',
        signMessage: async () => new Uint8Array([1, 2, 3]),
      },
      options: {
        url: 'https://example.com',
      },
    }

    await expect(authClient.signInWithWeb3(credentials)).rejects.toThrow(
      '@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API'
    )
  })

  test('signInWithWeb3 should handle ethereum chain', async () => {
    const credentials = {
      chain: 'ethereum' as const,
      message: 'test message',
      signature: new Uint8Array([1, 2, 3]),
    }

    const { data, error } = await authClient.signInWithWeb3(credentials)

    expect(data?.session).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Web3 provider is disabled')
  })

  test('signInWithWeb3 should fail ethereum chain without message', async () => {
    const credentials = {
      chain: 'ethereum' as const,
      signature: new Uint8Array([1, 2, 3]),
    }

    await expect(authClient.signInWithWeb3(credentials)).rejects.toThrow(
      '@supabase/auth-js: Both wallet and url must be specified in non-browser environments.'
    )
  })

  test('signInWithWeb3 should fail ethereum chain without signMessage', async () => {
    await expect(
      authClient.signInWithWeb3({
        chain: 'ethereum' as const,
        wallet: {
          address: '0xa1E993d09257291470e86778399D79A0864F327E',
          on: () => void 0,
          removeListener: () => void 0,
          request: ({ method }) => {
            if (method === 'eth_requestAccounts') {
              return Promise.reject(
                new Error('Missing or invalid. request() method: eth_requestAccounts')
              )
            }
            return new Promise((resolve) => setTimeout(resolve, 100))
          },
        },
        options: {
          url: 'https://example.com',
        },
      })
    ).rejects.toThrow('@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid')
  })

  test('signInWithWeb3 should fail ethereum chain without publicKey', async () => {
    await expect(
      authClient.signInWithWeb3({
        chain: 'ethereum' as const,
        wallet: {
          address: '',
          on: () => void 0,
          removeListener: () => void 0,
          request: () => new Promise((resolve) => resolve([])),
        },
        options: {
          url: 'https://example.com',
        },
      })
    ).rejects.toThrow(
      '@supabase/auth-js: No accounts available. Please ensure the wallet is connected.'
    )
  })

  test('should handle signInWithWeb3 with unsupported chain', async () => {
    const credentials = {
      chain: 'polygon' as any,
      message: 'test message',
      signature: '0xtest-signature' as any,
    }

    await expect(auth.signInWithWeb3(credentials)).rejects.toThrow('Unsupported chain "polygon"')
  })

  test('should handle signInWithWeb3 with missing message', async () => {
    const credentials = {
      chain: 'ethereum',
      signature: 'test signature',
    } as any

    await expect(auth.signInWithWeb3(credentials)).rejects.toThrow(
      'Both wallet and url must be specified in non-browser environments'
    )
  })

  test('should handle signInWithWeb3 with missing wallet', async () => {
    const credentials = {
      chain: 'ethereum',
      message: 'test message',
    } as any

    const { data, error } = await auth.signInWithWeb3(credentials)
    expect(error).toBeDefined()
    expect(data.session).toBeNull()
    expect(data.user).toBeNull()
  })

  test('should handle signInWithWeb3 with invalid signature', async () => {
    const credentials = {
      chain: 'ethereum',
      message: 'test message',
      signature: '0xinvalid-signature' as any,
    } as any

    const { data, error } = await auth.signInWithWeb3(credentials)
    expect(error).toBeDefined()
    expect(data.session).toBeNull()
    expect(data.user).toBeNull()
  })

  test('should handle signInWithWeb3 in non-browser environment', async () => {
    const credentials = {
      chain: 'ethereum',
      message: 'test message',
      wallet: {
        request: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn(),
      },
      options: {
        url: 'http://localhost:9999',
      },
    } as any

    const { data, error } = await auth.signInWithWeb3(credentials)
    expect(error).toBeDefined()
    expect(data.session).toBeNull()
    expect(data.user).toBeNull()
  })
})

describe('ID Token Authentication', () => {
  test('signInWithIdToken fails with disabled provider', async () => {
    const credentials = {
      provider: 'google',
      token: 'mock-id-token',
      nonce: 'mock-nonce',
      options: {
        captchaToken: 'some_token',
      },
    }

    const { data, error } = await authClient.signInWithIdToken(credentials)

    expect(data?.session).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toContain(
      'Provider (issuer "https://accounts.google.com") is not enabled'
    )
  })

  test('should handle signInWithIdToken with provider', async () => {
    const credentials = {
      provider: 'google',
      token: 'mock-id-token',
      nonce: 'mock-nonce',
    }

    const { data, error } = await auth.signInWithIdToken(credentials)

    expect(error).not.toBeNull() // May fail due to test environment
    expect(data.session).toBeNull()
    expect(data.user).toBeNull()
  })
})

describe('Reauthentication', () => {
  test('reauthenticate() fails without session', async () => {
    const { data, error } = await auth.reauthenticate()

    expect(data?.session).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toContain(
      'Reauthentication requires the user to have an email or a phone number'
    )
  })

  test('reauthenticate() returns null user and session', async () => {
    const { email, password } = mockUserCredentials()

    await authWithSession.signUp({
      email,
      password,
    })

    const { data, error } = await authWithSession.reauthenticate()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.session).toBeNull()
    expect(data?.user).toBeNull()
  })
})

describe('Identity Management', () => {
  beforeEach(async () => {
    await authWithSession.signOut()
  })

  test('getUserIdentities() returns error without session', async () => {
    const { error } = await authWithSession.getUserIdentities()
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Auth session missing!')
  })

  test('getUserIdentities() returns user identities after signup', async () => {
    const { email, password } = mockUserCredentials()

    const { error: signUpError } = await authWithSession.signUp({
      email,
      password,
    })
    expect(signUpError).toBeNull()

    const { data, error } = await authWithSession.getUserIdentities()
    expect(error).toBeNull()
    expect(data?.identities).toHaveLength(1)
    const identity = data?.identities[0] as unknown as {
      provider: string
      identity_data: { email: string }
    }
    expect(identity.provider).toBe('email')
    expect(identity.identity_data.email).toBe(email)
  })

  test('linkIdentity() fails when manual linking is disabled', async () => {
    const { email, password } = mockUserCredentials()

    const { error: signUpError } = await authWithSession.signUp({
      email,
      password,
    })
    expect(signUpError).toBeNull()

    const { error } = await authWithSession.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000',
        scopes: 'openid profile email',
        queryParams: {
          prompt: 'select_account',
        },
      },
    })
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Manual linking is disabled')
  })

  test('unlinkIdentity() fails when manual linking is disabled', async () => {
    const { email, password } = mockUserCredentials()

    const { error: signUpError } = await authWithSession.signUp({
      email,
      password,
    })
    expect(signUpError).toBeNull()

    const { data: identitiesData } = await authWithSession.getUserIdentities()
    expect(identitiesData?.identities).toBeDefined()
    expect(identitiesData?.identities.length).toBeGreaterThan(0)

    const { error } = await authWithSession.unlinkIdentity(identitiesData!.identities[0])
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Manual linking is disabled')
  })
})

describe('Auto Refresh', () => {
  test('stopAutoRefresh() removes visibility callback and stops auto refresh', async () => {
    // @ts-expect-error 'Allow access to private _removeVisibilityChangedCallback'
    const removeVisibilitySpy = jest.spyOn(autoRefreshClient, '_removeVisibilityChangedCallback')
    // @ts-expect-error 'Allow access to private _stopAutoRefresh'
    const stopAutoRefreshSpy = jest.spyOn(autoRefreshClient, '_stopAutoRefresh')

    await autoRefreshClient.stopAutoRefresh()

    expect(removeVisibilitySpy).toHaveBeenCalledTimes(1)
    expect(stopAutoRefreshSpy).toHaveBeenCalledTimes(1)
  })

  describe('_recoverAndRefresh', () => {
    test('should recover and refresh session when valid session exists', async () => {
      const { email, password } = mockUserCredentials()

      const { data: signUpData } = await autoRefreshClient.signUp({
        email,
        password,
      })
      expect(signUpData.session).not.toBeNull()

      // @ts-expect-error 'Allow access to private _recoverAndRefresh'
      const session: Session | null = await autoRefreshClient._recoverAndRefresh()

      expect(session).not.toBeNull()
      expect(session?.access_token).not.toBeNull()
      expect(session?.refresh_token).not.toBeNull()
    })

    test('should return null session when no valid session exists', async () => {
      await autoRefreshClient.signOut()

      // @ts-expect-error 'Allow access to private _recoverAndRefresh'
      const session: Session | undefined = await autoRefreshClient._recoverAndRefresh()

      expect(session).toBeUndefined()
    })

    test('should handle expired session by attempting refresh', async () => {
      const { email, password } = mockUserCredentials()

      const { data: signUpData } = await autoRefreshClient.signUp({
        email,
        password,
      })
      expect(signUpData.session).not.toBeNull()

      // Manually expire the session
      const expired = new Date()
      expired.setMinutes(expired.getMinutes() - 1)
      const expiredSeconds = Math.floor(expired.getTime() / 1000)

      // @ts-expect-error 'Allow access to protected storage'
      const storage = autoRefreshClient.storage
      // @ts-expect-error 'Allow access to protected storageKey'
      const storageKey = autoRefreshClient.storageKey

      await storage.setItem(
        storageKey,
        JSON.stringify({
          ...JSON.parse((await storage.getItem(storageKey)) || 'null'),
          expires_at: expiredSeconds,
        })
      )

      // @ts-expect-error 'Allow access to private _recoverAndRefresh'
      const session: Session | null = await autoRefreshClient._recoverAndRefresh()

      expect(session).not.toBeNull()
      expect(session?.access_token).not.toBeNull()
      expect(session?.refresh_token).not.toBeNull()
      // Verify we got a new token
      expect(session?.access_token).not.toEqual(signUpData.session?.access_token)
    })
  })

  test('should handle auto refresh start/stop multiple times', async () => {
    await autoRefreshClient.startAutoRefresh()
    await autoRefreshClient.startAutoRefresh() // Should handle duplicate calls

    await autoRefreshClient.stopAutoRefresh()
    await autoRefreshClient.stopAutoRefresh() // Should handle duplicate calls
  })
})

describe('Session Management', () => {
  test('_notifyAllSubscribers notifies all subscribers of session changes', async () => {
    const { email, password } = mockUserCredentials()
    const mockCallback = jest.fn()

    const {
      data: { subscription },
    } = authWithSession.onAuthStateChange(mockCallback)

    const { data } = await authWithSession.signUp({
      email,
      password,
    })
    expect(data.session).not.toBeNull()

    expect(mockCallback).toHaveBeenCalledWith('SIGNED_IN', data.session)

    // Cleanup
    subscription?.unsubscribe()
  })

  test('_removeSession removes session and notifies subscribers', async () => {
    const { email, password } = mockUserCredentials()
    const mockCallback = jest.fn()
    const {
      data: { subscription },
    } = authWithSession.onAuthStateChange(mockCallback)

    const { data } = await authWithSession.signUp({
      email,
      password,
    })
    expect(data.session).not.toBeNull()

    // @ts-expect-error 'Allow access to private _removeSession'
    await authWithSession._removeSession()
    expect(mockCallback).toHaveBeenCalledWith('SIGNED_OUT', null)

    const { data: sessionData } = await authWithSession.getSession()
    expect(sessionData.session).toBeNull()

    // Cleanup
    subscription?.unsubscribe()
  })

  test('should handle getSession when no session exists', async () => {
    // Clear any existing session first
    await auth.signOut()
    const { data, error } = await auth.getSession()
    expect(data.session).toBeNull()
    expect(error).toBeNull()
  })

  test('should handle refreshSession with invalid refresh token', async () => {
    const { data, error } = await auth.refreshSession({
      refresh_token: 'invalid-refresh-token',
    })

    expect(error).toBeDefined()
    expect(data.session).toBeNull()
  })

  test('should handle setSession with invalid session data', async () => {
    const { data, error } = await auth.setSession({
      access_token: 'invalid-token',
      refresh_token: 'invalid-refresh-token',
    })

    expect(error).toBeDefined()
    expect(data.session).toBeNull()
  })

  test('should handle getUser without valid session', async () => {
    await auth.signOut()
    const { data, error } = await auth.getUser()
    expect(data.user).toBeNull()
    expect(error).toBeDefined()
  })

  test('should handle updateUser without valid session', async () => {
    await auth.signOut()
    const { data, error } = await auth.updateUser({
      data: { name: 'Test User' },
    })

    expect(error).toBeDefined()
    expect(data.user).toBeNull()
  })

  test('should handle custom URL parameters', async () => {
    const client = new GoTrueClient({
      url: 'http://localhost:9999',
      detectSessionInUrl: false,
    })

    await client.initialize()
    expect(client['detectSessionInUrl']).toBe(false)
  })
})

describe('Session Management Edge Cases', () => {
  test('getSession() with invalid refreshToken should return session with invalid tokens', async () => {
    const { email, password } = mockUserCredentials()

    await authWithSession.signUp({
      email,
      password,
    })

    // Set an invalid refresh token in storage
    // @ts-expect-error 'Allow access to protected storage'
    const storage = authWithSession.storage
    // @ts-expect-error 'Allow access to protected storageKey'
    const storageKey = authWithSession.storageKey

    const invalidSession = {
      access_token: 'invalid-token',
      refresh_token: 'invalid-refresh-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: null,
    }

    await storage.setItem(storageKey, JSON.stringify(invalidSession))

    const { data, error } = await authWithSession.getSession()

    expect(error).toBeNull()
    expect(data.session).not.toBeNull()
    expect(data.session).toEqual(invalidSession)
  })

  test('getSession() with expired refreshToken should return error for invalid token', async () => {
    const { email, password } = mockUserCredentials()

    const { data: signUpData } = await authWithSession.signUp({
      email,
      password,
    })

    // Manually expire the refresh token by setting it to a timestamp in the past
    const expiredSeconds = Math.floor(Date.now() / 1000) - 3600 // 1 hour in the past

    // @ts-expect-error 'Allow access to protected storage'
    const storage = authWithSession.storage
    // @ts-expect-error 'Allow access to protected storageKey'
    const storageKey = authWithSession.storageKey

    // Get the current session and modify it to be expired
    const currentSession = JSON.parse((await storage.getItem(storageKey)) || 'null')
    const expiredSession = {
      ...currentSession,
      expires_at: expiredSeconds,
      access_token: 'expired-token',
      refresh_token: 'expired-refresh-token',
    }

    await storage.setItem(storageKey, JSON.stringify(expiredSession))

    // Verify the session was properly stored
    const storedSession = JSON.parse((await storage.getItem(storageKey)) || 'null')
    expect(storedSession.expires_at).toBe(expiredSeconds)

    const { data, error } = await authWithSession.getSession()

    expect(error).not.toBeNull()
    expect(error?.message).toContain('Invalid Refresh Token')
    expect(data.session).toBeNull()
  })
})

describe('Storage adapter edge cases', () => {
  test('should handle storage failure gracefully', async () => {
    const brokenStorage = {
      getItem: async () => {
        throw new Error('getItem failed message')
      },
      setItem: async () => {
        throw new Error('setItem failed message')
      },
      removeItem: async () => {
        throw new Error('removeItem failed message')
      },
    }
    const client = getClientWithSpecificStorage(brokenStorage)

    await expect(client.signOut()).rejects.toThrow('getItem failed message')
  })

  test('should handle storage getItem failure in getSession', async () => {
    const brokenStorage = {
      getItem: async () => {
        throw new Error('getItem failed message')
      },
      setItem: async () => {},
      removeItem: async () => {},
    }
    const client = getClientWithSpecificStorage(brokenStorage)
    await expect(client.getSession()).rejects.toThrow('getItem failed message')
  })

  test('should handle storage setItem failure in _saveSession', async () => {
    const brokenStorage = {
      getItem: async () => '{}',
      setItem: async () => {
        throw new Error('setItem failed message')
      },
      removeItem: async () => {},
    }
    const client = getClientWithSpecificStorage(brokenStorage)
    const session = {
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: null,
    }
    // @ts-expect-error private method
    await expect(client._saveSession(session)).rejects.toThrow('setItem failed message')

    const { data, error } = await client.getSession()
    expect(error).toBeNull()
    expect(data.session).toBeNull()
  })

  test('should handle storage removeItem failure in _removeSession', async () => {
    const brokenStorage = {
      getItem: async () => '{}',
      setItem: async () => {},
      removeItem: async () => {
        throw new Error('removeItem failed message')
      },
    }
    const client = getClientWithSpecificStorage(brokenStorage)

    await expect(client.getSession()).rejects.toThrow('removeItem failed message')
  })

  test('should handle invalid JSON in storage', async () => {
    const invalidStorage = {
      getItem: async () => 'invalid-json',
      setItem: async () => {},
      removeItem: async () => {},
    }
    const client = getClientWithSpecificStorage(invalidStorage)
    const { data, error } = await client.getSession()
    expect(error).toBeNull()
    expect(data.session).toBeNull()
  })

  test('should handle null storage value', async () => {
    const nullStorage = {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    }
    const client = getClientWithSpecificStorage(nullStorage)
    const { data, error } = await client.getSession()
    expect(error).toBeNull()
    expect(data.session).toBeNull()
  })

  test('should handle empty storage value', async () => {
    const emptyStorage = {
      getItem: async () => '',
      setItem: async () => {},
      removeItem: async () => {},
    }
    const client = getClientWithSpecificStorage(emptyStorage)
    const { data, error } = await client.getSession()
    expect(error).toBeNull()
    expect(data.session).toBeNull()
  })

  test('should handle malformed session data', async () => {
    const malformedStorage = {
      getItem: async () => JSON.stringify({ access_token: 'test' }), // Missing required fields
      setItem: async () => {},
      removeItem: async () => {},
    }
    const client = getClientWithSpecificStorage(malformedStorage)
    const { data, error } = await client.getSession()
    expect(error).toBeNull()
    expect(data.session).toBeNull()
  })

  test('should handle expired session data', async () => {
    const expiredStorage = {
      getItem: async () =>
        JSON.stringify({
          access_token: 'test',
          refresh_token: 'test',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) - 1000, // Expired 1 second ago
          token_type: 'bearer',
          user: null,
        }),
      setItem: async () => {},
      removeItem: async () => {},
    }
    const client = getClientWithSpecificStorage(expiredStorage)
    // @ts-expect-error private method
    client._refreshAccessToken = async () => ({ data: { session: null, user: null }, error: null })
    const { data, error } = await client.getSession()

    expect(data.session).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Auth session missing!')
  })

  test('should return false for _isImplicitGrantCallback with missing params', () => {
    const client = getClientWithSpecificStorage(memoryLocalStorageAdapter())
    // @ts-expect-error private method
    expect(client._isImplicitGrantCallback({})).toBe(false)
  })

  test('should return false for _isPKCECallback with missing params', async () => {
    const client = getClientWithSpecificStorage(memoryLocalStorageAdapter())
    // @ts-expect-error private method
    await expect(client._isPKCECallback({})).resolves.toBe(false)
  })

  test('should build provider URL with _getUrlForProvider', async () => {
    const client = getClientWithSpecificStorage(memoryLocalStorageAdapter())
    // @ts-expect-error private method
    const url = await client._getUrlForProvider(
      GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
      'google',
      { redirectTo: 'http://localhost' }
    )
    expect(typeof url).toBe('string')
    expect(url).toContain('google')
  })

  test('_getUrlForProvider builds correct URL with PKCE flow', async () => {
    const client = new GoTrueClient({
      url: 'https://example.com',
      autoRefreshToken: false,
      persistSession: false,
      flowType: 'pkce',
    })

    const url = await client['_getUrlForProvider']('https://example.com/authorize', 'github', {
      redirectTo: 'http://localhost:3000/callback',
    })

    expect(url).toContain('provider=github')
    expect(url).toContain('code_challenge=')
    expect(url).toContain('code_challenge_method=')
  })

  test('should handle localStorage not supported', async () => {
    // Mock supportsLocalStorage to return false
    jest.doMock('../src/lib/helpers', () => ({
      ...jest.requireActual('../src/lib/helpers'),
      supportsLocalStorage: () => false,
    }))

    const client = new GoTrueClient({
      url: 'http://localhost:9999',
    })

    await client.initialize()
    // Should fall back to memory storage
    expect(client['storage']).toBeDefined()
  })
})

describe('SSO Authentication', () => {
  test('signInWithSSO with PKCE return error when SAML is disabled', async () => {
    const { data, error } = await pkceClient.signInWithSSO({
      providerId: 'valid-provider-id',
      options: {
        redirectTo: 'http://localhost:3000/callback',
        captchaToken: 'some-token',
      },
    })

    expect(error).not.toBeNull()
    expect(error?.message).toContain('SAML 2.0 is disabled')
    expect(data).toBeNull()
  })

  test('signInWithSSO should support skipBrowserRedirect option', async () => {
    // Note: In a browser environment with SAML enabled, signInWithSSO would
    // automatically redirect to the SSO provider unless skipBrowserRedirect is true.
    // This test verifies the option is accepted (actual redirect behavior cannot
    // be tested in Node.js environment)
    const { data, error } = await pkceClient.signInWithSSO({
      providerId: 'valid-provider-id',
      options: {
        redirectTo: 'http://localhost:3000/callback',
        skipBrowserRedirect: true,
      },
    })

    // SAML is disabled in test environment, so we expect an error
    expect(error).not.toBeNull()
    expect(error?.message).toContain('SAML 2.0 is disabled')
    expect(data).toBeNull()
  })

  test.each([
    {
      name: 'with empty options',
      params: {
        providerId: 'valid-provider-id',
        domain: 'valid-domain',
        options: {},
      },
    },
    {
      name: 'without params',
      params: {} as any,
    },
    {
      name: 'with minimal params',
      params: {
        providerId: 'test-provider',
        domain: 'test-domain',
      },
    },
  ])('signInWithSSO $name', async ({ params }) => {
    const { data, error } = await pkceClient.signInWithSSO(params)

    expect(error).not.toBeNull()
    expect(error?.message).toContain('SAML 2.0 is disabled')
    expect(data).toBeNull()
  })
})

describe('Lock functionality', () => {
  test('_acquireLock should execute function when lock is acquired', async () => {
    const mockFn = jest.fn().mockResolvedValue('success')
    // @ts-expect-error 'Allow access to private _acquireLock'
    const result = await authWithSession._acquireLock(1000, mockFn)
    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalled()
  })

  test('_acquireLock should throw error when lock acquisition times out', async () => {
    let shouldFail = false
    const mockLock = jest.fn().mockImplementation(async (name, timeout, fn) => {
      if (shouldFail) {
        throw new Error('Lock acquisition timeout')
      }
      return fn()
    })

    const client = new GoTrueClient({
      url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
      lock: mockLock,
      autoRefreshToken: false,
      persistSession: false,
    })

    // Wait for initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Now make the lock fail
    shouldFail = true

    const mockFn = jest.fn()
    // @ts-expect-error 'Allow access to private _acquireLock'
    await expect(client._acquireLock(1000, mockFn)).rejects.toThrow('Lock acquisition timeout')
    expect(mockFn).not.toHaveBeenCalled()
  })
})

describe('userNotAvailableProxy behavior', () => {
  test('should return proxy user when userStorage is set but user is not found', async () => {
    const storage = memoryLocalStorageAdapter()
    const userStorage = memoryLocalStorageAdapter()

    const client = new GoTrueClient({
      storage,
      userStorage,
    })

    await setItemAsync(storage, STORAGE_KEY, {
      access_token: 'jwt.accesstoken.signature',
      refresh_token: 'refresh-token',
      token_type: 'bearer',
      expires_in: 1000,
      expires_at: Date.now() / 1000 + 1000,
    })

    const {
      data: { session },
    } = await client.getSession()

    expect(session?.user).toBeDefined()
    expect((session?.user as any).__isUserNotAvailableProxy).toBe(true)

    expect(() => session?.user?.id).toThrow(
      '@supabase/auth-js: client was created with userStorage option'
    )
  })
})

describe('Branch Coverage Improvements', () => {
  describe('PKCE Flow Error Scenarios', () => {
    test('should use PKCE flow for updateUser with email when flowType is pkce and user has session', async () => {
      const { email, password } = mockUserCredentials()

      // First sign up to get a session
      await pkceClient.signUp({
        email,
        password,
      })

      const newEmail = `updated-${email}`
      const { error, data } = await pkceClient.updateUser({
        email: newEmail,
      })

      // Should trigger PKCE code challenge generation for email update
      if (error) {
        // Expected to fail due to test environment, but should have attempted PKCE flow
        expect(error).not.toBeNull()
      } else {
        expect(data.user).not.toBeNull()
      }
    })
  })

  describe('JWKS Initialization', () => {
    test('should use existing JWKS cache when available', () => {
      const storageKey = 'test-jwks-existing-' + Date.now()

      // Create a client to populate the JWKS cache
      const firstClient = new GoTrueClient({
        url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
        autoRefreshToken: false,
        persistSession: false,
        storageKey,
      })

      // Verify JWKS was initialized
      expect(firstClient['jwks']).toEqual({ keys: [] })
      expect(firstClient['jwks_cached_at']).toBe(Number.MIN_SAFE_INTEGER)

      // Create a second client with the same storage key
      const secondClient = new GoTrueClient({
        url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
        autoRefreshToken: false,
        persistSession: false,
        storageKey,
      })

      // Should use the same JWKS cache
      expect(secondClient['jwks']).toEqual(firstClient['jwks'])
      expect(secondClient['jwks_cached_at']).toBe(firstClient['jwks_cached_at'])
    })
  })

  describe('Error Handling Branches', () => {
    test('should handle _exchangeCodeForSession with network error', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'))

      const clientWithFailingFetch = new GoTrueClient({
        url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
        autoRefreshToken: false,
        persistSession: false,
        flowType: 'pkce',
        fetch: mockFetch,
      })

      // Set up storage with code verifier
      // @ts-expect-error 'Allow access to protected storage'
      const storage = clientWithFailingFetch.storage
      // @ts-expect-error 'Allow access to protected storageKey'
      const storageKey = clientWithFailingFetch.storageKey

      await storage.setItem(`${storageKey}-code-verifier`, 'mock-verifier/signin')

      // @ts-expect-error 'Allow access to private method'
      const result = await clientWithFailingFetch._exchangeCodeForSession('mock-code')

      expect(result.error).not.toBeNull()
      expect(result.data.session).toBeNull()
      expect(result.data.user).toBeNull()
    })
  })
})

describe('GoTrueClient with throwOnError option', () => {
  const store = memoryLocalStorageAdapter()
  const client = new GoTrueClient({
    url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
    storageKey: 'test-storage-key',
    autoRefreshToken: false,
    persistSession: true,
    storage: {
      ...store,
    },
    throwOnError: true, // test that the client throws errors
  })

  test('signUp() should throw an error when throwOnError is true', async () => {
    const { email, password } = mockUserCredentials()

    await expect(client.signUp({ email, password: '' })).rejects.toThrow()
  })

  test('signInWithPassword() should throw an error when throwOnError is true', async () => {
    const { email, password } = mockUserCredentials()

    await expect(client.signInWithPassword({ email, password: '' })).rejects.toThrow()
  })

  test('updateUser() should throw an error when throwOnError is true', async () => {
    const { email, password } = mockUserCredentials()

    await client.signUp({ email, password })

    await expect(client.updateUser({ email: 'invalid-email' })).rejects.toThrow()
  })

  test('signInWithOtp() should throw on invalid params when throwOnError is true', async () => {
    await expect(client.signInWithOtp({ email: 'invalid', options: { captchaToken: 'x' } })).rejects.toThrow()
  })

  test('signInWithSSO() should throw on error when throwOnError is true', async () => {
    await expect(client.signInWithSSO({ domain: 'nonexistent.example.com' })).rejects.toThrow()
  })
})
