import { GoTrueClient, GoTrueApi } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9997'

const auth = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

const adminSecret =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnb3RydWUiLCJpYXQiOjE2MzYwMTU5NzAsImV4cCI6MTk4MzE3MTE3MCwiYXVkIjoiYWRtaW4iLCJzdWIiOiIifQ.A8bAscL628GfD_7eluAS3xMo-5zMDG1p70OhdqdTbPM'
const authAdmin = new GoTrueApi({
  url: GOTRUE_URL,
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
  const { error, data } = await authAdmin.createUser(
    {
      email,
    },
    adminSecret
  )
  expect(error).toBeNull()
  expect(data).toBeNull()

  const { error: listError, data: users } = await authAdmin.listUsers(adminSecret)
  expect(listError).toBeNull()
  expect(users).toBeNull()
})
