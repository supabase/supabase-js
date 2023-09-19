import { AuthError } from '../src/lib/errors'
import {
  authClient as auth,
  authClientWithSession as authWithSession,
  authSubscriptionClient,
  clientApiAutoConfirmOffSignupsEnabledClient as phoneClient,
  clientApiAutoConfirmDisabledClient as signUpDisabledClient,
  clientApiAutoConfirmEnabledClient as signUpEnabledClient,
  authAdminApiAutoConfirmEnabledClient,
} from './lib/clients'
import { mockUserCredentials } from './lib/utils'

describe('GoTrueClient', () => {
  // @ts-expect-error 'Allow access to private _refreshAccessToken'
  const refreshAccessTokenSpy = jest.spyOn(authWithSession, '_refreshAccessToken')

  afterEach(async () => {
    await auth.signOut()
    await authWithSession.signOut()
    refreshAccessTokenSpy.mockClear()
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

      /**
       * Sign out the user to verify setSession, getSession and updateUser
       * are truly working; because the signUp method will already save the session.
       * And that session will be available to getSession and updateUser,
       * even if setSession isn't called or fails to save the session.
       * The tokens are still valid after logout, and therefore usable.
       */
      await authWithSession.signOut()

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

    test('refresh should only happen once', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(data.session).not.toBeNull()

      const [{ session: session1, error: error1 }, { session: session2, error: error2 }] =
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

      const [{ session: session1, error: error1 }, { session: session2, error: error2 }] =
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
      const { session: session3, error: error3 } = await authWithSession._callRefreshToken(
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
      const { session: session3, error: error3 } = await authWithSession._callRefreshToken(
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
  })

  describe('Phone OTP Auth', () => {
    test('signUp() when phone sign up missing provider account', async () => {
      const { phone, password } = mockUserCredentials()

      const { error, data } = await phoneClient.signUp({
        phone,
        password,
      })

      expect(error).not.toBeNull()
      expect(data.session).toBeNull()
      expect(data.user).toBeNull()

      expect(error?.message).toEqual('Error sending confirmation sms: Missing Twilio account SID')
    })

    test('signUp() with phone', async () => {
      const { phone, password } = mockUserCredentials()

      const { error, data } = await phoneClient.signUp({
        phone,
        password,
      })

      expect(error).not.toBeNull()
      expect(data.session).toBeNull()
      expect(data.user).toBeNull()
    })

    test('signInWithOtp() with phone', async () => {
      const { phone } = mockUserCredentials()

      const { data, error } = await phoneClient.signInWithOtp({
        phone,
      })
      expect(error).not.toBeNull()
      expect(data.session).toBeNull()
      expect(data.user).toBeNull()
    })

    test('verifyOTP()', async () => {
      // unable to test
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
    })

    expect(error).not.toBeNull()
    expect(error?.message).not.toBeNull()
    expect(data.session).toBeNull()
  })
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
    const { error, data } = await authWithSession.resetPasswordForEmail(
      'this_user@does-not-exist.com',
      {
        redirectTo,
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
