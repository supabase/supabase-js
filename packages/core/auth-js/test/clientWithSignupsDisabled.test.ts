import { GoTrueClient } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9997'

const auth = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

const email = faker.internet.email().toLowerCase()
const password = faker.internet.password()

test('signUp()', async () => {
  let { error, data, user } = await auth.signUp({
    email,
    password,
  })
  expect(error?.message).toBe('Signups not allowed for this instance')
  expect(data).toBeNull()
  expect(user).toBeNull()
})
