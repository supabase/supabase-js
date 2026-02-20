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
  phone?: string | undefined
  password?: string | undefined
}

export const mockUserCredentials = (
  options?: Credentials
): { email: string; phone: string; password: string } => {
  const randNumbers = Date.now().toString()

  return {
    email: options?.email || faker.internet.email().toLowerCase(),
    phone: options?.phone || `1${randNumbers.substring(randNumbers.length - 12, 11)}`,
    password: options?.password || faker.internet.password(),
  }
}

export const mockVerificationOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export const mockUserMetadata = () => {
  return {
    profile_image: faker.image.avatar(),
  }
}

export const mockAppMetadata = () => {
  return {
    roles: ['editor', 'publisher'],
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
    user_metadata: {},
  })
}

export const mockOAuthClientParams = () => {
  return {
    client_name: `Test OAuth Client ${faker.random.alphaNumeric(8)}`,
    redirect_uris: [
      `https://${faker.internet.domainName()}/callback`,
      `https://example.com/callback/${faker.random.alphaNumeric(8)}`,
    ],
    grant_types: ['authorization_code' as const, 'refresh_token' as const],
    response_types: ['code' as const],
  }
}

export const mockOAuthUpdateParams = () => {
  return {
    client_name: `Updated OAuth Client ${faker.random.alphaNumeric(8)}`,
    logo_uri: faker.image.imageUrl(),
  }
}

export const createTestOAuthClient = async () => {
  const params = mockOAuthClientParams()
  return await serviceRoleApiClient.oauth.createClient(params)
}
