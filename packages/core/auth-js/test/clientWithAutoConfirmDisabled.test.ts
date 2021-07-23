import { GoTrueClient } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9999'

const auth = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

const email = faker.internet.email().toLowerCase()
const phone = '6587522029'
const password = faker.internet.password()

test('signUp() with email and password', async () => {
  let { error, user, session } = await auth.signUp({
    email,
    password,
  })
  expect(error).toBeNull()
  expect(session).toBeNull()
  expect(user).toMatchObject({
    id: expect.any(String),
    created_at: expect.any(String),
    email: expect.any(String),
    confirmation_sent_at: expect.any(String),
    phone: '',
    aud: expect.any(String),
    updated_at: expect.any(String),
    app_metadata: {
      provider: 'email',
    },
  })
  expect(user?.email_confirmed_at).toBeUndefined()
  expect(user?.last_sign_in_at).toBeUndefined()
  expect(user?.email).toBe(email)
})

test('signUp() with phone and password', async () => {
  let { error, user, session } = await auth.signUp({
    phone,
    password,
  })
  expect(error).toBeNull()
  expect(session).toBeNull()
  expect(user).toMatchObject({
    id: expect.any(String),
    created_at: expect.any(String),
    email: '',
    confirmation_sent_at: expect.any(String),
    phone: phone,
    aud: expect.any(String),
    updated_at: expect.any(String),
    app_metadata: {
      provider: 'phone',
    },
  })
  expect(user?.phone_confirmed_at).toBeUndefined()
  expect(user?.email_confirmed_at).toBeUndefined()
  expect(user?.last_sign_in_at).toBeUndefined()
  expect(user?.phone).toBe(phone)
})

test('signUp() the same user twice should throw an error', async () => {
  const { error, user, session } = await auth.signUp({
    email,
    password,
  })
  expect(error?.message).toContain('For security purposes, you can only request this after')
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

test('verifyMobileOTP() errors on bad token', async () => {
  const token: string = '123456'

  let { error, user, session } = await auth.verifyOTP(
    { phone, token },
    {
      redirectTo: 'http://localhost:9999/welcome',
    }
  )
  expect(error?.message).toContain('Otp has expired or is invalid')
  expect(session).toBeNull()
  expect(user).toBeNull()
})
