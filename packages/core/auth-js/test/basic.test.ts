import { Client, Admin } from '../src/index'

const GOTRUE_URL = 'http://localhost:3000'
const gotrue = new Client(GOTRUE_URL)
const admin = new Admin(GOTRUE_URL)

test('Init', async () => {
  expect(gotrue.url).toMatchSnapshot()
  expect(admin.url).toMatchSnapshot()
})


describe('Developers can subscribe and unsubscribe', () => {
  const subscription = gotrue.onAuthStateChange(() => console.log('called'))
  test('Subscribe a listener', async () => {
    expect(gotrue.stateChangeEmitters.size).toMatchSnapshot()
  })
  test('Unsubscribe a listener', async () => {
    subscription.unsubscribe()
    expect(gotrue.stateChangeEmitters.size).toMatchSnapshot()
  })
})


