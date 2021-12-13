import faker from 'faker'

import { serviceRoleApiClient, authAdminApiAutoConfirmEnabledClient } from './lib/clients'
import { createNewUserWithEmail } from './lib/utils'

describe('GoTrueApi', () => {
  test('createUser() should create a new user', async () => {
    const email = faker.internet.email().toLowerCase()
    const { error, data: user } = await createNewUserWithEmail({ email })

    expect(error).toBeNull()
    expect(user?.email).toEqual(email)
  })

  test('listUsers() should return registered users', async () => {
    const email = faker.internet.email().toLowerCase()
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

  test('getUserById() should a registered user given its user identifier', async () => {
    const email = faker.internet.email().toLowerCase()
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

  test('updateUserById() should be able to modify email', async () => {
    const email = faker.internet.email().toLowerCase()
    const { error: createError, data: user } = await createNewUserWithEmail({ email })

    expect(createError).toBeNull()
    expect(user).not.toBeUndefined()

    const uid = user?.id || ''

    const attributes = { email: `new_${user.email}` }

    const { error: updatedError, data: updatedUser } = await serviceRoleApiClient.updateUserById(
      uid,
      attributes
    )

    expect(updatedError).toBeNull()
    expect(updatedError).not.toBeUndefined()
    expect(updatedUser?.email).toEqual(`new_${user.email}`)
  })

  test('updateUserById() should be able to modify user metadata', async () => {
    const email = faker.internet.email().toLowerCase()
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

  test('updateUserById() should be able to modify app metadata', async () => {
    const email = faker.internet.email().toLowerCase()
    const { error: createError, data: user } = await createNewUserWithEmail({ email })

    // ?
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

  test('deleteUser() should be able delete an existing user', async () => {
    const email = faker.internet.email().toLowerCase()
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
