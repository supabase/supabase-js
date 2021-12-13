// import faker from 'faker'

// import { User } from '../src/index'
// import {
//   clientApiAutoConfirmDisabledClient as authClient,
//   authAdminApiAutoConfirmDisabledClient as authAdminApi,
//   GOTRUE_URL_AUTO_CONFIRM_DISABLED,
// } from './clients'

// const email = faker.internet.email().toLowerCase()
// const password = faker.internet.password()

// test('signUp()', async () => {
//   const { error, session, user } = await authClient.signUp({
//     email,
//     password,
//   })
//   expect(error?.message).toBe('Signups not allowed for this instance')
//   expect(session).toBeNull()
//   expect(user).toBeNull()
// })

// test('generateLink() should be able to generate multiple links', async () => {
//   const invitedUser = faker.internet.email().toLowerCase()
//   const { error, data: firstInvite } = await authAdminApi.generateLink('invite', invitedUser, {
//     redirectTo: GOTRUE_URL_AUTO_CONFIRM_DISABLED,
//   })
//   expect(error).toBeNull()
//   expect(firstInvite).toMatchSnapshot({
//     id: expect.any(String),
//     action_link: expect.stringContaining(`${GOTRUE_URL_AUTO_CONFIRM_DISABLED}/?token=`),
//     confirmation_sent_at: expect.any(String),
//     email: expect.any(String),
//     phone: expect.any(String),
//     created_at: expect.any(String),
//     aud: expect.any(String),
//     updated_at: expect.any(String),
//     invited_at: expect.any(String),
//     app_metadata: {
//       provider: 'email',
//     },
//   })

//   const user = firstInvite as User

//   const { data: secondInvite } = await authAdminApi.generateLink('invite', invitedUser)

//   const userAgain = secondInvite as User
//   expect(userAgain.id).toMatch(user.id)
//   expect(userAgain).toMatchSnapshot({
//     id: expect.any(String),
//     action_link: expect.stringContaining(`${GOTRUE_URL_AUTO_CONFIRM_DISABLED}/?token=`),
//     confirmation_sent_at: expect.any(String),
//     email: expect.any(String),
//     phone: expect.any(String),
//     created_at: expect.any(String),
//     aud: expect.any(String),
//     updated_at: expect.any(String),
//     invited_at: expect.any(String),
//   })
// })
