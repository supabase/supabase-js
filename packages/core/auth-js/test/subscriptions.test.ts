import { GoTrueClient } from '../src/index'

const GOTRUE_URL = 'http://localhost:3000'
const gotrue = new GoTrueClient({ url: GOTRUE_URL })

describe('Developers can subscribe and unsubscribe', () => {
  const { data: subscription } = gotrue.onAuthStateChange(() => console.log('called'))

  test('Subscribe a listener', async () => {
    expect(gotrue.stateChangeEmmitters.size).toMatchSnapshot()
  })

  test('Unsubscribe a listener', async () => {
    subscription?.unsubscribe()
    expect(gotrue.stateChangeEmmitters.size).toMatchSnapshot()
  })
})
