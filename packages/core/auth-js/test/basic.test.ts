import { Client, Admin } from '../src/index'

const GOTRUE_URL = 'http://localhost:3000'
const gotrue = new Client(GOTRUE_URL)
const admin = new Admin(GOTRUE_URL)

test('Init', async () => {
  expect(gotrue.url).toMatchSnapshot()
  expect(admin.url).toMatchSnapshot()
})
