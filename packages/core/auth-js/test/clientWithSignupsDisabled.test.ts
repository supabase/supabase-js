import { GoTrueClient, GoTrueApi, Session } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9997'

const auth = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

const ADMIN_JWT =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnb3RydWUiLCJpYXQiOjE2MzYwMTU5NzAsImV4cCI6MTk4MzE3MTE3MCwiYXVkIjoiIiwic3ViIjoiIiwicm9sZSI6ImFkbWluIn0.ZPwFUVYpogSbluiy7hcDMxWk7ZnK4T3ApS-Cyv8niPs'

const authAdmin = new GoTrueApi({
  url: GOTRUE_URL,
  headers: {
    Authorization: `Bearer ${ADMIN_JWT}`,
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

test('createUser() should create a new user, even if signups are disabled', async () => {
  const { error, data } = await authAdmin.createUser({
    email,
  })
  expect(error).toBeNull()
  expect(data?.email).toEqual(email)

  const { error: listError, data: users } = await authAdmin.listUsers()
  expect(listError).toBeNull()

  const user = users?.find((u) => u.email === email) || null
  expect(user?.email).toEqual(email)
})

test('generateLink()', async () => {
  const invitedUser = faker.internet.email().toLowerCase()
  const { error, data } = await authAdmin.generateLink('invite', invitedUser)
  expect(error).toBeNull()
  expect((data as Session)?.access_token).toEqual(email)
})
