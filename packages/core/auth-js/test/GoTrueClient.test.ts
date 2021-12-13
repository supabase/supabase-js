import {
  authClient as auth,
  authClientWithSession as authWithSession,
  authSubscriptionClient,
} from './lib/clients'
import { mockUserCredentials } from './lib/utils'

describe('GoTrueClient', () => {
  afterEach(async () => {
    await auth.signOut()
    await authWithSession.signOut()
  })

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

  test('signUp() the same user twice should not share email already registered message', async () => {
    // let's sign up twice with a specific user so we can run this test individually
    // and not rely on prior tests to have signed up the same user email
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
