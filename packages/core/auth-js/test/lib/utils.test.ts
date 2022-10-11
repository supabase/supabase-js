import {
  mockUserCredentials,
  mockUserMetadata,
  mockAppMetadata,
  createNewUserWithEmail,
} from './utils'

describe('useful helper utilities when using the auth clients', () => {
  describe('Mocks User Credentials', () => {
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
      const email = `user+${Date.now()}@example.com`
      const { data } = await createNewUserWithEmail({
        email,
      })

      expect(data.user).not.toBeNull()
      expect(data.user?.email).not.toBeUndefined()
      expect(data.user?.email).toEqual(email)
    })
  })
  describe('Mocks User Metadata()', () => {
    test('mockUserMetadata()', async () => {
      const userMetadata = mockUserMetadata()

      expect(userMetadata).not.toBeNull()
      expect(userMetadata?.profile_image).not.toBeUndefined()
      expect(userMetadata?.profile_image).toMatch(/^https.*avatars.*(jpg|png)$/g)
    })
  })

  describe('Mocks App Metadata()', () => {
    test('mockAppMetadata()', async () => {
      const appMetadata = mockAppMetadata()

      expect(appMetadata).not.toBeNull()
      expect(appMetadata?.roles).not.toBeUndefined()
      expect(appMetadata?.roles.length).toBeGreaterThanOrEqual(1)
    })
  })
})
