import { AuthError } from '../src/lib/errors';
import {
  authClient as auth,
  authClientWithSession as authWithSession,
  authSubscriptionClient,
  clientApiAutoConfirmOffSignupsEnabledClient as phoneClient,
  clientApiAutoConfirmDisabledClient as signUpDisabledClient,
  clientApiAutoConfirmEnabledClient as signUpEnabledClient,
} from './lib/clients'
import { mockUserCredentials } from './lib/utils'

describe('GoTrueClient', () => {
  const refreshAccessTokenSpy = jest.spyOn(authWithSession.api, 'refreshAccessToken')

  afterEach(async () => {
    await auth.signOut()
    await authWithSession.signOut()
    refreshAccessTokenSpy.mockClear()
  })

  describe('Sessions', () => {
    test('setSession should return no error', async () => {
      const { email, password } = mockUserCredentials()

      const { error, session } = await authWithSession.signUp({
        email,
        password,
      })
      expect(error).toBeNull()
      expect(session).not.toBeNull()

      await authWithSession.setSession(session?.refresh_token as string)
      const { user } = await authWithSession.update({ data: { hello: 'world' } })

      expect(user).not.toBeNull()
      expect(user?.user_metadata).toStrictEqual({ hello: 'world' })
    })

    test('getSession() should return the currentUser session', async () => {
      const { email, password } = mockUserCredentials()

      const { error, session } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(session).not.toBeNull()

      const { session: userSession, error: userError } = await authWithSession.getSession()

      expect(userError).toBeNull()
      expect(userSession).not.toBeNull()
      expect(userSession).toHaveProperty('access_token')
      expect(userSession).toHaveProperty('user')
    })

    test('getSession() should refresh the session and return a new access token', async () => {
      const { email, password } = mockUserCredentials()

      const { error, session } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(session).not.toBeNull()

      const expired = new Date()
      expired.setMinutes(expired.getMinutes() - 1)
      const expiredSeconds = Math.floor(expired.getTime() / 1000)

      // @ts-expect-error 'Allow access to protected inMemorySession'
      authWithSession.inMemorySession = {
        // @ts-expect-error 'Allow access to protected inMemorySession'
        ...authWithSession.inMemorySession,
        expires_at: expiredSeconds,
      }

      // wait 1 seconds before calling getSession()
      await new Promise(r => setTimeout(r, 1000))
      const { session: userSession, error: userError } = await authWithSession.getSession()

      expect(userError).toBeNull()
      expect(userSession).not.toBeNull()
      expect(userSession).toHaveProperty('access_token')
      expect(refreshAccessTokenSpy).toBeCalledTimes(1)
      expect(session!.access_token).not.toEqual(userSession!.access_token)
    })

    test('refresh should only happen once', async () => {
      const { email, password } = mockUserCredentials()

      const { error, session } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(session).not.toBeNull()

      const [{ session: session1, error: error1 }, { session: session2, error: error2 }] =
        // @ts-expect-error 'Allow access to private _callRefreshToken()'
        await Promise.all([authWithSession._callRefreshToken(session?.refresh_token), authWithSession._callRefreshToken(session?.refresh_token)])

      expect(error1).toBeNull()
      expect(error2).toBeNull()
      expect(session1).toHaveProperty('access_token')
      expect(session2).toHaveProperty('access_token')

      // if both have the same access token, we can assume that they are
      // the result of the same refresh
      expect(session1!.access_token).toEqual(session2!.access_token)

      expect(refreshAccessTokenSpy).toBeCalledTimes(1)
    })

    test('_callRefreshToken() should resolve all pending refresh requests and reset deferred upon AuthError', async () => {
      const { email, password } = mockUserCredentials()
      refreshAccessTokenSpy.mockImplementationOnce(() => Promise.resolve({
        session: null,
        error: new AuthError('Something did not work as expected')
      }))

      const { error, session } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(session).not.toBeNull()

      const [{ session: session1, error: error1 }, { session: session2, error: error2 }] =
        // @ts-expect-error 'Allow access to private _callRefreshToken()'
        await Promise.all([authWithSession._callRefreshToken(session?.refresh_token), authWithSession._callRefreshToken(session?.refresh_token)])

      expect(error1).toHaveProperty('message')
      expect(error2).toHaveProperty('message')
      expect(session1).toBeNull()
      expect(session2).toBeNull()

      expect(refreshAccessTokenSpy).toBeCalledTimes(1)

      // vreify the deferred has been reset and successive calls can be made
      // @ts-expect-error 'Allow access to private _callRefreshToken()'
      const { session: session3, error: error3 } = await authWithSession._callRefreshToken(session?.refresh_token)

      expect(error3).toBeNull()
      expect(session3).toHaveProperty('access_token')
    })

    test('_callRefreshToken() should reject all pending refresh requests and reset deferred upon any non AuthError', async () => {
      const mockError = new Error('Something did not work as expected');

      const { email, password } = mockUserCredentials()
      refreshAccessTokenSpy.mockImplementationOnce(() => Promise.reject(mockError))

      const { error, session } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(session).not.toBeNull()

      const [error1, error2] =
        // @ts-expect-error 'Allow access to private _callRefreshToken()'
        await Promise.allSettled([authWithSession._callRefreshToken(session?.refresh_token), authWithSession._callRefreshToken(session?.refresh_token)])

      expect(error1.status).toEqual('rejected')
      expect(error2.status).toEqual('rejected')

      // status === 'rejected' above makes sure it is a PromiseRejectedResult
      expect((error1 as PromiseRejectedResult).reason).toEqual(mockError)
      expect((error1 as PromiseRejectedResult).reason).toEqual(mockError)

      expect(refreshAccessTokenSpy).toBeCalledTimes(1)

      // vreify the deferred has been reset and successive calls can be made
      // @ts-expect-error 'Allow access to private _callRefreshToken()'
      const { session: session3, error: error3 } = await authWithSession._callRefreshToken(session?.refresh_token)

      expect(error3).toBeNull()
      expect(session3).toHaveProperty('access_token')
    })

    test('getSessionFromUrl() can only be called from a browser', async () => {
      const { error, session } = await authWithSession.getSessionFromUrl()

      expect(error?.message).toEqual('No browser detected.')
      expect(session).toBeNull()
    })
  })

  test('signUp() with email', async () => {
    const { email, password } = mockUserCredentials()

    const { error, session, user } = await auth.signUp({
      email,
      password,
    })

    expect(error).toBeNull()
    expect(session).not.toBeNull()
    expect(user).not.toBeNull()

    expect(user?.email).toEqual(email)
  })

  describe('Phone OTP Auth', () => {
    test('signUp() when phone sign up missing provider account', async () => {
      const { phone, password } = mockUserCredentials()

      const { error, session, user } = await phoneClient.signUp({
        phone,
        password,
      })

      expect(error).not.toBeNull()
      expect(session).toBeNull()
      expect(user).toBeNull()

      expect(error?.message).toEqual('Error sending confirmation sms: Missing Twilio account SID')
    })

    test('signUp() with phone', async () => {
      const { phone, password } = mockUserCredentials()

      const { error, session, user } = await phoneClient.signUp({
        phone,
        password,
      })

      expect(error).not.toBeNull()
      expect(session).toBeNull()
      expect(user).toBeNull()

      // expect(user?.phone).toEqual(phone)
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
    const { error, session, user } = await auth.signUp({
      email,
      password,
    })

    expect(session).toBeNull()
    expect(user).toBeNull()

    expect(error?.message).toMatch(/^User already registered/)
  })

  test('signIn()', async () => {
    const { email, password } = mockUserCredentials()

    await auth.signUp({
      email,
      password,
    })

    const { error, session, user } = await auth.signInWithPassword({
      email,
      password,
    })

    expect(error).toBeNull()
    expect(session).toMatchObject({
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
    expect(user).toMatchObject({
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
    expect(user?.email).toBe(email)
  })

  test('signIn() with refreshToken', async () => {
    const { email, password } = mockUserCredentials()

    const { error: initialError, session: initialSession } = await authWithSession.signUp({
      email,
      password,
    })

    expect(initialError).toBeNull()
    expect(initialSession).not.toBeNull()

    const refreshToken = initialSession?.refresh_token
    const { session, error } = await authWithSession.getSession()

    expect(error).toBeNull()
    expect(session).toMatchObject({
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
    expect(session?.user).toMatchObject({
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

    expect(session?.user).not.toBeNull()
    expect(session?.user?.email).toBe(email)
  })

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

    const res = await authWithSession.signOut()

    expect(res).toBeTruthy()
  })
})

describe('User management', () => {
  test('Get user', async () => {
    const { email, password } = mockUserCredentials()

    const { session } = await authWithSession.signUp({
      email,
      password,
    })

    expect(session?.user).toMatchObject({
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

    expect(session?.user?.email).toBe(email)
  })

  test('Update user', async () => {
    const { email, password } = mockUserCredentials()

    await authWithSession.signUp({
      email,
      password,
    })

    const userMetadata = { hello: 'world' }

    const { error, user } = await authWithSession.update({ data: userMetadata })

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
    expect(user?.user_metadata).toStrictEqual(userMetadata)
  })

  test('Get user after updating', async () => {
    const { email, password } = mockUserCredentials()

    await authWithSession.signUp({
      email,
      password,
    })

    const userMetadata = { hello: 'world' }

    const { user, error } = await authWithSession.update({ data: userMetadata })

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

    const { user } = await authWithSession.signInWithPassword({
      email,
      password,
    })

    expect(user).not.toBeNull()

    await authWithSession.signOut()
    const { session, error } = await authWithSession.getSession()
    expect(session).toBeNull()
    expect(error).toBeNull()
  })

  test('signIn() with the wrong password', async () => {
    const { email, password } = mockUserCredentials()

    const { error, session } = await auth.signInWithPassword({
      email,
      password: password + '-wrong',
    })

    expect(error).not.toBeNull()
    expect(error?.message).not.toBeNull()
    expect(session).toBeNull()
  })
})

describe('The auth client can signin with third-party oAuth providers', () => {
  test('signIn() with Provider', async () => {
    const { error, url, provider } = await auth.signInWithOAuth({
      provider: 'google',
    })
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  test('signIn() with Provider can append a redirectUrl ', async () => {
    const { error, url, provider } = await auth.signInWithOAuth(
      {
        provider: 'google',
        options: {
          redirectTo: 'https://localhost:9000/welcome',
        }
      },
    )
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  test('signIn() with Provider can append scopes', async () => {
    const { error, url, provider } = await auth.signInWithOAuth(
      {
        provider: 'github',
        options: {
          scopes: 'repo'
        }
      },
    )
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  test('signIn() with Provider can append multiple options', async () => {
    const { error, url, provider } = await auth.signInWithOAuth(
      {
        provider: 'github',
        options: {
          redirectTo: 'https://localhost:9000/welcome',
          scopes: 'repo',
        }
      },
    )
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  describe('Developers can subscribe and unsubscribe', () => {
    const { subscription } = authSubscriptionClient.onAuthStateChange(() =>
      console.log('onAuthStateChange was called')
    )

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

      const { error, user } = await signUpEnabledClient.signUp({
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

      const { error, user } = await signUpDisabledClient.signUp({
        email,
        password,
      })

      expect(user).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toEqual('Signups not allowed for this instance')
    })
  })
})
