// import { Session } from '../src/index'
// import faker from 'faker'

// import { authAdminApiAutoConfirmEnabledClient as api } from './clients'

// const mockUserSignUp = ({ provider = '', userMetadata = {} }) => {
//   return {
//     access_token: expect.any(String),
//     expires_at: expect.any(Number),
//     expires_in: expect.any(Number),
//     refresh_token: expect.any(String),
//     token_type: 'bearer',
//     user: {
//       app_metadata: {
//         provider,
//         providers: [provider],
//       },
//       aud: '',
//       created_at: expect.any(String),
//       email: expect.any(String),
//       email_confirmed_at: expect.any(String),
//       id: expect.any(String),
//       identities: [
//         {
//           created_at: expect.any(String),
//           id: expect.any(String),
//           identity_data: {
//             sub: expect.any(String),
//           },
//           last_sign_in_at: expect.any(String),
//           provider,
//           updated_at: expect.any(String),
//           user_id: expect.any(String),
//         },
//       ],
//       last_sign_in_at: expect.any(String),
//       phone: '',
//       role: '',
//       updated_at: expect.any(String),
//       user_metadata: userMetadata,
//     },
//   }
// }

// const mockUser = ({ provider = '', userMetadata = {} }) => {
//   return {
//     id: expect.any(String),
//     aud: '',
//     role: '',
//     email: expect.any(String),
//     email_confirmed_at: expect.any(String),
//     phone: expect.any(String),
//     confirmed_at: expect.any(String),
//     last_sign_in_at: expect.any(String),
//     app_metadata: { provider, providers: [provider] },
//     user_metadata: userMetadata,
//     identities: [
//       {
//         id: expect.any(String),
//         user_id: expect.any(String),
//         identity_data: { sub: expect.any(String) },
//         provider,
//         last_sign_in_at: expect.any(String),
//         created_at: expect.any(String),
//         updated_at: expect.any(String),
//       },
//     ],
//     created_at: expect.any(String),
//     updated_at: expect.any(String),
//   }
// }

// test('signUpWithEmail()', async () => {
//   // sign up with email and sets user_metadata status attribute to 'alpha'
//   const email = `api_ac_enabled_${faker.internet.email().toLowerCase()}`
//   const password = faker.internet.password()

//   const userMetadata = { status: 'alpha' }
//   const { error, data } = await api.signUpWithEmail(email, password, {
//     data: userMetadata,
//   })

//   expect(error).toBeNull()
//   expect(data).toMatchSnapshot(
//     mockUserSignUp({
//       provider: 'email',
//       userMetadata,
//     })
//   )
// })

// test('getUser()', async () => {
//   const email = `api_ac_enabled_${faker.internet.email().toLowerCase()}`
//   const password = faker.internet.password()

//   const { error: signUpError, data: signUpData } = await api.signUpWithEmail(email, password)
//   expect(signUpError).toBeNull()
//   expect(signUpData).not.toBeUndefined()

//   const validSession = signUpData as Session
//   const { error, data } = await api.getUser(validSession?.access_token || '')
//   expect(error).toBeNull

//   expect(data).toMatchSnapshot(
//     mockUser({
//       provider: 'email',
//       userMetadata: {},
//     })
//   )
// })
