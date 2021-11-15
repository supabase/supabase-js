import { GoTrueClient, GoTrueApi, User } from '../src/index'
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
  const { error, session, user } = await auth.signUp({
    email,
    password,
  })
  expect(error?.message).toBe('Signups not allowed for this instance')
  expect(session).toBeNull()
  expect(user).toBeNull()
})

test('generateLink() should be able to generate multiple links', async () => {
  const invitedUser = faker.internet.email().toLowerCase()
  const { error, data: firstInvite } = await authAdmin.generateLink('invite', invitedUser, {
    redirectTo: 'http://localhost:9997',
  })
  expect(error).toBeNull()
  expect(firstInvite).toMatchInlineSnapshot(
    {
      id: expect.any(String),
      action_link: expect.stringContaining('http://localhost:9997/?token='),
      confirmation_sent_at: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      created_at: expect.any(String),
      aud: expect.any(String),
      updated_at: expect.any(String),
      invited_at: expect.any(String),
      app_metadata: {
        provider: 'email',
      },
    },
    `
    Object {
      "action_link": StringContaining "http://localhost:9997/?token=",
      "app_metadata": Object {
        "provider": "email",
        "providers": Array [
          "email",
        ],
      },
      "aud": Any<String>,
      "confirmation_sent_at": Any<String>,
      "created_at": Any<String>,
      "email": Any<String>,
      "id": Any<String>,
      "identities": Array [],
      "invited_at": Any<String>,
      "phone": Any<String>,
      "role": "",
      "updated_at": Any<String>,
      "user_metadata": Object {},
    }
  `
  )

  const user = firstInvite as User

  const { data: secondInvite } = await authAdmin.generateLink('invite', invitedUser)

  const userAgain = secondInvite as User
  expect(userAgain.id).toMatch(user.id)
  expect(userAgain).toMatchInlineSnapshot(
    {
      id: expect.any(String),
      action_link: expect.stringContaining('http://localhost:9997/?token='),
      confirmation_sent_at: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      created_at: expect.any(String),
      aud: expect.any(String),
      updated_at: expect.any(String),
      invited_at: expect.any(String),
    },
    `
    Object {
      "action_link": StringContaining "http://localhost:9997/?token=",
      "app_metadata": Object {
        "provider": "email",
        "providers": Array [
          "email",
        ],
      },
      "aud": Any<String>,
      "confirmation_sent_at": Any<String>,
      "created_at": Any<String>,
      "email": Any<String>,
      "id": Any<String>,
      "identities": Array [],
      "invited_at": Any<String>,
      "phone": Any<String>,
      "role": "",
      "updated_at": Any<String>,
      "user_metadata": Object {},
    }
  `
  )
})

test('createUser() should create a new user, even if signups are disabled', async () => {
  const { error } = await authAdmin.createUser({
    email,
  })
  expect(error).toBeNull()

  const { error: listError, data: users } = await authAdmin.listUsers()
  expect(listError).toBeNull()

  const user = users?.find((u) => u.email === email) || null
  expect(user?.email).toEqual(email)
})
