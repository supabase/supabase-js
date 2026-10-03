import GoTrueAdminApi from '../src/GoTrueAdminApi'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const FACTOR_ID = '22222222-2222-4222-8222-222222222222'

describe('GoTrueAdminApi mfa.deleteFactor()', () => {
  test('returns the deleted factor id as data.id', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: FACTOR_ID }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const admin = new GoTrueAdminApi({ url: 'http://localhost:9999', fetch: mockFetch })

    const { data, error } = await admin.mfa.deleteFactor({ userId: USER_ID, id: FACTOR_ID })

    expect(error).toBeNull()
    expect(data).toEqual({ id: FACTOR_ID })
    expect(mockFetch.mock.calls[0][0]).toBe(
      `http://localhost:9999/admin/users/${USER_ID}/factors/${FACTOR_ID}`
    )
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE')
  })

  test('returns the error when the request fails', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'user_not_found', message: 'User not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    )
    const admin = new GoTrueAdminApi({ url: 'http://localhost:9999', fetch: mockFetch })

    const { data, error } = await admin.mfa.deleteFactor({ userId: USER_ID, id: FACTOR_ID })

    expect(data).toBeNull()
    expect(error?.status).toBe(404)
  })
})
