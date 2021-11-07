import { GoTrueClient } from '../src/index'

const GOTRUE_URL = 'http://localhost:9999'

const auth = new GoTrueClient({
  url: GOTRUE_URL,
  autoRefreshToken: false,
  persistSession: true,
})

test('signIn() with Provider', async () => {
  const { error, url, provider } = await auth.signIn({
    provider: 'google',
  })
  expect(error).toBeNull()
  expect(url).toBeTruthy()
  expect(provider).toBeTruthy()
})

test('signIn() with Provider can append a redirectUrl ', async () => {
  const { error, url, provider } = await auth.signIn(
    {
      provider: 'google',
    },
    {
      redirectTo: 'https://localhost:9000/welcome',
    }
  )
  expect(error).toBeNull()
  expect(url).toBeTruthy()
  expect(provider).toBeTruthy()
})

test('signIn() with Provider can append scopes', async () => {
  const { error, url, provider } = await auth.signIn(
    {
      provider: 'github',
    },
    {
      scopes: 'repo',
    }
  )
  expect(error).toBeNull()
  expect(url).toBeTruthy()
  expect(provider).toBeTruthy()
})

test('signIn() with Provider can append multiple options', async () => {
  const { error, url, provider } = await auth.signIn(
    {
      provider: 'github',
    },
    {
      redirectTo: 'https://localhost:9000/welcome',
      scopes: 'repo',
    }
  )
  expect(error).toBeNull()
  expect(url).toBeTruthy()
  expect(provider).toBeTruthy()
})
