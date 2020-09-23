import { Client } from '../src/index'

const GOTRUE_URL = 'http://localhost:9999'

const auth = new Client({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

const email = 'fake@email.com'
const password = 'secret'

test('signUp()', async () => {
  let { error, data } = await auth.signUp({
    email,
    password,
  })
  expect(error).toBeNull()
  expect(data).toMatchSnapshot({
    access_token: expect.any(String),
    refresh_token: expect.any(String),
    expires_in: expect.any(Number),
    user: {
      id: expect.any(String),
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
})

test('signIn()', async () => {
  let { error, data } = await auth.signIn({
    email,
    password,
  })
  expect(error).toBeNull()
  expect(data).toMatchSnapshot({
    access_token: expect.any(String),
    refresh_token: expect.any(String),
    expires_in: expect.any(Number),
    user: {
      id: expect.any(String),
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
})

test('Get user', async () => {
  let { error, data } = await auth.user()
  expect(error).toBeNull()
  expect(data).toMatchSnapshot({
    id: expect.any(String),
    aud: expect.any(String),
    confirmed_at: expect.any(String),
    created_at: expect.any(String),
    updated_at: expect.any(String),
    app_metadata: {
      provider: 'email',
    },
  })
})

test('Update user', async () => {
  let { error, data } = await auth.update({ data: { hello: 'world' } })
  expect(error).toBeNull()
  expect(data).toMatchSnapshot({
    id: expect.any(String),
    aud: expect.any(String),
    updated_at: expect.any(String),
    confirmed_at: expect.any(String),
    created_at: expect.any(String),
    user_metadata: {
      hello: 'world',
    },
  })
})

test('Get user after updating', async () => {
  let { error, data } = await auth.user()
  expect(error).toBeNull()
  expect(data).toMatchSnapshot({
    id: expect.any(String),
    aud: expect.any(String),
    updated_at: expect.any(String),
    confirmed_at: expect.any(String),
    created_at: expect.any(String),
    user_metadata: {
      hello: 'world',
    },
  })
})

test('signOut', async () => {
  let res = await auth.signOut()
  expect(res).toMatchSnapshot()
})

test('Get user after logging out', async () => {
  let res = await auth.user()
  expect(res).toMatchSnapshot()
})
