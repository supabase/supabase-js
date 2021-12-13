// import faker from 'faker'

// import {
//   authAdminApiAutoConfirmDisabledClient as api,
//   GOTRUE_URL_AUTO_CONFIRM_DISABLED,
// } from './clients'
// // import { createNewUserWithEmail } from './helpers'

// const email = `api_ac_disabled_${faker.internet.email().toLowerCase()}`
// const password = faker.internet.password()

// test('signUpWithEmail()', async () => {
//   const { error, data } = await api.signUpWithEmail(email, password, {
//     redirectTo: GOTRUE_URL_AUTO_CONFIRM_DISABLED,
//     data: { status: 'alpha' },
//   })
//   expect(error).toBeNull()
//   expect(data).toMatchObject({
//     aud: expect.any(String),
//     confirmation_sent_at: expect.any(String),
//     created_at: expect.any(String),
//     email: expect.any(String),
//     id: expect.any(String),
//     phone: '',
//     role: '',
//     updated_at: expect.any(String),
//     app_metadata: {
//       provider: 'email',
//     },
//     user_metadata: {
//       status: 'alpha',
//     },
//   })
// })

// const email2 = `api_generate_link_signup_${faker.internet.email().toLowerCase()}`
// const password2 = faker.internet.password()

// test('signUpWithGenerateConfirmationLink()', async () => {
//   const { error, data } = await api.generateLink('signup', email2, {
//     password: password2,
//     data: { status: 'alpha' },
//     redirectTo: 'http://localhost:9999/welcome',
//   })
//   expect(error).toBeNull()
//   expect(data).toMatchObject({
//     action_link: expect.any(String),
//     id: expect.any(String),
//     confirmation_sent_at: expect.any(String),
//     email: expect.any(String),
//     created_at: expect.any(String),
//     phone: expect.any(String),
//     aud: expect.any(String),
//     updated_at: expect.any(String),
//     app_metadata: {
//       provider: 'email',
//     },
//     user_metadata: {
//       status: 'alpha',
//     },
//   })
// })

// const email3 = `api_generate_link_signup_${faker.internet.email().toLowerCase()}`

// test('generateMagicLink()', async () => {
//   const { error, data } = await api.generateLink('magiclink', email3, {
//     redirectTo: 'http://localhost:9999/welcome',
//   })
//   expect(error).toBeNull()
//   expect(data).toMatchObject({
//     action_link: expect.any(String),
//     id: expect.any(String),
//     confirmation_sent_at: expect.any(String),
//     email: expect.any(String),
//     phone: expect.any(String),
//     created_at: expect.any(String),
//     aud: expect.any(String),
//     updated_at: expect.any(String),
//     app_metadata: {
//       provider: 'email',
//     },
//   })
// })

// test('generateInviteLink()', async () => {
//   const { error, data } = await api.generateLink('invite', email3, {
//     redirectTo: 'http://localhost:9999/welcome',
//   })
//   expect(error).toBeNull()
//   expect(data).toMatchObject({
//     action_link: expect.any(String),
//     id: expect.any(String),
//     confirmation_sent_at: expect.any(String),
//     email: expect.any(String),
//     phone: expect.any(String),
//     created_at: expect.any(String),
//     aud: expect.any(String),
//     updated_at: expect.any(String),
//     app_metadata: {
//       provider: 'email',
//     },
//   })
// })

// test('generateRecoveryLink()', async () => {
//   const { error, data } = await api.generateLink('recovery', email, {
//     redirectTo: 'http://localhost:9999/welcome',
//   })
//   expect(error).toBeNull()
//   expect(data).toMatchObject({
//     action_link: expect.anything(),
//     app_metadata: {
//       provider: 'email',
//     },
//     aud: '',
//     confirmation_sent_at: expect.any(String),
//     created_at: expect.any(String),
//     email: expect.any(String),
//     id: expect.any(String),
//     phone: '',
//     recovery_sent_at: expect.any(String),
//     updated_at: expect.any(String),
//     user_metadata: expect.any(Object),
//   })
// })
