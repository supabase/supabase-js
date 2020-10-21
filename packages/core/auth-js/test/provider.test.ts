import { GoTrueClient } from '../src/index'

const GOTRUE_URL = 'http://localhost:9999'

const auth = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

test('signIn() with Provider', async () => {
  let { error, url, provider } = await auth.signIn({
    provider: 'google',
  })
  expect(error).toBeNull()
  expect(url).toMatchSnapshot()
  expect(provider).toMatchSnapshot()
})
