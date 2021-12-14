import faker from 'faker'

import { mockUserCredentials, createNewUserWithEmail } from './utils'

describe('useful helper utilities when using the auth clients', () => {
  test('mockUserCredentials() has email', () => {
    const { email, password } = mockUserCredentials()

    expect(email).not.toBeUndefined()
    expect(password).not.toBeUndefined()

    expect(email).toMatch(/.*@.*/g)
    expect(password.length).toBeGreaterThan(0)
  })

  test('mockUserCredentials() has phone', () => {
    const { phone, password } = mockUserCredentials()

    expect(phone).not.toBeUndefined()
    expect(password).not.toBeUndefined()

    expect(phone).toMatch(/\d{11}/g)
    expect(password.length).toBeGreaterThan(0)
  })

  test('createNewUserWithEmail()', async () => {
    const { data: user } = await createNewUserWithEmail({
      email: faker.internet.email().toLowerCase(),
    })

    expect(user).not.toBeNull()
    expect(user?.email).not.toBeUndefined()
    expect(user?.email).toMatch(/.*@.*/g)
  })
})
