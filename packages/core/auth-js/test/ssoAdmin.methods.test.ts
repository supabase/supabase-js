import { GoTrueAdminApi } from '../src/index'
import { AuthApiError } from '../src/lib/errors'
import { SSOProvider } from '../src/lib/types'

// Fetch is always mocked in this file, so the URL is never resolved.
const TEST_URL = 'http://localhost:9999'
const TEST_PROVIDER_UUID = '7d8e5a1c-2f3b-4c6d-9e0a-1b2c3d4e5f60'
const TEST_METADATA_URL = 'https://idp.example.com/saml/metadata'

const TEST_PROVIDER: SSOProvider = {
  id: TEST_PROVIDER_UUID,
  resource_id: 'acme',
  disabled: null,
  saml: {
    entity_id: 'https://idp.example.com/saml',
    metadata_url: TEST_METADATA_URL,
    metadata_xml: '<md:EntityDescriptor />',
    attribute_mapping: {
      keys: {
        email: { name: 'mail' },
      },
    },
    name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  },
  domains: [{ domain: 'example.com' }],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  headers: new Headers({ 'x-supabase-api-version': '2024-01-01' }),
  json: () => Promise.resolve(body),
})

const apiErrorResponse = (message: string, status: number, code?: string) =>
  jsonResponse({ code, msg: message }, status)

const lastRequest = (mockFetch: jest.Mock) => {
  const [url, params] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  return { url, params, body: params.body ? JSON.parse(params.body) : undefined }
}

const createAdminClient = () => {
  const mockFetch = jest.fn()
  const admin = new GoTrueAdminApi({
    url: TEST_URL,
    headers: { Authorization: 'Bearer secret-key-token' },
    fetch: mockFetch as unknown as typeof fetch,
  })
  return { admin, mockFetch }
}

describe('admin.sso', () => {
  describe('listProviders', () => {
    it('fetches all providers and returns them as providers', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(jsonResponse({ items: [TEST_PROVIDER] }))

      const { data, error } = await admin.sso.listProviders()

      expect(error).toBeNull()
      expect(data).toEqual({ providers: [TEST_PROVIDER] })
      const { url, params } = lastRequest(mockFetch)
      expect(url).toEqual(`${TEST_URL}/admin/sso/providers`)
      expect(params.method).toEqual('GET')
      expect(params.headers).toMatchObject({ Authorization: 'Bearer secret-key-token' })
    })

    it('sends the resource ID filters as query parameters', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(jsonResponse({ items: [] }))

      await admin.sso.listProviders({ resourceId: 'acme' })
      expect(lastRequest(mockFetch).url).toEqual(`${TEST_URL}/admin/sso/providers?resource_id=acme`)

      mockFetch.mockResolvedValueOnce(jsonResponse({ items: [] }))

      await admin.sso.listProviders({ resourceIdPrefix: 'tenant-' })
      expect(lastRequest(mockFetch).url).toEqual(
        `${TEST_URL}/admin/sso/providers?resource_id_prefix=tenant-`
      )
    })

    it('returns an empty list when the server returns no items', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(jsonResponse({ items: null }))

      const { data, error } = await admin.sso.listProviders()

      expect(error).toBeNull()
      expect(data).toEqual({ providers: [] })
    })

    it('returns the API error with an empty list', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(
        apiErrorResponse('SAML 2.0 is disabled', 404, 'saml_provider_disabled')
      )

      const { data, error } = await admin.sso.listProviders()

      expect(data).toEqual({ providers: [] })
      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).code).toEqual('saml_provider_disabled')
    })
  })

  describe('createProvider', () => {
    it('posts the provider settings and returns the created provider', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(jsonResponse(TEST_PROVIDER, 201))

      const params = {
        type: 'saml' as const,
        metadata_url: TEST_METADATA_URL,
        domains: ['example.com'],
        attribute_mapping: { keys: { email: { name: 'mail' } } },
        name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress' as const,
        resource_id: 'acme',
      }
      const { data, error } = await admin.sso.createProvider(params)

      expect(error).toBeNull()
      expect(data).toEqual(TEST_PROVIDER)
      const { url, params: requestParams, body } = lastRequest(mockFetch)
      expect(url).toEqual(`${TEST_URL}/admin/sso/providers`)
      expect(requestParams.method).toEqual('POST')
      expect(body).toEqual(params)
    })

    it('returns the API error when the domain is already assigned', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(
        apiErrorResponse(
          "SSO Domain 'example.com' is already assigned to an SSO identity provider",
          400,
          'sso_domain_already_exists'
        )
      )

      const { data, error } = await admin.sso.createProvider({
        type: 'saml',
        metadata_url: TEST_METADATA_URL,
        domains: ['example.com'],
      })

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).code).toEqual('sso_domain_already_exists')
    })
  })

  describe('getProvider', () => {
    it('fetches the provider by its ID', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(jsonResponse(TEST_PROVIDER))

      const { data, error } = await admin.sso.getProvider(TEST_PROVIDER_UUID)

      expect(error).toBeNull()
      expect(data).toEqual(TEST_PROVIDER)
      const { url, params } = lastRequest(mockFetch)
      expect(url).toEqual(`${TEST_URL}/admin/sso/providers/${TEST_PROVIDER_UUID}`)
      expect(params.method).toEqual('GET')
    })

    it('fetches the provider by its prefixed resource ID', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(jsonResponse(TEST_PROVIDER))

      const { data, error } = await admin.sso.getProvider('resource_acme')

      expect(error).toBeNull()
      expect(data).toEqual(TEST_PROVIDER)
      expect(lastRequest(mockFetch).url).toEqual(`${TEST_URL}/admin/sso/providers/resource_acme`)
    })

    it('returns the API error when the provider does not exist', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(
        apiErrorResponse('SSO Identity Provider not found', 404, 'sso_provider_not_found')
      )

      const { data, error } = await admin.sso.getProvider(TEST_PROVIDER_UUID)

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).code).toEqual('sso_provider_not_found')
    })
  })

  describe('updateProvider', () => {
    it('puts the provider settings and returns the updated provider', async () => {
      const { admin, mockFetch } = createAdminClient()
      const updated = {
        ...TEST_PROVIDER,
        disabled: true,
        domains: [{ domain: 'example.com' }, { domain: 'example.org' }],
      }
      mockFetch.mockResolvedValueOnce(jsonResponse(updated))

      const params = { domains: ['example.com', 'example.org'], disabled: true }
      const { data, error } = await admin.sso.updateProvider('resource_acme', params)

      expect(error).toBeNull()
      expect(data).toEqual(updated)
      const { url, params: requestParams, body } = lastRequest(mockFetch)
      expect(url).toEqual(`${TEST_URL}/admin/sso/providers/resource_acme`)
      expect(requestParams.method).toEqual('PUT')
      expect(body).toEqual(params)
    })

    it('returns the API error when the metadata has a different entity ID', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(
        apiErrorResponse(
          'SAML Metadata can be updated only if the EntityID matches for the provider',
          400,
          'saml_entity_id_mismatch'
        )
      )

      const { data, error } = await admin.sso.updateProvider(TEST_PROVIDER_UUID, {
        metadata_xml: '<md:EntityDescriptor />',
      })

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).code).toEqual('saml_entity_id_mismatch')
    })
  })

  describe('deleteProvider', () => {
    it('deletes the provider and returns it', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(jsonResponse(TEST_PROVIDER))

      const { data, error } = await admin.sso.deleteProvider(TEST_PROVIDER_UUID)

      expect(error).toBeNull()
      expect(data).toEqual(TEST_PROVIDER)
      const { url, params } = lastRequest(mockFetch)
      expect(url).toEqual(`${TEST_URL}/admin/sso/providers/${TEST_PROVIDER_UUID}`)
      expect(params.method).toEqual('DELETE')
    })

    it('returns the API error when the provider does not exist', async () => {
      const { admin, mockFetch } = createAdminClient()
      mockFetch.mockResolvedValueOnce(
        apiErrorResponse('SSO Identity Provider not found', 404, 'sso_provider_not_found')
      )

      const { data, error } = await admin.sso.deleteProvider('resource_missing')

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).code).toEqual('sso_provider_not_found')
    })
  })
})
