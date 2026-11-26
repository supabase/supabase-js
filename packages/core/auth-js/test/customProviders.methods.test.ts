import { GoTrueAdminApi } from '../src/index'
import { AuthApiError } from '../src/lib/errors'
import type { CreateCustomProviderParams, CustomOAuthProvider } from '../src/lib/types'

// Fetch is always mocked in this file, so the URL is never resolved.
const TEST_URL = 'http://localhost:9999'
const PROVIDERS_URL = `${TEST_URL}/admin/custom-providers`
const TEST_HEADERS = { Authorization: 'Bearer test-service-role-key' }
const TEST_USER_UUID = '11111111-2222-3333-4444-555555555555'

const PROVIDER: CustomOAuthProvider = {
  id: '99999999-8888-7777-6666-555555555555',
  provider_type: 'oidc',
  identifier: 'custom:acme',
  name: 'Acme',
  client_id: 'acme-client',
  issuer: 'https://id.acme.test',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const CREATE_PARAMS: CreateCustomProviderParams = {
  provider_type: 'oidc',
  identifier: 'custom:acme',
  name: 'Acme',
  client_id: 'acme-client',
  client_secret: 'acme-secret',
  issuer: 'https://id.acme.test',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function setup(response: Response = jsonResponse(PROVIDER)) {
  const fetchMock = jest.fn().mockResolvedValue(response)
  const admin = new GoTrueAdminApi({ url: TEST_URL, headers: TEST_HEADERS, fetch: fetchMock })
  return { admin, fetchMock }
}

function requestOf(fetchMock: jest.Mock) {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return { url, init }
}

const notFound = () =>
  jsonResponse({ code: 404, error_code: 'custom_provider_not_found', msg: 'not found' }, 404)

describe('admin.customProviders.listProviders', () => {
  test('sends GET /admin/custom-providers and returns the providers', async () => {
    const { admin, fetchMock } = setup(jsonResponse({ providers: [PROVIDER] }))

    const { data, error } = await admin.customProviders.listProviders()

    expect(error).toBeNull()
    expect(data).toEqual({ providers: [PROVIDER] })
    const { url, init } = requestOf(fetchMock)
    expect(url).toBe(PROVIDERS_URL)
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>).Authorization).toBe(TEST_HEADERS.Authorization)
  })

  test('passes the type filter as a query parameter', async () => {
    const { admin, fetchMock } = setup(jsonResponse({ providers: [] }))

    await admin.customProviders.listProviders({ type: 'oidc' })

    expect(requestOf(fetchMock).url).toBe(`${PROVIDERS_URL}?type=oidc`)
  })

  test('returns an empty list when the response has no providers field', async () => {
    const { admin } = setup(jsonResponse({}))

    const { data, error } = await admin.customProviders.listProviders()

    expect(error).toBeNull()
    expect(data).toEqual({ providers: [] })
  })

  test('returns an empty list and the error on an API error', async () => {
    const { admin } = setup(jsonResponse({ code: 403, msg: 'forbidden' }, 403))

    const { data, error } = await admin.customProviders.listProviders()

    expect(data).toEqual({ providers: [] })
    expect(error).toBeInstanceOf(AuthApiError)
    expect(error?.status).toBe(403)
  })
})

describe('admin.customProviders.createProvider', () => {
  test('sends POST /admin/custom-providers with the params as the body', async () => {
    const { admin, fetchMock } = setup()

    const { data, error } = await admin.customProviders.createProvider(CREATE_PARAMS)

    expect(error).toBeNull()
    expect(data).toEqual(PROVIDER)
    const { url, init } = requestOf(fetchMock)
    expect(url).toBe(PROVIDERS_URL)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(CREATE_PARAMS)
  })

  test('returns the error on an API error', async () => {
    const { admin } = setup(
      jsonResponse({ code: 400, error_code: 'validation_failed', msg: 'issuer is required' }, 400)
    )

    const { data, error } = await admin.customProviders.createProvider(CREATE_PARAMS)

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthApiError)
    expect(error?.code).toBe('validation_failed')
  })
})

describe('admin.customProviders.getProvider', () => {
  test('sends GET /admin/custom-providers/{identifier}', async () => {
    const { admin, fetchMock } = setup()

    const { data, error } = await admin.customProviders.getProvider('custom:acme')

    expect(error).toBeNull()
    expect(data).toEqual(PROVIDER)
    const { url, init } = requestOf(fetchMock)
    expect(url).toBe(`${PROVIDERS_URL}/custom:acme`)
    expect(init.method).toBe('GET')
  })

  test('returns the error on an API error', async () => {
    const { admin } = setup(notFound())

    const { data, error } = await admin.customProviders.getProvider('custom:missing')

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthApiError)
    expect(error?.status).toBe(404)
  })
})

describe('admin.customProviders.updateProvider', () => {
  test('sends PUT /admin/custom-providers/{identifier} with the params as the body', async () => {
    const { admin, fetchMock } = setup(jsonResponse({ ...PROVIDER, name: 'Acme Corp' }))

    const { data, error } = await admin.customProviders.updateProvider('custom:acme', {
      name: 'Acme Corp',
    })

    expect(error).toBeNull()
    expect(data?.name).toBe('Acme Corp')
    const { url, init } = requestOf(fetchMock)
    expect(url).toBe(`${PROVIDERS_URL}/custom:acme`)
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Acme Corp' })
  })

  test('returns the error on an API error', async () => {
    const { admin } = setup(notFound())

    const { data, error } = await admin.customProviders.updateProvider('custom:missing', {
      name: 'x',
    })

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthApiError)
    expect(error?.status).toBe(404)
  })
})

describe('admin.customProviders.deleteProvider', () => {
  test('sends DELETE /admin/custom-providers/{identifier}', async () => {
    const { admin, fetchMock } = setup(new Response(null, { status: 204 }))

    const { data, error } = await admin.customProviders.deleteProvider('custom:acme')

    expect(data).toBeNull()
    expect(error).toBeNull()
    const { url, init } = requestOf(fetchMock)
    expect(url).toBe(`${PROVIDERS_URL}/custom:acme`)
    expect(init.method).toBe('DELETE')
  })

  test('returns the error on an API error', async () => {
    const { admin } = setup(notFound())

    const { data, error } = await admin.customProviders.deleteProvider('custom:missing')

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AuthApiError)
    expect(error?.status).toBe(404)
  })
})

describe('custom provider identifier validation', () => {
  type IdentifierCall = (admin: GoTrueAdminApi, identifier: string) => Promise<unknown>

  const calls: Array<[string, IdentifierCall]> = [
    ['getProvider', (admin, identifier) => admin.customProviders.getProvider(identifier)],
    [
      'updateProvider',
      (admin, identifier) => admin.customProviders.updateProvider(identifier, { name: 'x' }),
    ],
    ['deleteProvider', (admin, identifier) => admin.customProviders.deleteProvider(identifier)],
  ]

  // Each of these would change the request target if put into the path as is:
  // `/` and `\` add path segments (and `..` segments are then resolved), `?`
  // starts a query and `#` a fragment. The server only accepts identifiers
  // that start with `custom:`.
  const invalidIdentifiers = [
    `custom:acme/../../users/${TEST_USER_UUID}`,
    `../users/${TEST_USER_UUID}`,
    'custom:acme\\..\\..\\users',
    'custom:acme?type=oidc',
    'custom:acme#fragment',
    'acme',
    '..',
    '',
  ]

  // Formats the server accepts: any identifier that starts with `custom:`.
  const validIdentifiers = ['custom:acme', 'custom:acme-corp_2', 'custom:acme.eu', 'custom:ACME']

  describe.each(calls)('%s', (_name, call) => {
    test.each(invalidIdentifiers)('rejects %p before sending a request', async (identifier) => {
      const { admin, fetchMock } = setup()

      await expect(call(admin, identifier)).rejects.toThrow(
        '@supabase/auth-js: Expected parameter to be a custom provider identifier'
      )
      expect(fetchMock).not.toHaveBeenCalled()
    })

    test.each(validIdentifiers)('sends the request for %p', async (identifier) => {
      const { admin, fetchMock } = setup(
        call === calls[2][1] ? new Response(null, { status: 204 }) : jsonResponse(PROVIDER)
      )

      const result = (await call(admin, identifier)) as { error: unknown }

      expect(result.error).toBeNull()
      expect(requestOf(fetchMock).url).toBe(`${PROVIDERS_URL}/${identifier}`)
    })
  })
})
