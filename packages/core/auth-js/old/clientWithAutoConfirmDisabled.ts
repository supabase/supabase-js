// import { clientApiAutoConfirmDisabledClient as api } from './clients'
// import faker from 'faker'

// const email = faker.internet.email().toLowerCase()
// const password = faker.internet.password()

// const testTwilio = false
// const phone = faker.phone.phoneNumber() // set test number here

// test('signUp() with email and password', async () => {
//   const { error, user, session } = await api.signUp(
//     {
//       email,
//       password,
//     },
//     { data: { status: 'alpha' } }
//   )
//   expect(error).toBeNull()
//   expect(session).toBeNull()
//   expect(user).toMatchObject({
//     id: expect.any(String),
//     created_at: expect.any(String),
//     email: expect.any(String),
//     confirmation_sent_at: expect.any(String),
//     phone: '',
//     aud: expect.any(String),
//     updated_at: expect.any(String),
//     app_metadata: {
//       provider: 'email',
//     },
//     user_metadata: {
//       status: 'alpha',
//     },
//   })
//   expect(user?.email_confirmed_at).toBeUndefined()
//   expect(user?.last_sign_in_at).toBeUndefined()
//   expect(user?.email).toBe(email)
// })

// test('signUp() the same user twice should throw an error', async () => {
//   const { error, user, session } = await api.signUp({
//     email,
//     password,
//   })
//   expect(error?.message).toContain('For security purposes, you can only request this after')
//   expect(session).toBeNull()
//   expect(user).toBeNull()
// })

// test('signIn()', async () => {
//   const { error, session, user } = await api.signIn({
//     email,
//     password,
//   })
//   expect(error?.message).toBe('Email not confirmed')
//   expect(session).toBeNull()
//   expect(user).toBeNull()
// })

// test('signIn() with the wrong password', async () => {
//   const InvalidLoginMessage = 'Invalid login credentials'

//   const { error, user } = await api.signIn({
//     email,
//     password: password + '2',
//   })
//   expect(error?.message).toBe(InvalidLoginMessage)
//   expect(user).toBeNull()
// })

// if (testTwilio) {
//   test('signUp() with phone and password', async () => {
//     const { error, user, session } = await api.signUp(
//       {
//         phone,
//         password,
//       },
//       {
//         data: { status: 'alpha' },
//       }
//     )
//     expect(error).toBeNull()
//     expect(session).toBeNull()
//     expect(user).toMatchObject({
//       id: expect.any(String),
//       created_at: expect.any(String),
//       email: '',
//       confirmation_sent_at: expect.any(String),
//       phone: phone,
//       aud: expect.any(String),
//       updated_at: expect.any(String),
//       app_metadata: {
//         provider: 'phone',
//       },
//       user_metadata: {
//         status: 'alpha',
//       },
//     })
//     expect(user?.phone_confirmed_at).toBeUndefined()
//     expect(user?.email_confirmed_at).toBeUndefined()
//     expect(user?.last_sign_in_at).toBeUndefined()
//     expect(user?.phone).toBe(phone)
//   })

//   test('verifyMobileOTP() errors on bad token', async () => {
//     const token = '123456'

//     const { error, user, session } = await api.verifyOTP({ phone, token })
//     expect(error?.message).toContain('Otp has expired or is invalid')
//     expect(session).toBeNull()
//     expect(user).toBeNull()
//   })
// }
