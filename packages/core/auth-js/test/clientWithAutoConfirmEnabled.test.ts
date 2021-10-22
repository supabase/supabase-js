import { GoTrueClient } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9998'

const auth = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

const authWithSession = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: false,
})

const email = `client_ac_enabled_${faker.internet.email().toLowerCase()}`
const setSessionEmail = `client_ac_session_${faker.internet.email().toLowerCase()}`
const refreshTokenEmail = `client_refresh_token_signin_${faker.internet.email().toLowerCase()}`
const password = faker.internet.password()
let access_token: string | null = null
test('signUp()', async () => {
  const { error, user, session } = await auth.signUp(
    {
      email,
      password,
    },
    { data: { status: 'alpha' } }
  )
  access_token = session?.access_token || null
  expect(error).toBeNull()
  expect(error).toBeNull()

  expect(session).toMatchObject({
    access_token: expect.any(String),
    refresh_token: expect.any(String),
    expires_in: expect.any(Number),
    expires_at: expect.any(Number),
    user: {
      id: expect.any(String),
      email: expect.any(String),
      phone: expect.anything(),
      email_confirmed_at: expect.any(String),
      last_sign_in_at: expect.any(String),
      created_at: expect.any(String),
      aud: expect.any(String),
      updated_at: expect.any(String),
      app_metadata: {
        provider: 'email',
      },
      user_metadata: {
        status: 'alpha',
      },
    },
  })
  expect(user).toMatchObject({
    id: expect.any(String),
    email_confirmed_at: expect.any(String),
    email: expect.any(String),
    phone: expect.any(String),
    last_sign_in_at: expect.any(String),
    created_at: expect.any(String),
    aud: expect.any(String),
    updated_at: expect.any(String),
    app_metadata: {
      provider: 'email',
    },
  })
  expect(user?.email).toBe(email)
})

test('setSession should return no error', async () => {
  const { error, session } = await authWithSession.signUp({
    email: setSessionEmail,
    password,
  })
  expect(error).toBeNull()
  expect(session).not.toBeNull()
  await authWithSession.setSession(session?.refresh_token as string)
  const { user } = await authWithSession.update({ data: { hello: 'world' } })
  expect(user?.user_metadata).toStrictEqual({ hello: 'world' })
})

test('signUp() the same user twice should throw an error', async () => {
  const { error, data, user } = await auth.signUp({
    email,
    password,
  })
  expect(error?.message).toBe('A user with this email address has already been registered')
  expect(data).toBeNull()
  expect(user).toBeNull()
})

test('setAuth() should set the Auth headers on a new client', async () => {
  const newClient = new GoTrueClient({
    url: GOTRUE_URL,
    autoRefreshToken: false,
    persistSession: false,
  })

  newClient.setAuth(access_token as string)

  const authBearer = newClient.session()?.access_token
  expect(authBearer).toEqual(access_token)
})

test('signIn()', async () => {
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
  const { error: initialError, session: initialSession } = await authWithSession.signUp({
    email: refreshTokenEmail,
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
  expect(user?.email).toBe(refreshTokenEmail)
})

test('Get user', async () => {
  const user = auth.user()
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

test('Update user', async () => {
  const { error, user } = await auth.update({ data: { hello: 'world' } })
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
  expect(user?.email).toBe(email)
})

test('Get user after updating', async () => {
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
    user_metadata: {
      hello: 'world',
    },
  })
  expect(user?.email).toBe(email)
})

test('signOut', async () => {
  const res = await auth.signOut()
  expect(res).toBeTruthy()
})

test('Get user after logging out', async () => {
  const user = auth.user()
  expect(user).toBeNull()
})

test('signIn() with the wrong password', async () => {
  const { error, data } = await auth.signIn({
    email,
    password: password + '2',
  })
  expect(error?.message).not.toBeNull()
  expect(data).toBeNull()
})
