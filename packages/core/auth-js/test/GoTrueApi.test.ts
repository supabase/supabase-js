import {
  GOTRUE_URL_AUTO_CONFIRM_DISABLED,
  serviceRoleApiClient,
  authClientWithSession,
} from './lib/clients'
import { createNewUserWithEmail, mockUserCredentials } from './lib/utils'

import type { User } from '../src/lib/types'

describe('GoTrueApi', () => {
  describe('User creation', () => {
    test('createUser() should create a new user', async () => {
      const { email } = mockUserCredentials()
      const { error, data: user } = await createNewUserWithEmail({ email })

      expect(error).toBeNull()
      expect(user?.email).toEqual(email)
    })
  })

  describe('User fetch', () => {
    test('listUsers() should return registered users', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: user } = await createNewUserWithEmail({ email })
      expect(createError).toBeNull()
      expect(user).not.toBeUndefined()

      const { error: listUserError, data: users } = await serviceRoleApiClient.listUsers()
      expect(listUserError).toBeNull()

      const emails =
        users?.map((user) => {
          return user.email
        }) || []

      expect(emails.length).toBeGreaterThan(0)
      expect(emails).toContain(email)
    })

    test('getUser() fetches a user by their access_token', async () => {
      const { email, password } = mockUserCredentials()
      const { error: initialError, session } = await authClientWithSession.signUp({
        email,
        password,
      })

      expect(initialError).toBeNull()
      expect(session).not.toBeNull()

      const { error, user } = await serviceRoleApiClient.getUser(session?.access_token)

      expect(error).toBeNull()
      expect(user).not.toBeUndefined()
      expect(user?.email).toEqual(email)
    })

    test('getUserByCookie() fetches a user by its Cookie', async () => {
      // may not be able to test via Jest without request.cookie
    })

    test('getUserById() should a registered user given its user identifier', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: user } = await createNewUserWithEmail({ email })

      expect(createError).toBeNull()
      expect(user).not.toBeUndefined()

      const uid = user?.id || ''
      expect(uid).toBeTruthy()

      const { error: foundError, data: foundUser } = await serviceRoleApiClient.getUserById(uid)

      expect(foundError).toBeNull()
      expect(foundUser).not.toBeUndefined()
      expect(foundUser?.email).toEqual(email)
    })
  })

  describe('User updates', () => {
    test('modify email using updateUserById()', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: user } = await createNewUserWithEmail({ email })

      expect(createError).toBeNull()
      expect(user).not.toBeUndefined()

      const uid = user?.id || ''

      const attributes = { email: `new_${user?.email}` }

      const { error: updatedError, data: updatedUser } = await serviceRoleApiClient.updateUserById(
        uid,
        attributes
      )

      expect(updatedError).toBeNull()
      expect(updatedError).not.toBeUndefined()
      expect(updatedUser?.email).toEqual(`new_${user?.email}`)
    })

    test('modify user metadata using updateUserById()', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: user } = await createNewUserWithEmail({ email })

      expect(createError).toBeNull()
      expect(user).not.toBeUndefined()

      const uid = user?.id || ''

      const userMetaData = { favorite_color: 'yellow' }
      const attributes = { user_metadata: userMetaData }

      const { error: updatedError, data: updatedUser } = await serviceRoleApiClient.updateUserById(
        uid,
        attributes
      )

      expect(updatedError).toBeNull()
      expect(updatedError).not.toBeUndefined()
      expect(updatedUser?.email).toEqual(email)
      expect(updatedUser?.user_metadata).toEqual(userMetaData)
    })

    test('modify app metadata using updateUserById()', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: user } = await createNewUserWithEmail({ email })

      expect(createError).toBeNull()
      expect(user).not.toBeUndefined()

      const uid = user?.id || ''
      const appMetadata = { roles: ['admin', 'publisher'] }
      const attributes = { app_metadata: appMetadata }
      const { error: updatedError, data: updatedUser } = await serviceRoleApiClient.updateUserById(
        uid,
        attributes
      )

      expect(updatedError).toBeNull()
      expect(updatedError).not.toBeUndefined()
      expect(updatedUser?.email).toEqual(email)
      expect(updatedUser?.app_metadata).toHaveProperty('roles')
    })
  })

  describe('User deletes', () => {
    test('deleteUser() should be able delete an existing user', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: user } = await createNewUserWithEmail({ email })

      expect(createError).toBeNull()
      expect(user).not.toBeUndefined()

      const uid = user?.id || ''

      const { error: deletedError, data: deletedUser } = await serviceRoleApiClient.deleteUser(uid)

      expect(deletedError).toBeNull()
      expect(deletedError).not.toBeUndefined()
      expect(deletedUser).not.toBeUndefined()

      const { error: listUserError, data: users } = await serviceRoleApiClient.listUsers()
      expect(listUserError).toBeNull()

      const emails =
        users?.map((user) => {
          return user.email
        }) || []

      expect(emails.length).toBeGreaterThan(0)
      expect(emails).not.toContain(email)
    })
  })

  describe('User registration', () => {
    test('signUpWithEmail() creates a new user', async () => {
      const { email, password } = mockUserCredentials()

      const { error, data } = await serviceRoleApiClient.signUpWithEmail(email, password, {
        redirectTo: GOTRUE_URL_AUTO_CONFIRM_DISABLED,
        data: { status: 'alpha' },
      })

      expect(error).toBeNull()
      expect(data).toMatchObject({
        aud: expect.any(String),
        confirmation_sent_at: expect.any(String),
        created_at: expect.any(String),
        email: expect.any(String),
        id: expect.any(String),
        phone: '',
        role: '',
        updated_at: expect.any(String),
        app_metadata: {
          provider: 'email',
        },
        user_metadata: {
          status: 'alpha',
        },
      })
    })

    test('generateLink() supports signUp with generate confirmation signup link ', async () => {
      const { email, password } = mockUserCredentials()

      const redirectTo = 'http://localhost:9999/welcome'
      const userMetadata = { status: 'alpha' }

      const { error, data } = await serviceRoleApiClient.generateLink('signup', email, {
        password: password,
        data: userMetadata,
        redirectTo,
      })

      const user = data as User

      expect(error).toBeNull()
      expect(user).not.toBeNull()
      expect(user).toHaveProperty('action_link')
      expect(user?.['action_link']).toMatch(/verify\?token/)
      expect(user?.['action_link']).toMatch(/type=signup/)
      expect(user?.['action_link']).toMatch(new RegExp(`redirect_to=${redirectTo}`))
      expect(user).toHaveProperty('user_metadata')
      expect(user?.['user_metadata']).toEqual(userMetadata)
    })

    test('inviteUserByEmail() creates a new user with an invited_at timestamp', async () => {
      const { email } = mockUserCredentials()

      const redirectTo = 'http://localhost:9999/welcome'
      const userMetadata = { status: 'alpha' }
      const { error, data: user } = await serviceRoleApiClient.inviteUserByEmail(email, {
        data: userMetadata,
        redirectTo,
      })

      expect(error).toBeNull()
      expect(user).not.toBeNull()
      expect(user).toHaveProperty('invited_at')
      expect(user?.invited_at).toBeDefined()
    })
  })

  describe('User management', () => {
    test('resetPasswordForEmail() sends an email for  password recovery', async () => {
      const { email, password } = mockUserCredentials()

      const { error: initialError, session } = await authClientWithSession.signUp({
        email,
        password,
      })

      expect(initialError).toBeNull()
      expect(session).not.toBeNull()

      const redirectTo = 'http://localhost:9999/welcome'
      const { error, data: user } = await serviceRoleApiClient.resetPasswordForEmail(email, {
        redirectTo,
      })

      expect(user).toBeTruthy()
      expect(error?.message).toBeUndefined()
    })

    test('resetPasswordForEmail() if user does not exist, cannot send an email for password recovery', async () => {
      const redirectTo = 'http://localhost:9999/welcome'
      const { error, data: user } = await serviceRoleApiClient.resetPasswordForEmail(
        'this_user@does-not-exist.com',
        {
          redirectTo,
        }
      )

      expect(user).toBeNull()
      expect(error?.message).toEqual('User not found')
    })

    test('refreshAccessToken()', async () => {
      const { email, password } = mockUserCredentials()

      const { error: initialError, session } = await authClientWithSession.signUp({
        email,
        password,
      })

      expect(initialError).toBeNull()

      const { error, data } = await serviceRoleApiClient.refreshAccessToken(
        session?.refresh_token || ''
      )

      const user = data?.user

      expect(error).toBeNull()
      expect(user).not.toBeNull()
      expect(user?.email).toEqual(email)
    })
  })

  describe('User authentication', () => {
    describe('sendMagicLinkEmail()', () => {
      test('sendMagicLinkEmail() with invalid email', async () => {
        const redirectTo = 'http://localhost:9999/welcome'

        const { error, data } = await serviceRoleApiClient.sendMagicLinkEmail(
          'this-is-not-an-email',
          {
            redirectTo,
          }
        )

        expect(data).toBeNull()
        expect(error?.status).toEqual(422)
        expect(error?.message).toEqual('Unable to validate email address: invalid format')
      })

      test('sendMagicLinkEmail() with valid email', async () => {
        const { email } = mockUserCredentials()
        const redirectTo = 'http://localhost:9999/welcome'

        const { error, data } = await serviceRoleApiClient.sendMagicLinkEmail(email, {
          redirectTo,
        })

        expect(data).toBeTruthy()
        expect(error).toBeNull()
      })
    })

    describe('signOut()', () => {
      test('signOut() with an valid access token', async () => {
        const { email, password } = mockUserCredentials()

        const { error: initialError, session } = await authClientWithSession.signUp({
          email,
          password,
        })

        expect(initialError).toBeNull()
        expect(session).not.toBeNull()

        const { error } = await serviceRoleApiClient.signOut(session?.access_token || '')
        expect(error).toBeNull()
      })

      test('signOut() with an invalid access token', async () => {
        const { error } = await serviceRoleApiClient.signOut('this-is-a-bad-token')

        expect(error?.status).toEqual(401)
        expect(error?.message).toMatch(/^Invalid token/)
      })
    })
  })

  describe('Phone/One-Time-Password authentication', () => {
    describe('signUpWithPhone()', () => {
      test('signUpWithPhone() with an invalid phone number', async () => {
        const { error, data } = await serviceRoleApiClient.signUpWithPhone(
          '1-555-555-1212',
          'et-phone-home',
          {
            data: { mobile_provider: 'AT&T' },
          }
        )

        expect(data).toBeNull()
        expect(error?.status).toEqual(422)
        expect(error?.message).toEqual('Invalid phone number format')
      })

      test('signUpWithPhone() without SMS account details', async () => {
        const { error, data } = await serviceRoleApiClient.signUpWithPhone(
          '+15555551212',
          'et-phone-home',
          {
            data: { mobile_provider: 'AT&T' },
          }
        )

        expect(data).toBeNull()
        expect(error?.status).toEqual(400)
        expect(error?.message).toEqual('Error sending confirmation sms: Missing Twilio account SID')
      })
    })

    describe('signInWithPhone()', () => {
      test('signInWithPhone() without an account', async () => {
        const { error, data } = await serviceRoleApiClient.signInWithPhone(
          '1-555-555-1212',
          'et-phone-home'
        )

        expect(data).toBeNull()
        expect(error?.status).toEqual(400)
        expect(error?.message).toEqual('Invalid login credentials')
      })
    })

    describe('sendMobileOTP()', () => {
      test('sendMobileOTP() with an invalid phone number', async () => {
        const { error, data } = await serviceRoleApiClient.sendMobileOTP('1-555asdasda-555-1212')

        expect(data).toBeNull()
        expect(error?.status).toEqual(400)
        expect(error?.message).toMatch(/^Invalid format/)
      })

      test('sendMobileOTP() without SMS account details', async () => {
        const { error, data } = await serviceRoleApiClient.sendMobileOTP('+15555551212')

        expect(data).toBeNull()
        expect(error?.status).toEqual(400)
        expect(error?.message).toEqual('Error sending confirmation sms: Missing Twilio account SID')
      })
    })
  })
})
