import { GoTrueApi, Session } from '../src/index'
import faker from 'faker'

const GOTRUE_URL = 'http://localhost:9998'

const api = new GoTrueApi({
  url: GOTRUE_URL,
  headers: {
    Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InN1cGFiYXNlX2FkbWluIiwiaWF0IjoxNTE2MjM5MDIyfQ.0sOtTSTfPv5oPZxsjvBO249FI4S4p0ymHoIZ6H6z9Y8`,
  },
})

const email = `api_ac_enabled_${faker.internet.email().toLowerCase()}`
const password = faker.internet.password()
let validSession: Session | null = null

test('signUpWithEmail()', async () => {
  const { error, data } = await api.signUpWithEmail(email, password, {
    data: { status: 'alpha' },
  })
  validSession = data as Session
  expect(error).toBeNull()
  expect(data).toMatchInlineSnapshot(
    {
      access_token: expect.any(String),
      expires_at: expect.any(Number),
      refresh_token: expect.any(String),
      user: {
        id: expect.any(String),
        created_at: expect.any(String),
        email: expect.any(String),
        updated_at: expect.any(String),
        last_sign_in_at: expect.any(String),
        email_confirmed_at: expect.any(String),
      },
    },
    `
    Object {
      "access_token": Any<String>,
      "expires_at": Any<Number>,
      "expires_in": 3600,
      "refresh_token": Any<String>,
      "token_type": "bearer",
      "user": Object {
        "app_metadata": Object {
          "provider": "email",
          "providers": Array [
            "email",
          ],
        },
        "aud": "",
        "created_at": Any<String>,
        "email": Any<String>,
        "email_confirmed_at": Any<String>,
        "id": Any<String>,
        "identities": Array [],
        "last_sign_in_at": Any<String>,
        "phone": "",
        "role": "",
        "updated_at": Any<String>,
        "user_metadata": Object {
          "status": "alpha",
        },
      },
    }
  `
  )
})

test('getUser()', async () => {
  const { error, data } = await api.getUser(validSession?.access_token || '')
  expect(error).toBeNull()

  expect(data).toMatchInlineSnapshot(
    {
      id: expect.any(String),
      created_at: expect.any(String),
      email: expect.any(String),
      updated_at: expect.any(String),
      last_sign_in_at: expect.any(String),
      email_confirmed_at: expect.any(String),
      confirmed_at: expect.any(String),
    },
    `
    Object {
      "app_metadata": Object {
        "provider": "email",
        "providers": Array [
          "email",
        ],
      },
      "aud": "",
      "confirmed_at": Any<String>,
      "created_at": Any<String>,
      "email": Any<String>,
      "email_confirmed_at": Any<String>,
      "id": Any<String>,
      "identities": Array [],
      "last_sign_in_at": Any<String>,
      "phone": "",
      "role": "",
      "updated_at": Any<String>,
      "user_metadata": Object {
        "status": "alpha",
      },
    }
  `
  )
})
