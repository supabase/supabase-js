import { GoTrueApi } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9999'

const api = new GoTrueApi({
  url: GOTRUE_URL,
})

const email = faker.internet.email()
const password = faker.internet.password()

test('signUp()', async () => {
  let { error, data } = await api.signUpWithEmail(email, password)
  expect(error).toBeNull()
  expect(data).toMatchSnapshot({
    id: expect.any(String),
    confirmation_sent_at: expect.any(String),
    email: expect.any(String),
    created_at: expect.any(String),
    aud: expect.any(String),
    updated_at: expect.any(String),
    app_metadata: {
      provider: 'email',
    },
  })
})

test('signUp() the same user twice should throw an error', async () => {
  let { error, data } = await api.signUpWithEmail(email, password)
  expect(error?.message).toBe('Error sending confirmation mail')
  // expect(error?.message).toBe('A user with this email address has already been registered')
  expect(data).toBeNull()
})