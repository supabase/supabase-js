import { GoTrueApi } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9999'

const api = new GoTrueApi({
  url: GOTRUE_URL,
  headers: {
    Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InN1cGFiYXNlX2FkbWluIiwiaWF0IjoxNTE2MjM5MDIyfQ.0sOtTSTfPv5oPZxsjvBO249FI4S4p0ymHoIZ6H6z9Y8`,
  },
})

const email = `api_ac_disabled_${faker.internet.email().toLowerCase()}`
const password = faker.internet.password()

test('signUpWithEmail()', async () => {
  let { error, data } = await api.signUpWithEmail(email, password, {
    redirectTo: 'https://localhost:9999/welcome',
  })
  expect(error).toBeNull()
  expect(data).toMatchObject({
    aud: expect.any(String),
    confirmation_sent_at: expect.any(String),
    created_at: expect.any(String),
    email: expect.any(String),
    id: expect.any(String),
    phone: "",
    role: "",
    updated_at: expect.any(String),
    app_metadata: {
      provider: 'email',
    },
  })
})

const email2 = `api_generate_link_signup_${faker.internet.email().toLowerCase()}`
const password2 = faker.internet.password()

test('signUpWithGenerateConfirmationLink()', async () => {
  let { error, data } = await api.generateLink('signup', email2, {
    password: password2,
    data: { status: 'alpha' },
    redirectTo: 'http://localhost:9999/welcome',
  })
  expect(error).toBeNull()
  expect(data).toMatchObject({
    action_link: expect.any(String),
    id: expect.any(String),
    confirmation_sent_at: expect.any(String),
    email: expect.any(String),
    created_at: expect.any(String),
    phone: expect.any(String),
    aud: expect.any(String),
    updated_at: expect.any(String),
    app_metadata: {
      provider: 'email',
    },
  })
})

const email3 = `api_generate_link_signup_${faker.internet.email().toLowerCase()}`

test('generateMagicLink()', async () => {
  let { error, data } = await api.generateLink('magiclink', email3, {
    redirectTo: 'http://localhost:9999/welcome',
  })
  expect(error).toBeNull()
  expect(data).toMatchObject({
    action_link: expect.any(String),
    id: expect.any(String),
    confirmation_sent_at: expect.any(String),
    email: expect.any(String),
    phone: expect.any(String),
    created_at: expect.any(String),
    aud: expect.any(String),
    updated_at: expect.any(String),
    app_metadata: {
      provider: 'email',
    },
  })
})

test('generateInviteLink()', async () => {
  let { error, data } = await api.generateLink('invite', email3, {
    redirectTo: 'http://localhost:9999/welcome',
  })
  expect(error).toBeNull()
  expect(data).toMatchObject({
    action_link: expect.any(String),
    id: expect.any(String),
    confirmation_sent_at: expect.any(String),
    email: expect.any(String),
    phone: expect.any(String),
    created_at: expect.any(String),
    aud: expect.any(String),
    updated_at: expect.any(String),
    app_metadata: {
      provider: 'email',
    },
  })
})

test('generateRecoveryLink()', async () => {
  let { error, data } = await api.generateLink('recovery', email, {
    redirectTo: 'http://localhost:9999/welcome',
  })
  expect(error).toBeNull()
  expect(data).toMatchObject({
    action_link: expect.anything(),
    app_metadata: {
      provider: 'email',
    },
    aud: '',
    confirmation_sent_at: expect.any(String),
    created_at: expect.any(String),
    email: expect.any(String),
    id: expect.any(String),
    phone: '',
    recovery_sent_at: expect.any(String),
    updated_at: expect.any(String),
    user_metadata: expect.any(Object),
  })
})
