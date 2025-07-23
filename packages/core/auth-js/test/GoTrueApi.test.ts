import {
  authClientWithSession,
  clientApiAutoConfirmOffSignupsEnabledClient,
  serviceRoleApiClient,
  clientApiAutoConfirmDisabledClient,
} from './lib/clients'

import {
  createNewUserWithEmail,
  mockUserCredentials,
  mockAppMetadata,
  mockUserMetadata,
  mockVerificationOTP,
} from './lib/utils'

import type { GenerateLinkProperties, User } from '../src/lib/types'

const INVALID_EMAIL = 'xx:;x@x.x'
const NON_EXISTANT_USER_ID = '83fd9e20-7a80-46e4-bf29-a86e3d6bbf66'

describe('GoTrueAdminApi', () => {
  describe('User creation', () => {
    test('createUser() should create a new user', async () => {
      const { email } = mockUserCredentials()
      const { error, data } = await createNewUserWithEmail({ email })

      expect(error).toBeNull()
      expect(data.user?.email).toEqual(email)
    })

    test('createUser() with user metadata', async () => {
      const user_metadata = mockUserMetadata()
      const { email, password } = mockUserCredentials()

      const { error, data } = await serviceRoleApiClient.createUser({
        email,
        password,
        user_metadata,
      })

      expect(error).toBeNull()
      expect(data.user?.email).toEqual(email)
      expect(data.user?.user_metadata).toEqual(user_metadata)
      expect(data.user?.user_metadata).toHaveProperty('profile_image')
      expect(data.user?.user_metadata?.profile_image).toMatch(/https.*avatars.*(jpg|png)/)
    })

    test('createUser() with app metadata', async () => {
      const app_metadata = mockAppMetadata()
      const { email, password } = mockUserCredentials()

      const { error, data } = await serviceRoleApiClient.createUser({
        email,
        password,
        app_metadata,
      })

      expect(error).toBeNull()
      expect(data.user?.email).toEqual(email)
      expect(data.user?.app_metadata).toHaveProperty('provider')
      expect(data.user?.app_metadata).toHaveProperty('providers')
    })

    test('createUser() with user and app metadata', async () => {
      const user_metadata = mockUserMetadata()
      const app_metadata = mockAppMetadata()

      const { email, password } = mockUserCredentials()

      const { error, data } = await serviceRoleApiClient.createUser({
        email,
        password,
        app_metadata,
        user_metadata,
      })

      expect(error).toBeNull()
      expect(data.user?.email).toEqual(email)
      expect(data.user?.user_metadata).toHaveProperty('profile_image')
      expect(data.user?.user_metadata?.profile_image).toMatch(/https.*avatars.*(jpg|png)/)
      expect(data.user?.app_metadata).toHaveProperty('provider')
      expect(data.user?.app_metadata).toHaveProperty('providers')
    })

    test('createUser() returns AuthError when email is invalid', async () => {
      const { error, data } = await serviceRoleApiClient.createUser({
        email: INVALID_EMAIL,
        password: 'password123',
      })

      expect(error).not.toBeNull()
      expect(error?.message).toMatch('Unable to validate email address: invalid format')
      expect(data.user).toBeNull()
    })
  })

  describe('List users', () => {
    test('listUsers() should return registered users', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: createdUser } = await createNewUserWithEmail({ email })
      expect(createError).toBeNull()
      expect(createdUser.user).not.toBeUndefined()

      const { error: listUserError, data: userList } = await serviceRoleApiClient.listUsers()
      expect(listUserError).toBeNull()
      expect(userList).toHaveProperty('users')
      expect(userList).toHaveProperty('aud')
      const emails =
        userList.users?.map((user: User) => {
          return user.email
        }) || []

      expect(emails.length).toBeGreaterThan(0)
      expect(emails).toContain(email)
    })

    test('listUsers() returns AuthError when page is invalid', async () => {
      const { error, data } = await serviceRoleApiClient.listUsers({
        page: -1,
        perPage: 10,
      })

      expect(error).not.toBeNull()
      expect(data.users).toEqual([])
    })
  })

  describe('Get user', () => {
    test('getUser() fetches a user by their access_token', async () => {
      const { email, password } = mockUserCredentials()
      const { error: initialError, data } = await authClientWithSession.signUp({
        email,
        password,
      })

      expect(initialError).toBeNull()
      expect(data.session).not.toBeNull()

      const {
        error,
        data: { user },
      } = await authClientWithSession.getUser()

      expect(error).toBeNull()
      expect(user).not.toBeUndefined()
      expect(user?.email).toEqual(email)
    })

    test('getUserById() should a registered user given its user identifier', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: createdUser } = await createNewUserWithEmail({ email })

      expect(createError).toBeNull()
      expect(createdUser.user).not.toBeUndefined()

      const uid = createdUser.user?.id || ''
      expect(uid).toBeTruthy()

      const { error: foundError, data: foundUser } = await serviceRoleApiClient.getUserById(uid)

      expect(foundError).toBeNull()
      expect(foundUser).not.toBeUndefined()
      expect(foundUser.user?.email).toEqual(email)
    })

    test('getUserById() returns AuthError when user id is invalid', async () => {
      const { error, data } = await serviceRoleApiClient.getUserById(NON_EXISTANT_USER_ID)

      expect(error).not.toBeNull()
      expect(data.user).toBeNull()
    })
  })

  describe('User updates', () => {
    test('modify email using updateUserById()', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: createdUser } = await createNewUserWithEmail({ email })

      expect(createError).toBeNull()
      expect(createdUser.user).not.toBeUndefined()

      const uid = createdUser.user?.id || ''

      const attributes = { email: `new_${createdUser.user?.email}` }

      const { error: updatedError, data: updatedUser } = await serviceRoleApiClient.updateUserById(
        uid,
        attributes
      )

      expect(updatedError).toBeNull()
      expect(updatedError).not.toBeUndefined()
      expect(updatedUser.user?.email).toEqual(`new_${createdUser.user?.email}`)
    })

    test('modify user metadata using updateUserById()', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: createdUser } = await createNewUserWithEmail({ email })

      expect(createError).toBeNull()
      expect(createdUser.user).not.toBeUndefined()

      const uid = createdUser.user?.id || ''

      const userMetaData = { favorite_color: 'yellow' }
      const attributes = { user_metadata: userMetaData }

      const { error: updatedError, data: updatedUser } = await serviceRoleApiClient.updateUserById(
        uid,
        attributes
      )

      expect(updatedError).toBeNull()
      expect(updatedError).not.toBeUndefined()
      expect(updatedUser.user?.email).toEqual(email)
      expect(updatedUser.user?.user_metadata).toEqual(userMetaData)
    })

    test('modify app metadata using updateUserById()', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: createdUser } = await createNewUserWithEmail({ email })

      expect(createError).toBeNull()
      expect(createdUser.user).not.toBeUndefined()

      const uid = createdUser.user?.id || ''
      const appMetadata = { roles: ['admin', 'publisher'] }
      const attributes = { app_metadata: appMetadata }
      const { error: updatedError, data: updatedUser } = await serviceRoleApiClient.updateUserById(
        uid,
        attributes
      )

      expect(updatedError).toBeNull()
      expect(updatedError).not.toBeUndefined()
      expect(updatedUser.user?.email).toEqual(email)
      expect(updatedUser.user?.app_metadata).toHaveProperty('roles')
    })

    test('modify confirm email using updateUserById()', async () => {
      const { email, password } = mockUserCredentials()
      const { error: createError, data } = await clientApiAutoConfirmOffSignupsEnabledClient.signUp(
        {
          email,
          password,
        }
      )

      expect(createError).toBeNull()
      expect(data.user).not.toBeUndefined()
      expect(data.user).not.toHaveProperty('email_confirmed_at')
      expect(data.user?.email_confirmed_at).toBeFalsy()

      const uid = data.user?.id || ''

      const attributes = { email_confirm: true }
      const { error: updatedError, data: updatedUser } = await serviceRoleApiClient.updateUserById(
        uid,
        attributes
      )

      expect(updatedError).toBeNull()
      expect(updatedUser).not.toBeUndefined()
      expect(updatedUser.user).toHaveProperty('email_confirmed_at')
      expect(updatedUser.user?.email_confirmed_at).toBeTruthy()
    })
  })

  describe('User deletes', () => {
    test('deleteUser() should be able delete an existing user', async () => {
      const { email } = mockUserCredentials()
      const { error: createError, data: createdUser } = await createNewUserWithEmail({ email })

      expect(createError).toBeNull()
      expect(createdUser.user).not.toBeUndefined()

      const uid = createdUser.user?.id || ''

      const { error: deletedError, data: deletedUser } = await serviceRoleApiClient.deleteUser(uid)

      expect(deletedError).toBeNull()
      expect(deletedError).not.toBeUndefined()
      expect(deletedUser.user).not.toBeUndefined()

      const { error: listUserError, data } = await serviceRoleApiClient.listUsers()
      expect(listUserError).toBeNull()

      const emails =
        data.users?.map((user) => {
          return user.email
        }) || []

      expect(emails.length).toBeGreaterThan(0)
      expect(emails).not.toContain(email)
    })

    test('deleteUser() returns AuthError when user id is invalid', async () => {
      const { error, data } = await serviceRoleApiClient.deleteUser(NON_EXISTANT_USER_ID)

      expect(error).not.toBeNull()
      expect(data.user).toBeNull()
    })
  })

  describe('User registration', () => {
    test('generateLink supports signUp with generate confirmation signup link', async () => {
      const { email, password } = mockUserCredentials()

      const redirectTo = 'http://localhost:9999/welcome'
      const userMetadata = { status: 'alpha' }

      const { error, data } = await serviceRoleApiClient.generateLink({
        type: 'signup',
        email,
        password: password,
        options: {
          data: userMetadata,
          redirectTo,
        },
      })

      const properties = data.properties as GenerateLinkProperties
      const user = data.user as User

      expect(error).toBeNull()
      /** Check that the user object returned has the update metadata and an email */
      expect(user).not.toBeNull()
      expect(user).toHaveProperty('email')
      expect(user).toHaveProperty('user_metadata')
      expect(user?.['user_metadata']).toEqual(userMetadata)

      /** Check that properties returned contains the generateLink properties */
      expect(properties).not.toBeNull()
      expect(properties).toHaveProperty('action_link')
      expect(properties).toHaveProperty('email_otp')
      expect(properties).toHaveProperty('hashed_token')
      expect(properties).toHaveProperty('redirect_to')
      expect(properties).toHaveProperty('verification_type')

      /** Check if the action link returned is correctly formatted */
      expect(properties?.['action_link']).toMatch(/\?token/)
      expect(properties?.['action_link']).toMatch(/type=signup/)
      expect(properties?.['action_link']).toMatch(new RegExp(`redirect_to=${redirectTo}`))
    })

    test('generateLink supports updating emails with generate email change links', async () => {
      const { email } = mockUserCredentials()
      const { data: createdUser, error: createError } = await createNewUserWithEmail({
        email,
      })
      expect(createError).toBeNull()
      expect(createdUser).not.toBeNull()

      const { email: newEmail } = mockUserCredentials()
      const redirectTo = 'http://localhost:9999/welcome'

      const { data, error } = await serviceRoleApiClient.generateLink({
        type: 'email_change_current',
        email,
        newEmail,
        options: {
          redirectTo,
        },
      })
      const properties = data.properties as GenerateLinkProperties
      const user = data.user as User

      expect(error).toBeNull()
      /** Check that the user object returned has the update metadata and an email */
      expect(user).not.toBeNull()
      expect(user).toHaveProperty('email')
      expect(user).toHaveProperty('new_email')
      expect(user).toHaveProperty('user_metadata')
      expect(user?.new_email).toEqual(newEmail)

      /** Check that properties returned contains the generateLink properties */
      expect(properties).not.toBeNull()
      expect(properties).toHaveProperty('action_link')
      expect(properties).toHaveProperty('email_otp')
      expect(properties).toHaveProperty('hashed_token')
      expect(properties).toHaveProperty('redirect_to')
      expect(properties).toHaveProperty('verification_type')

      /** Check if the action link returned is correctly formatted */
      expect(properties?.['action_link']).toMatch(/\?token/)
      expect(properties?.['action_link']).toMatch(/type=email_change/)
      expect(properties?.['action_link']).toMatch(new RegExp(`redirect_to=${redirectTo}`))
    })

    test('inviteUserByEmail() creates a new user with an invited_at timestamp', async () => {
      const { email } = mockUserCredentials()

      const redirectTo = 'http://localhost:9999/welcome'
      const userMetadata = { status: 'alpha' }
      const { error, data } = await serviceRoleApiClient.inviteUserByEmail(email, {
        data: userMetadata,
        redirectTo,
      })

      expect(error).toBeNull()
      expect(data.user).not.toBeNull()
      expect(data.user).toHaveProperty('invited_at')
      expect(data.user?.invited_at).toBeDefined()
    })

    test('inviteUserByEmail() returns AuthError when email is invalid', async () => {
      const { error, data } = await serviceRoleApiClient.inviteUserByEmail(INVALID_EMAIL)

      expect(error).not.toBeNull()
      expect(error?.message).toMatch('Unable to validate email address: invalid format')
      expect(data.user).toBeNull()
    })

    test('generateLink() returns AuthError when email is invalid', async () => {
      const { error, data } = await serviceRoleApiClient.generateLink({
        type: 'signup',
        email: INVALID_EMAIL,
        password: 'password123',
      })

      expect(error).not.toBeNull()
      expect(error?.message).toMatch('Unable to validate email address: invalid format')
      expect(data.user).toBeNull()
      expect(data.properties).toBeNull()
    })
  })

  describe('User authentication', () => {
    describe('signOut()', () => {
      test('signOut() with an valid access token', async () => {
        const { email, password } = mockUserCredentials()

        const { error: initialError, data } = await authClientWithSession.signUp({
          email,
          password,
        })

        expect(initialError).toBeNull()
        expect(data.session).not.toBeNull()

        const { error } = await serviceRoleApiClient.signOut(data.session?.access_token || '')
        expect(error).toBeNull()
      })

      test('signOut() with an invalid access token', async () => {
        const { error } = await serviceRoleApiClient.signOut('this-is-a-bad-token')

        expect(error?.message).toMatch(/^invalid JWT/)
      })

      test('signOut() fails with invalid scope', async () => {
        const { email, password } = mockUserCredentials()

        const { error: signUpError } = await authClientWithSession.signUp({
          email,
          password,
        })
        expect(signUpError).toBeNull()

        const {
          data: { session },
          error,
        } = await authClientWithSession.signInWithPassword({
          email,
          password,
        })
        expect(error).toBeNull()
        expect(session).not.toBeNull()

        await expect(
          authClientWithSession.signOut({ scope: 'invalid_scope' as any })
        ).rejects.toThrow('@supabase/auth-js: Parameter scope must be one of global, local, others')
      })
    })
  })

  describe('Email/Phone Otp Verification', () => {
    describe('GoTrueClient verifyOtp()', () => {
      test('verifyOtp() with non-existent phone number', async () => {
        const { phone } = mockUserCredentials()
        const otp = mockVerificationOTP()
        const {
          data: { user },
          error,
        } = await clientApiAutoConfirmDisabledClient.verifyOtp({
          phone: `${phone}`,
          token: otp,
          type: 'sms',
        })

        expect(user).toBeNull()
        expect(error?.message).toEqual('Token has expired or is invalid')
        expect(error?.status).toEqual(403)
      })

      test('verifyOTP() with invalid phone number', async () => {
        const { phone } = mockUserCredentials()
        const otp = mockVerificationOTP()
        const {
          data: { user },
          error,
        } = await clientApiAutoConfirmDisabledClient.verifyOtp({
          phone: `${phone}-invalid`,
          token: otp,
          type: 'sms',
        })

        expect(user).toBeNull()
        expect(error?.message).toEqual('Invalid phone number format (E.164 required)')
      })
    })
  })

  describe('Update User', () => {
    test('updateUserById() returns AuthError when user id is invalid', async () => {
      const { error, data } = await serviceRoleApiClient.updateUserById(NON_EXISTANT_USER_ID, {
        email: 'new@email.com',
      })

      expect(error).not.toBeNull()
      expect(data.user).toBeNull()
    })
  })

  describe('MFA Admin', () => {
    test('mfa factor management: add, list and delete', async () => {
      const { email, password } = mockUserCredentials()

      const { error: signUpError, data: signUpData } = await authClientWithSession.signUp({
        email,
        password,
      })
      expect(signUpError).toBeNull()
      expect(signUpData.session).not.toBeNull()

      const uid = signUpData.user?.id || ''
      expect(uid).toBeTruthy()

      const { error: enrollError } = await authClientWithSession.mfa.enroll({
        factorType: 'totp',
      })
      expect(enrollError).toBeNull()

      const { data, error } = await serviceRoleApiClient.mfa.listFactors({ userId: uid })

      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(Array.isArray(data?.factors)).toBe(true)
      expect(data?.factors.length).toBeGreaterThan(0)

      const factorId = data?.factors[0].id
      expect(factorId).toBeDefined()
      const { data: deletedData, error: deletedError } =
        await serviceRoleApiClient.mfa.deleteFactor({
          userId: uid,
          id: factorId!,
        })
      expect(deletedError).toBeNull()
      expect(deletedData).not.toBeNull()
      const deletedId = (deletedData as any)?.data?.id
      console.log('deletedId:', deletedId)
      expect(deletedId).toEqual(factorId)

      const { data: latestData, error: latestError } = await serviceRoleApiClient.mfa.listFactors({
        userId: uid,
      })
      expect(latestError).toBeNull()
      expect(latestData).not.toBeNull()
      expect(Array.isArray(latestData?.factors)).toBe(true)
      expect(latestData?.factors.length).toEqual(0)
    })

    test('mfa.listFactors returns AuthError for invalid user', async () => {
      const { data, error } = await serviceRoleApiClient.mfa.listFactors({
        userId: NON_EXISTANT_USER_ID,
      })
      expect(data).toBeNull()
      expect(error).not.toBeNull()
    })

    test('mfa.deleteFactors returns AuthError for invalid user', async () => {
      const { data, error } = await serviceRoleApiClient.mfa.deleteFactor({
        userId: NON_EXISTANT_USER_ID,
        id: NON_EXISTANT_USER_ID,
      })
      expect(data).toBeNull()
      expect(error).not.toBeNull()
    })
  })
})
