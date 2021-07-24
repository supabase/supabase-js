import { GoTrueClient } from '../src/index'

const GOTRUE_URL = 'http://localhost:9999'
const gotrue = new GoTrueClient({ url: GOTRUE_URL })

describe('Developers can subscribe and unsubscribe', () => {
  const { data: subscription } = gotrue.onAuthStateChange(() => console.log('called'))

  test('Subscribe a listener', async () => {
    // @ts-ignore
    expect(gotrue.stateChangeEmitters.size).toBeTruthy()
  })

  test('Unsubscribe a listener', async () => {
    subscription?.unsubscribe()

    // @ts-ignore
    expect(gotrue.stateChangeEmitters.size).toBeFalsy()
  })
})
