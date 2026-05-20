import GoTrueAdminApi from '../src/GoTrueAdminApi'
import { AuthError } from '../src/lib/errors'

const URL = 'https://project.supabase.co/auth/v1'

const jsonResponse = () =>
  new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('GoTrueAdminApi admin path validation', () => {
  it.each([
    [
      'oauth.getClient',
      (api: GoTrueAdminApi) => api.oauth.getClient('../../custom-providers/google'),
      `${URL}/admin/oauth/clients/..%2F..%2Fcustom-providers%2Fgoogle`,
    ],
    [
      'oauth.updateClient',
      (api: GoTrueAdminApi) => api.oauth.updateClient('../../custom-providers/google', {} as any),
      `${URL}/admin/oauth/clients/..%2F..%2Fcustom-providers%2Fgoogle`,
    ],
    [
      'oauth.deleteClient',
      (api: GoTrueAdminApi) => api.oauth.deleteClient('../../custom-providers/google'),
      `${URL}/admin/oauth/clients/..%2F..%2Fcustom-providers%2Fgoogle`,
    ],
    [
      'oauth.regenerateClientSecret',
      (api: GoTrueAdminApi) => api.oauth.regenerateClientSecret('../../custom-providers/google'),
      `${URL}/admin/oauth/clients/..%2F..%2Fcustom-providers%2Fgoogle/regenerate_secret`,
    ],
    [
      'customProviders.getProvider',
      (api: GoTrueAdminApi) => api.customProviders.getProvider('../../oauth/clients/client-id'),
      `${URL}/admin/custom-providers/..%2F..%2Foauth%2Fclients%2Fclient-id`,
    ],
    [
      'customProviders.updateProvider',
      (api: GoTrueAdminApi) =>
        api.customProviders.updateProvider('../../oauth/clients/client-id', {} as any),
      `${URL}/admin/custom-providers/..%2F..%2Foauth%2Fclients%2Fclient-id`,
    ],
    [
      'customProviders.deleteProvider',
      (api: GoTrueAdminApi) => api.customProviders.deleteProvider('../../oauth/clients/client-id'),
      `${URL}/admin/custom-providers/..%2F..%2Foauth%2Fclients%2Fclient-id`,
    ],
  ])('encodes path separators in %s identifiers before fetch', async (_name, run, expectedUrl) => {
    const observed: string[] = []
    const fakeFetch = jest.fn(async (input: RequestInfo | URL) => {
      observed.push(new Request(String(input)).url)
      return jsonResponse()
    })
    const api = new GoTrueAdminApi({
      url: URL,
      headers: { Authorization: 'Bearer service-role' },
      fetch: fakeFetch as any,
    })

    await run(api)

    expect(observed).toEqual([expectedUrl])
  })

  it.each([
    ['oauth.getClient', (api: GoTrueAdminApi) => api.oauth.getClient('..')],
    ['customProviders.getProvider', (api: GoTrueAdminApi) => api.customProviders.getProvider('..')],
  ])('rejects raw dot segment identifiers in %s before fetch', async (_name, run) => {
    const fakeFetch = jest.fn(async () => jsonResponse())
    const api = new GoTrueAdminApi({
      url: URL,
      headers: { Authorization: 'Bearer service-role' },
      fetch: fakeFetch as any,
    })

    const { error } = await run(api)

    expect(error).toBeInstanceOf(AuthError)
    expect(error?.message).toBe('Invalid path segment')
    expect(fakeFetch).not.toHaveBeenCalled()
  })
})
