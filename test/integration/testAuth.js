require('dotenv').config()
import { createClient } from '../../src'
const chai = require('chai')
const expect = chai.expect
const assert = chai.assert
chai.use(require('chai-as-promised'))

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:1234'
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'examplekey'

describe('test signing up and logging in as a new user', () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { autoRefreshToken: false })
  const randomEmail = `a${Math.random()}@google.com`

  it('should register a new user', async () => {
    try {
      const response = await supabase.auth.signup(randomEmail, '11password')
      assert(response.body.email === randomEmail, 'user could not sign up')
    } catch (error) {
      assert(!error, 'sign up returns an error')
    }
  })

  it('should log in a user and return an access token', async () => {
    try {
      const response = await supabase.auth.login(randomEmail, '11password')
      assert(response.body.access_token !== undefined, 'user could not log in')
    } catch (error) {
      assert(!error, 'log in returns an error')
    }
  })

  it('should return the currently logged in user', async () => {
    try {
      const user = await supabase.auth.user()
      assert(user.email === randomEmail, 'user could not be retrieved')
    } catch (error) {
      assert(!error, 'logged in user returns an error')
    }
  })

  it('should logout and invalidate the previous access_token', async () => {
    await supabase.auth.logout()
    await expect(supabase.auth.user()).to.be.rejectedWith(Error)
  })
})
