import { GoTrueApi } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9999'

const api = new GoTrueApi({
  url: GOTRUE_URL,
})

const email = `api_ac_disabled_${faker.internet.email().toLowerCase().toLowerCase()}`
const password = faker.internet.password()

test('signUpWithEmail()', async () => {
  let { error, data } = await api.signUpWithEmail(email, password, {
    redirectTo: 'https://localhost:9999/welcome',
  })
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
