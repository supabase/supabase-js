import { OpenIDConnectCredentials } from '../src'
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
  afterEach(async () => {
    await auth.signOut()
    await authWithSession.signOut()
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

    test('session() should return the currentUser session', async () => {
      const { email, password } = mockUserCredentials()

      const { error, session } = await authWithSession.signUp({
        email,
        password,
      })

      expect(error).toBeNull()
      expect(session).not.toBeNull()

      const userSession = authWithSession.session()

      expect(userSession).not.toBeNull()
      expect(userSession).toHaveProperty('access_token')
      expect(userSession).toHaveProperty('user')
    })

    test('getSessionFromUrl() can only be called from a browser', async () => {
      const { error, data } = await authWithSession.getSessionFromUrl()

      expect(error?.message).toEqual('No browser detected.')
      expect(data).toBeNull()
    })

    test('refreshSession() raises error if not logged in', async () => {
      const { error, user, data } = await authWithSession.refreshSession()
      expect(error?.message).toEqual('Not logged in.')
      expect(user).toBeNull()
      expect(data).toBeNull()
    })

    test('refreshSession() forces refreshes the session to get a new refresh token for same user', async () => {
      const { email, password } = mockUserCredentials()

      const { error: initialError, session } = await authWithSession.signUp({
        email,
        password,
      })

      expect(initialError).toBeNull()
      expect(session).not.toBeNull()

      const refreshToken = session?.refresh_token

      const { error, user, data } = await authWithSession.refreshSession()

      expect(error).toBeNull()
      expect(user).not.toBeNull()
      expect(data).not.toBeNull()

      expect(user?.email).toEqual(email)
      expect(data).toHaveProperty('refresh_token')
      expect(refreshToken).not.toEqual(data?.refresh_token)
    })
  })

  describe('Authentication', () => {
    test('setAuth() should set the Auth headers on a new client', async () => {
      const { email, password } = mockUserCredentials()

      const { session } = await auth.signUp({
        email,
        password,
      })

      const access_token = session?.access_token || null

      authWithSession.setAuth(access_token as string)

      const authBearer = authWithSession.session()?.access_token
      expect(authBearer).toEqual(access_token)
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
      expect(error?.status).toEqual(400)
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

    const { error, session, user } = await auth.signIn({
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
    const { error, user, session } = await authWithSession.signIn({ refreshToken })

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

    expect(user).not.toBeNull()
    expect(user?.email).toBe(email)
  })

  test('signIn with OpenIDConnect wrong id_token', async () => {
    const oidc: OpenIDConnectCredentials = {
      id_token: 'abcde',
      nonce: 'random value',
      provider: 'google'
    }
    const { session, user, error } = await auth.signIn({oidc})

    expect(error).not.toBeNull()
    expect(session).toBeNull()
    expect(user).toBeNull()
  })

  test('signIn with OpenIDConnect both client_id and provider are null', async () => {
    const oidc: OpenIDConnectCredentials = {
      id_token: 'abcde',
      nonce: 'random value',
    }
    const { session, user, error } = await auth.signIn({oidc})

    expect(error).not.toBeNull()
    expect(session).toBeNull()
    expect(user).toBeNull()
  })

  test('signIn with OpenIDConnect both id_token and client_id is null', () => {
    const t = async ()=>{
      const oidc: OpenIDConnectCredentials = {
        nonce: 'random value',
        provider: 'google'
      }
      await auth.signIn({oidc})
    }
    expect(t).toThrow(TypeError);
  })
  
  test('signOut', async () => {
    const { email, password } = mockUserCredentials()

    await authWithSession.signUp({
      email,
      password,
    })

    await authWithSession.signIn({
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

    const user = authWithSession.user()

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

    expect(session?.user?.email).toBe(email)
  })

  test('Update user', async () => {
    const { email, password } = mockUserCredentials()

    await auth.signUp({
      email,
      password,
    })

    const userMetadata = { hello: 'world' }

    const { error, user } = await auth.update({ data: userMetadata })

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

    await auth.signUp({
      email,
      password,
    })

    const userMetadata = { hello: 'world' }

    await auth.update({ data: userMetadata })

    const user = auth.user()

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

    await authWithSession.signIn({
      email,
      password,
    })

    const user = await authWithSession.user()
    expect(user).not.toBeNull()

    await authWithSession.signOut()
    const userAfterSignOut = authWithSession.user()

    expect(userAfterSignOut).toBeNull()
  })

  test('signIn() with the wrong password', async () => {
    const { email, password } = mockUserCredentials()

    const { error, session } = await auth.signIn({
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
    const { error, url, provider } = await auth.signIn({
      provider: 'google',
    })
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  test('signIn() with Provider can append a redirectUrl ', async () => {
    const { error, url, provider } = await auth.signIn(
      {
        provider: 'google',
      },
      {
        redirectTo: 'https://localhost:9000/welcome',
      }
    )
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  test('signIn() with Provider can append scopes', async () => {
    const { error, url, provider } = await auth.signIn(
      {
        provider: 'github',
      },
      {
        scopes: 'repo',
      }
    )
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  test('signIn() with Provider can append multiple options', async () => {
    const { error, url, provider } = await auth.signIn(
      {
        provider: 'github',
      },
      {
        redirectTo: 'https://localhost:9000/welcome',
        scopes: 'repo',
      }
    )
    expect(error).toBeNull()
    expect(url).toBeTruthy()
    expect(provider).toBeTruthy()
  })

  describe('Developers can subscribe and unsubscribe', () => {
    const { data: subscription } = authSubscriptionClient.onAuthStateChange(() =>
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
