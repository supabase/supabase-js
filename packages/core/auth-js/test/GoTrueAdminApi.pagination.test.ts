import { MockServer } from 'jest-mock-server'
import GoTrueAdminApi from '../src/GoTrueAdminApi'

describe('GoTrueAdminApi listUsers() pagination', () => {
  const server = new MockServer()

  beforeAll(async () => await server.start())
  afterAll(async () => await server.stop())
  beforeEach(() => server.reset())

  test('parses multi-digit page numbers from the Link header', async () => {
    const base = server.getURL().toString().replace(/\/$/, '')

    server.get('/admin/users').mockImplementation((ctx) => {
      ctx.set(
        'Link',
        `<${base}/admin/users?page=10&per_page=50>; rel="next", ` +
          `<${base}/admin/users?page=23&per_page=50>; rel="last"`
      )
      ctx.set('x-total-count', '1150')
      ctx.status = 200
      ctx.body = { users: [], aud: 'authenticated' }
    })

    const admin = new GoTrueAdminApi({ url: base, headers: {} })
    const { data, error } = await admin.listUsers({ page: 9, perPage: 50 })

    expect(error).toBeNull()
    // Regression: the old `.substring(0, 1)` parse truncated these to 1 and 2.
    expect(data).toMatchObject({ nextPage: 10, lastPage: 23, total: 1150 })
  })
})
