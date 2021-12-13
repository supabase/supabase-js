// import { GoTrueApi } from '../src/index'
// import faker from 'faker'

// const DISABLED_GOTRUE_PORT = 9997

// const GOTRUE_URL_SIGNUPS_DISABLED = `http://localhost:${DISABLED_GOTRUE_PORT}`

// const authAdminApi = new GoTrueApi({
//   url: GOTRUE_URL_SIGNUPS_DISABLED,
//   headers: {
//     Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InN1cGFiYXNlX2FkbWluIiwiaWF0IjoxNTE2MjM5MDIyfQ.0sOtTSTfPv5oPZxsjvBO249FI4S4p0ymHoIZ6H6z9Y8`,
//   },
// })

// const email = faker.internet.email().toLowerCase()
// const password = faker.internet.password()

// test('createUser() should create a new user, even if signups are disabled', async () => {
//   const { error } = await authAdminApi.createUser({
//     email,
//     password,
//     data: {},
//   })
//   expect(error).toBeNull()

//   const { error: listError, data: users } = await authAdminApi.listUsers()
//   expect(listError).toBeNull()
//   expect(users?.length).toBeGreaterThan(0)

//   const emails =
//     users?.map((user) => {
//       return user.email
//     }) || []

//   expect(emails.length).toBeGreaterThan(0)
//   expect(emails).toContain(email)
// })
