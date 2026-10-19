import GoTrueAdminApi from '../src/GoTrueAdminApi'
import { AuthApiError, AuthRetryableFetchError } from '../src/lib/errors'

const AUTH_URL = 'https://auth.example.test'
const USER_ID = '715ed5db-f090-4b8c-a067-640ecee36aa0'

describe('GoTrueAdminApi.deleteUser response', () => {
  test.each([false, true])('returns no user data when shouldSoftDelete is %s', async (softDelete) => {
    const fetcher = jest.fn(async () => new Response('{}', { status: 200 }))
    const admin = new GoTrueAdminApi({ url: AUTH_URL, headers: {}, fetch: fetcher })

    const result = await admin.deleteUser(USER_ID, softDelete)

    expect(result).toEqual({ data: null, error: null })
    expect(fetcher).toHaveBeenCalledWith(
      `${AUTH_URL}/admin/users/${USER_ID}`,
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ should_soft_delete: softDelete }),
      })
    )
  })

  test('defaults to hard deletion', async () => {
    const fetcher = jest.fn(async () => new Response('{}', { status: 200 }))
    const admin = new GoTrueAdminApi({ url: AUTH_URL, headers: {}, fetch: fetcher })

    const result = await admin.deleteUser(USER_ID)
    const data: null = result.data

    expect(data).toBeNull()
    expect(result.error).toBeNull()
    expect(fetcher).toHaveBeenCalledWith(
      `${AUTH_URL}/admin/users/${USER_ID}`,
      expect.objectContaining({ body: JSON.stringify({ should_soft_delete: false }) })
    )
  })

  test('returns no user data alongside an API error', async () => {
    const fetcher = jest.fn(async () =>
      Response.json(
        { code: 'user_not_found', message: 'User not found' },
        { status: 404, headers: { 'x-supabase-api-version': '2024-01-01' } }
      )
    )
    const admin = new GoTrueAdminApi({ url: AUTH_URL, headers: {}, fetch: fetcher })

    const { data, error } = await admin.deleteUser(USER_ID)

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthApiError)
    expect(error).toMatchObject({ status: 404, code: 'user_not_found', message: 'User not found' })
  })

  test('returns no user data when the request fails', async () => {
    const fetcher = jest.fn(async () => {
      throw new Error('Network unavailable')
    })
    const admin = new GoTrueAdminApi({ url: AUTH_URL, headers: {}, fetch: fetcher })

    const { data, error } = await admin.deleteUser(USER_ID)

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthRetryableFetchError)
    expect(error?.message).toBe('Network unavailable')
  })

  test('rejects an invalid user id before making a request', async () => {
    const fetcher = jest.fn(async () => new Response('{}', { status: 200 }))
    const admin = new GoTrueAdminApi({ url: AUTH_URL, headers: {}, fetch: fetcher })

    await expect(admin.deleteUser('invalid-id')).rejects.toThrow(
      '@supabase/auth-js: Expected parameter to be UUID but is not'
    )

    expect(fetcher).not.toHaveBeenCalled()
  })
})
