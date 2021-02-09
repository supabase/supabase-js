import { GoTrueClient } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9999'

const auth = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

const email = faker.internet.email()
const password = faker.internet.password()

test('signUp()', async () => {
  let { error, user, session } = await auth.signUp({
    email,
    password,
  })
  expect(error).toBeNull()
  expect(session).toBeNull()
  expect(user).toMatchSnapshot({
    id: expect.any(String),
    created_at: expect.any(String),
    email: expect.any(String),
    confirmation_sent_at: expect.any(String),
    aud: expect.any(String),
    updated_at: expect.any(String),
    app_metadata: {
      provider: 'email',
    },
  })
  expect(user?.confirmed_at).toBeUndefined()
  expect(user?.last_sign_in_at).toBeUndefined()
})

test('signUp() the same user twice should throw an error', async () => {
  const { error, user, session } = await auth.signUp({
    email,
    password,
  })
  expect(error?.message).toBe('Error sending confirmation mail')
  // expect(error?.message).toBe('A user with this email address has already been registered')
  expect(session).toBeNull()
  expect(user).toBeNull()
})

test('signIn()', async () => {
  let { error, session, user } = await auth.signIn({
    email,
    password,
  })
  expect(error?.message).toBe('Email not confirmed')
  expect(session).toBeNull()
  expect(user).toBeNull()
})

test('signIn() with the wrong password', async () => {
  let { error, user } = await auth.signIn({
    email,
    password: password + '2',
  })
  expect(error!.message).toBe('Email not confirmed')
  expect(user).toBeNull()
})
