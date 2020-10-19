import { GoTrueClient } from '../src/index'
import { Provider } from '../src/lib/types'

const GOTRUE_URL = 'http://localhost:9999'

const auth = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

test('signIn() with Provider', async () => {
  let { error, data } = await auth.signIn({
    provider: Provider.GOOGLE,
  })
  expect(error).toBeNull()
  expect(data).toMatchSnapshot()
})
