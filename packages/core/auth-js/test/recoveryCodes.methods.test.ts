import { GoTrueClient } from '../src/index'
import { AuthApiError, AuthRetryableFetchError } from '../src/lib/errors'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'
import type { AuthChangeEvent, ExperimentalFeatureFlags, LockFunc, Session } from '../src/lib/types'

// Fetch is always mocked in this file, so the URL is never resolved.
const TEST_URL = 'http://localhost:9999'
const RECOVERY_CODES_URL = `${TEST_URL}/factors/recovery-codes`
const TEST_HEADERS = { apikey: 'test-publishable-key' }
const TEST_USER_UUID = '11111111-2222-3333-4444-555555555555'
const TEST_FACTOR_UUID = '99999999-8888-7777-6666-555555555555'
const STORED_ACCESS_TOKEN = 'test-access-token'

const TEST_USER = {
  id: TEST_USER_UUID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'recovery-codes-user@example.com',
  created_at: '2026-01-01T00:00:00.000Z',
}

const RECOVERY_CODES = [
  'k4m6x7qp2ab5ht3z',
  'wze6r5npd4cmq7vt',
  'nq5v7xk2m6tp4wzs',
  'h3kqw2m7xt4rpn6b',
  'p7tz4mq2k6xn5wrb',
  'b3d6fh2jkm4npq5r',
  'r5t7vwx2z3a4b6cd',
  'c6d7efg2h3j4k5mn',
  'm6n7pq2r3s4t5vwx',
  'w6x7yz2a3b4c5def',
]

const STATUS_RESPONSE = {
  id: TEST_FACTOR_UUID,
  type: 'recovery_code',
  total: 10,
  remaining: 7,
}

const GENERATE_RESPONSE = {
  id: TEST_FACTOR_UUID,
  type: 'recovery_code',
  friendly_name: 'Recovery codes',
  total: 10,
  codes: RECOVERY_CODES,
}

const VERIFY_RESPONSE = {
  access_token: 'aal2-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 1900000000,
  refresh_token: 'aal2-refresh-token',
  user: {
    ...TEST_USER,
    factors: [
      {
        id: 'totp-factor-id',
        factor_type: 'totp',
        status: 'verified',
        friendly_name: 'Authenticator app',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: TEST_FACTOR_UUID,
        factor_type: 'recovery_code',
        status: 'verified',
        friendly_name: 'Recovery codes',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
}

const mockSession = (): Session =>
  ({
    access_token: STORED_ACCESS_TOKEN,
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: TEST_USER,
  }) as Session

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  headers: new Headers({ 'x-supabase-api-version': '2024-01-01' }),
  json: () => Promise.resolve(body),
})

const apiErrorResponse = (message: string, status: number, code?: string) =>
  jsonResponse({ code, msg: message }, status)

type ClientSetup = {
  client: GoTrueClient
  mockFetch: jest.Mock
  storage: ReturnType<typeof memoryLocalStorageAdapter>
  storageKey: string
}

const createClient = async ({
  withSession = true,
  throwOnError = false,
  lock,
  experimental = { recoveryCodes: true },
}: {
  withSession?: boolean
  throwOnError?: boolean
  lock?: LockFunc
  experimental?: ExperimentalFeatureFlags
} = {}): Promise<ClientSetup> => {
  const mockFetch = jest.fn()
  const storage = memoryLocalStorageAdapter()
  const storageKey = 'recovery-codes-methods-test'
  if (withSession) {
    await storage.setItem(storageKey, JSON.stringify(mockSession()))
  }
  const client = new GoTrueClient({
    url: TEST_URL,
    headers: TEST_HEADERS,
    storageKey,
    storage,
    autoRefreshToken: false,
    persistSession: true,
    fetch: mockFetch as unknown as typeof fetch,
    throwOnError,
    lock,
    experimental,
  })
  await client.initialize()
  return { client, mockFetch, storage, storageKey }
}

const lastRequest = (mockFetch: jest.Mock) => {
  const [url, params] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  return { url, params, body: params.body ? JSON.parse(params.body) : undefined }
}

const storedSession = async ({ storage, storageKey }: ClientSetup): Promise<Session | null> => {
  const raw = await storage.getItem(storageKey)
  return raw ? (JSON.parse(raw) as Session) : null
}

const subscribe = (client: GoTrueClient) => {
  const events: { event: AuthChangeEvent; session: Session | null }[] = []
  const {
    data: { subscription },
  } = client.onAuthStateChange((event, session) => {
    events.push({ event, session })
  })
  return { events, subscription }
}

describe('mfa.recoveryCodes', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('namespace', () => {
    test('exposes bound methods that can be destructured', async () => {
      const { client, mockFetch } = await createClient()
      const { getStatus, generate, verify, regenerate, unenroll } = client.mfa.recoveryCodes
      for (const method of [getStatus, generate, verify, regenerate, unenroll]) {
        expect(typeof method).toBe('function')
      }

      mockFetch.mockResolvedValueOnce(jsonResponse(STATUS_RESPONSE))
      const { data, error } = await getStatus()

      expect(error).toBeNull()
      expect(data).toEqual(STATUS_RESPONSE)
    })
  })

  describe('getStatus', () => {
    test('issues GET /factors/recovery-codes with the session token', async () => {
      const { client, mockFetch } = await createClient()
      mockFetch.mockResolvedValueOnce(jsonResponse(STATUS_RESPONSE))

      const { data, error } = await client.mfa.recoveryCodes.getStatus()

      expect(error).toBeNull()
      expect(data).toEqual(STATUS_RESPONSE)
      const { url, params, body } = lastRequest(mockFetch)
      expect(url).toBe(RECOVERY_CODES_URL)
      expect(params.method).toBe('GET')
      expect(params.headers.Authorization).toBe(`Bearer ${STORED_ACCESS_TOKEN}`)
      expect(params.headers.apikey).toBe(TEST_HEADERS.apikey)
      expect(body).toBeUndefined()
    })

    test('returns mfa_factor_not_found when no recovery codes are enrolled', async () => {
      const { client, mockFetch } = await createClient()
      mockFetch.mockResolvedValueOnce(
        apiErrorResponse('The user has not enrolled recovery codes', 404, 'mfa_factor_not_found')
      )

      const { data, error } = await client.mfa.recoveryCodes.getStatus()

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect(error?.status).toBe(404)
      expect(error?.code).toBe('mfa_factor_not_found')
    })
  })

  describe('generate', () => {
    test('issues POST /factors/recovery-codes without a body when no name is given', async () => {
      const { client, mockFetch } = await createClient()
      mockFetch.mockResolvedValueOnce(jsonResponse(GENERATE_RESPONSE))

      const { data, error } = await client.mfa.recoveryCodes.generate()

      expect(error).toBeNull()
      expect(data).toEqual(GENERATE_RESPONSE)
      expect(data?.codes).toHaveLength(10)
      for (const code of data?.codes ?? []) {
        expect(code).toMatch(/^[a-z2-7]{16}$/)
      }
      const { url, params, body } = lastRequest(mockFetch)
      expect(url).toBe(RECOVERY_CODES_URL)
      expect(params.method).toBe('POST')
      expect(params.headers.Authorization).toBe(`Bearer ${STORED_ACCESS_TOKEN}`)
      expect(body).toBeUndefined()
    })

    test('maps friendlyName to friendly_name in the request body', async () => {
      const { client, mockFetch } = await createClient()
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ...GENERATE_RESPONSE, friendly_name: 'Backup codes' })
      )

      const { data, error } = await client.mfa.recoveryCodes.generate({
        friendlyName: 'Backup codes',
      })

      expect(error).toBeNull()
      expect(data?.friendly_name).toBe('Backup codes')
      expect(lastRequest(mockFetch).body).toEqual({ friendly_name: 'Backup codes' })
    })

    test.each([
      [422, 'mfa_recovery_codes_enroll_not_enabled'],
      [403, 'insufficient_aal'],
      [422, 'mfa_verified_factor_exists'],
      [422, 'mfa_recovery_codes_sole_factor'],
      [422, 'mfa_factor_name_conflict'],
      [422, 'too_many_enrolled_mfa_factors'],
    ])('surfaces %i %s as an AuthApiError', async (status, code) => {
      const { client, mockFetch } = await createClient()
      mockFetch.mockResolvedValueOnce(apiErrorResponse('generate failed', status, code))

      const { data, error } = await client.mfa.recoveryCodes.generate()

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect(error?.status).toBe(status)
      expect(error?.code).toBe(code)
    })
  })

  describe('verify', () => {
    test('POSTs the code as typed, persists the upgraded session and emits MFA_CHALLENGE_VERIFIED', async () => {
      const setup = await createClient()
      const { client, mockFetch } = setup
      const { events, subscription } = subscribe(client)
      mockFetch.mockResolvedValueOnce(jsonResponse(VERIFY_RESPONSE))

      const { data, error } = await client.mfa.recoveryCodes.verify({ code: 'K4M6-X7QP 2AB5-ht3z' })

      expect(error).toBeNull()
      expect(data).toEqual(VERIFY_RESPONSE)
      const { url, params, body } = lastRequest(mockFetch)
      expect(url).toBe(`${RECOVERY_CODES_URL}/verify`)
      expect(params.method).toBe('POST')
      expect(params.headers.Authorization).toBe(`Bearer ${STORED_ACCESS_TOKEN}`)
      // No client-side normalization: the server ignores case, whitespace and separators.
      expect(body).toEqual({ code: 'K4M6-X7QP 2AB5-ht3z' })

      const stored = await storedSession(setup)
      expect(stored?.access_token).toBe(VERIFY_RESPONSE.access_token)
      expect(stored?.refresh_token).toBe(VERIFY_RESPONSE.refresh_token)
      expect(stored?.expires_at).toBe(VERIFY_RESPONSE.expires_at)

      const {
        data: { session },
      } = await client.getSession()
      expect(session?.access_token).toBe(VERIFY_RESPONSE.access_token)

      const mfaEvents = events.filter((e) => e.event === 'MFA_CHALLENGE_VERIFIED')
      expect(mfaEvents).toHaveLength(1)
      expect(mfaEvents[0].session?.access_token).toBe(VERIFY_RESPONSE.access_token)
      expect(typeof mfaEvents[0].session?.expires_at).toBe('number')
      expect(events.map((e) => e.event)).not.toContain('SIGNED_IN')
      subscription.unsubscribe()
    })

    test('computes expires_at from expires_in when the server omits it', async () => {
      const setup = await createClient()
      const withoutExpiresAt: Partial<typeof VERIFY_RESPONSE> = { ...VERIFY_RESPONSE }
      delete withoutExpiresAt.expires_at
      setup.mockFetch.mockResolvedValueOnce(jsonResponse(withoutExpiresAt))

      const before = Math.floor(Date.now() / 1000)
      const { error } = await setup.client.mfa.recoveryCodes.verify({ code: RECOVERY_CODES[0] })
      const after = Math.ceil(Date.now() / 1000)

      expect(error).toBeNull()
      const stored = await storedSession(setup)
      expect(stored?.expires_at).toBeGreaterThanOrEqual(before + VERIFY_RESPONSE.expires_in)
      expect(stored?.expires_at).toBeLessThanOrEqual(after + VERIFY_RESPONSE.expires_in)
    })

    test.each([
      [422, 'mfa_verification_failed'],
      [429, 'mfa_recovery_codes_locked'],
      [400, 'validation_failed'],
      [403, 'mfa_verification_rejected'],
      [422, 'mfa_recovery_codes_verify_not_enabled'],
      [429, 'over_request_rate_limit'],
    ])('surfaces %i %s without touching the stored session', async (status, code) => {
      const setup = await createClient()
      const { events, subscription } = subscribe(setup.client)
      setup.mockFetch.mockResolvedValueOnce(apiErrorResponse('verify failed', status, code))

      const { data, error } = await setup.client.mfa.recoveryCodes.verify({ code: 'wrong' })

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect(error?.status).toBe(status)
      expect(error?.code).toBe(code)
      expect((await storedSession(setup))?.access_token).toBe(STORED_ACCESS_TOKEN)
      expect(events.map((e) => e.event)).not.toContain('MFA_CHALLENGE_VERIFIED')
      subscription.unsubscribe()
    })

    test('runs inside the custom lock when the legacy lock option is used', async () => {
      // The deprecated `lock` option logs a warning on construction.
      jest.spyOn(console, 'warn').mockImplementation(() => {})
      const lockMock = jest.fn(
        async (_name: string, _timeout: number, fn: () => Promise<unknown>) => fn()
      )
      const { client, mockFetch } = await createClient({ lock: lockMock as unknown as LockFunc })
      const callsBefore = lockMock.mock.calls.length
      mockFetch.mockResolvedValueOnce(jsonResponse(VERIFY_RESPONSE))

      const { error } = await client.mfa.recoveryCodes.verify({ code: RECOVERY_CODES[0] })

      expect(error).toBeNull()
      expect(lockMock.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  describe('regenerate', () => {
    test('issues POST /factors/recovery-codes/regenerate without a body', async () => {
      const { client, mockFetch } = await createClient()
      const regenerated = { ...GENERATE_RESPONSE, codes: [...RECOVERY_CODES].reverse() }
      mockFetch.mockResolvedValueOnce(jsonResponse(regenerated))

      const { data, error } = await client.mfa.recoveryCodes.regenerate()

      expect(error).toBeNull()
      expect(data).toEqual(regenerated)
      expect(data?.id).toBe(TEST_FACTOR_UUID)
      const { url, params, body } = lastRequest(mockFetch)
      expect(url).toBe(`${RECOVERY_CODES_URL}/regenerate`)
      expect(params.method).toBe('POST')
      expect(params.headers.Authorization).toBe(`Bearer ${STORED_ACCESS_TOKEN}`)
      expect(body).toBeUndefined()
    })

    test.each([
      [404, 'mfa_factor_not_found'],
      [403, 'insufficient_aal'],
      [422, 'mfa_recovery_codes_enroll_not_enabled'],
    ])('surfaces %i %s as an AuthApiError', async (status, code) => {
      const { client, mockFetch } = await createClient()
      mockFetch.mockResolvedValueOnce(apiErrorResponse('regenerate failed', status, code))

      const { data, error } = await client.mfa.recoveryCodes.regenerate()

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect(error?.status).toBe(status)
      expect(error?.code).toBe(code)
    })
  })

  describe('unenroll', () => {
    test('issues DELETE /factors/recovery-codes and returns the factor id', async () => {
      const { client, mockFetch } = await createClient()
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: TEST_FACTOR_UUID }))

      const { data, error } = await client.mfa.recoveryCodes.unenroll()

      expect(error).toBeNull()
      expect(data).toEqual({ id: TEST_FACTOR_UUID })
      const { url, params, body } = lastRequest(mockFetch)
      expect(url).toBe(RECOVERY_CODES_URL)
      expect(params.method).toBe('DELETE')
      expect(params.headers.Authorization).toBe(`Bearer ${STORED_ACCESS_TOKEN}`)
      expect(body).toBeUndefined()
    })

    test.each([
      [404, 'mfa_factor_not_found'],
      [403, 'insufficient_aal'],
    ])('surfaces %i %s as an AuthApiError', async (status, code) => {
      const { client, mockFetch } = await createClient()
      mockFetch.mockResolvedValueOnce(apiErrorResponse('unenroll failed', status, code))

      const { data, error } = await client.mfa.recoveryCodes.unenroll()

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthApiError)
      expect(error?.status).toBe(status)
      expect(error?.code).toBe(code)
    })
  })

  describe('cross-cutting behaviour', () => {
    test.each<[string, (client: GoTrueClient) => Promise<unknown>]>([
      ['getStatus', (c) => c.mfa.recoveryCodes.getStatus()],
      ['generate', (c) => c.mfa.recoveryCodes.generate()],
      ['verify', (c) => c.mfa.recoveryCodes.verify({ code: RECOVERY_CODES[0] })],
      ['regenerate', (c) => c.mfa.recoveryCodes.regenerate()],
      ['unenroll', (c) => c.mfa.recoveryCodes.unenroll()],
    ])('%s rejects with the AuthApiError when throwOnError is enabled', async (_name, invoke) => {
      const { client, mockFetch } = await createClient({ throwOnError: true })
      mockFetch.mockResolvedValueOnce(apiErrorResponse('AAL2 required', 403, 'insufficient_aal'))

      await expect(invoke(client)).rejects.toMatchObject({
        name: 'AuthApiError',
        status: 403,
        code: 'insufficient_aal',
      })
    })

    test('throwOnError still resolves on success', async () => {
      const { client, mockFetch } = await createClient({ throwOnError: true })
      mockFetch.mockResolvedValueOnce(jsonResponse(STATUS_RESPONSE))

      await expect(client.mfa.recoveryCodes.getStatus()).resolves.toEqual({
        data: STATUS_RESPONSE,
        error: null,
      })
    })

    test('sends the request without an Authorization header when there is no session', async () => {
      const { client, mockFetch } = await createClient({ withSession: false })
      mockFetch.mockResolvedValueOnce(
        apiErrorResponse('This endpoint requires a Bearer token', 401, 'no_authorization')
      )

      const { data, error } = await client.mfa.recoveryCodes.getStatus()

      expect(data).toBeNull()
      expect(error?.code).toBe('no_authorization')
      expect(lastRequest(mockFetch).params.headers.Authorization).toBeUndefined()
    })

    test('returns an AuthRetryableFetchError when fetch fails', async () => {
      const { client, mockFetch } = await createClient()
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

      const { data, error } = await client.mfa.recoveryCodes.getStatus()

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(AuthRetryableFetchError)
    })
  })
})
