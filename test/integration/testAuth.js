const chai = require('chai')
const expect = chai.expect
const assert = chai.assert
chai.use(require('chai-as-promised'))

import { createClient } from '../../src'

describe('test signing up and logging in as a new user', () => {
  const supabase = createClient(
    'https://UxtUdvoEHGzXftFJhwwT.supabase.net',
    'XbBJdEH2WdymQ0Hq9Huk1JqCCmggPX'
  )
  const randomEmail = `a${Math.random()}@google.com`

  it('should register a new user', async () => {
    const response = await supabase.auth.signup(randomEmail, '11password')
    assert(response.email === randomEmail, 'user could not sign up')
  })

  it('should log in a user and return an access token', async () => {
    const response = await supabase.auth.login(randomEmail, '11password')
    assert(response.body.access_token !== undefined, 'user could not log in')
  })

  it('should return the currently logged in user', async () => {
    const user = await supabase.auth.user()
    assert(user.email === randomEmail, 'user could not be retrieved')
  })

  it('should logout and invalidate the previous access_token', async () => {
    await supabase.auth.logout()
    await expect(supabase.auth.user()).to.be.rejectedWith(Error)
  })
})
