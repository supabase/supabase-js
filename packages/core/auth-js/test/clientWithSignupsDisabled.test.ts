import { GoTrueClient, GoTrueApi, Session } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9997'

const auth = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

const authAdmin = new GoTrueApi({
  url: GOTRUE_URL,
  headers: {
    Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InN1cGFiYXNlX2FkbWluIiwiaWF0IjoxNTE2MjM5MDIyfQ.0sOtTSTfPv5oPZxsjvBO249FI4S4p0ymHoIZ6H6z9Y8`,
  },
})

const email = faker.internet.email().toLowerCase()
const password = faker.internet.password()

test('signUp()', async () => {
  const { error, data, user } = await auth.signUp({
    email,
    password,
  })
  expect(error?.message).toBe('Signups not allowed for this instance')
  expect(data).toBeNull()
  expect(user).toBeNull()
})


test('generateInviteLink()', async () => {
    const invitedUser = faker.internet.email().toLowerCase()
  const { error, data } = await authAdmin.generateLink('invite', invitedUser, {
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

test('createUser() should create a new user, even if signups are disabled', async () => {
  const { error, data } = await authAdmin.createUser({
    email,
  })
  expect(error).toBeNull()
  expect(data).toMatchInlineSnapshot()

  const { error: listError, data: users } = await authAdmin.listUsers()
  expect(listError).toBeNull()

  const user = users?.find((u) => u.email === email) || null
  expect(user?.email).toEqual(email)
})

