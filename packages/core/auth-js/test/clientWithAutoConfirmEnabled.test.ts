import { GoTrueClient } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9998'

const auth = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

let authWithSession = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: false,
})

const email = `client_ac_enabled_${faker.internet.email()}`
const setSessionEmail = `client_ac_session_${faker.internet.email()}`
const password = faker.internet.password()

test('signUp()', async () => {
  let { error, user, session } = await auth.signUp({
    email,
    password,
  })
  expect(error).toBeNull()
  expect(error).toBeNull()

  expect(session).toMatchSnapshot({
    access_token: expect.any(String),
    refresh_token: expect.any(String),
    expires_in: expect.any(Number),
    expires_at: expect.any(Number),
    user: {
      id: expect.any(String),
      email: expect.any(String),
      confirmed_at: expect.any(String),
      last_sign_in_at: expect.any(String),
      created_at: expect.any(String),
      aud: expect.any(String),
      updated_at: expect.any(String),
      app_metadata: {
        provider: 'email',
      },
    },
  })
  expect(user).toMatchSnapshot({
    id: expect.any(String),
    confirmed_at: expect.any(String),
    email: expect.any(String),
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
  await authWithSession.setSession(session?.refresh_token!)
  const { user } = await authWithSession.update({ data: { hello: 'world' } })
  expect(user?.user_metadata).toStrictEqual({ hello: 'world' })
})

test('setUser should update user in session', async () => {
  const authSession = new GoTrueClient({
    url: GOTRUE_URL,
    autoRefreshToken: false,
    persistSession: false,
  })
  const session = authWithSession.session()
  const { user, error } = await authSession.setUser(session!.access_token)
  expect(error).toBeNull()
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

test('signIn()', async () => {
  let { error, session, user } = await auth.signIn({
    email,
    password,
  })
  expect(error).toBeNull()
  expect(session).toMatchSnapshot({
    access_token: expect.any(String),
    refresh_token: expect.any(String),
    expires_in: expect.any(Number),
    expires_at: expect.any(Number),
    user: {
      id: expect.any(String),
      email: expect.any(String),
      aud: expect.any(String),
      confirmed_at: expect.any(String),
      last_sign_in_at: expect.any(String),
      created_at: expect.any(String),
      updated_at: expect.any(String),
      app_metadata: {
        provider: 'email',
      },
    },
  })
  expect(user).toMatchSnapshot({
    id: expect.any(String),
    email: expect.any(String),
    aud: expect.any(String),
    confirmed_at: expect.any(String),
    last_sign_in_at: expect.any(String),
    created_at: expect.any(String),
    updated_at: expect.any(String),
    app_metadata: {
      provider: 'email',
    },
  })
  expect(user?.email).toBe(email)
})

test('Get user', async () => {
  let user = auth.user()
  expect(user).toMatchSnapshot({
    id: expect.any(String),
    email: expect.any(String),
    aud: expect.any(String),
    confirmed_at: expect.any(String),
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
  let { error, user } = await auth.update({ data: { hello: 'world' } })
  expect(error).toBeNull()
  expect(user).toMatchSnapshot({
    id: expect.any(String),
    aud: expect.any(String),
    email: expect.any(String),
    updated_at: expect.any(String),
    last_sign_in_at: expect.any(String),
    confirmed_at: expect.any(String),
    created_at: expect.any(String),
    user_metadata: {
      hello: 'world',
    },
  })
  expect(user?.email).toBe(email)
})

test('Get user after updating', async () => {
  let user = auth.user()
  expect(user).toMatchSnapshot({
    id: expect.any(String),
    aud: expect.any(String),
    email: expect.any(String),
    updated_at: expect.any(String),
    last_sign_in_at: expect.any(String),
    confirmed_at: expect.any(String),
    created_at: expect.any(String),
    user_metadata: {
      hello: 'world',
    },
  })
  expect(user?.email).toBe(email)
})

test('signOut', async () => {
  let res = await auth.signOut()
  expect(res).toMatchSnapshot()
})

test('Get user after logging out', async () => {
  let user = auth.user()
  expect(user).toBeNull()
})

test('signIn() with the wrong password', async () => {
  let { error, data } = await auth.signIn({
    email,
    password: password + '2',
  })
  expect(error!.message).not.toBeNull()
  expect(data).toBeNull()
})
