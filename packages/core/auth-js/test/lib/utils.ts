import faker from 'faker'
import jwt from 'jsonwebtoken'

import { serviceRoleApiClient } from './clients'

import { GOTRUE_JWT_SECRET } from './clients'

export const mockAccessToken = () => {
  return jwt.sign(
    {
      sub: '1234567890',
      role: 'anon_key',
    },
    GOTRUE_JWT_SECRET
  )
}

type Credentials = {
  email?: string | undefined
  password?: string | undefined
}

export const mockUserCredentials = (options?: Credentials): { email: string; password: string } => {
  return {
    email: options?.email || faker.internet.email().toLowerCase(),
    password: options?.password || faker.internet.password(),
  }
}

export const createNewUserWithEmail = async ({
  email,
  password,
}: {
  email: string | undefined
  password?: string | undefined
}) => {
  const { email: newEmail, password: newPassword } = mockUserCredentials({
    email,
    password,
  })
  return await serviceRoleApiClient.createUser({
    email: newEmail,
    password: newPassword,
    data: {},
  })
}
