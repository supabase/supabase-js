import { GoTrueClient } from '../src/index'
import type { ExperimentalFeatureFlags } from '../src/lib/types'

const ERROR_MESSAGE_FRAGMENT = 'the MFA recovery codes API is experimental and disabled by default'

// Guard runs before any network I/O, so the URL never needs to resolve.
const TEST_URL = 'http://127.0.0.1:1/auth/v1'
const TEST_HEADERS = { apikey: 'test-anon-key' }

const createClient = (experimental?: ExperimentalFeatureFlags) =>
  new GoTrueClient({
    url: TEST_URL,
    headers: TEST_HEADERS,
    autoRefreshToken: false,
    persistSession: false,
    experimental,
  })

describe('MFA recovery codes experimental gating', () => {
  let client: GoTrueClient

  beforeEach(() => {
    client = createClient()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test.each<[string, (client: GoTrueClient) => Promise<unknown>]>([
    ['mfa.recoveryCodes.getStatus', (c) => c.mfa.recoveryCodes.getStatus()],
    ['mfa.recoveryCodes.generate', (c) => c.mfa.recoveryCodes.generate()],
    ['mfa.recoveryCodes.verify', (c) => c.mfa.recoveryCodes.verify({ code: 'k4m9x7qp2ab8ht3z' })],
    ['mfa.recoveryCodes.regenerate', (c) => c.mfa.recoveryCodes.regenerate()],
    ['mfa.recoveryCodes.unenroll', (c) => c.mfa.recoveryCodes.unenroll()],
  ])('%s throws when experimental.recoveryCodes is not set', async (_name, invoke) => {
    await expect(invoke(client)).rejects.toThrow(ERROR_MESSAGE_FRAGMENT)
  })

  test('error message references the opt-in key', async () => {
    await expect(client.mfa.recoveryCodes.getStatus()).rejects.toThrow(
      /experimental.*recoveryCodes/
    )
  })

  test('mfa.listFactors is not gated and buckets recovery_code factors', async () => {
    jest.spyOn(client, 'getUser').mockResolvedValue({
      data: {
        user: {
          id: 'user-id',
          factors: [
            {
              id: 'recovery-codes-factor-id',
              factor_type: 'recovery_code',
              status: 'verified',
              friendly_name: 'Recovery codes',
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      },
      error: null,
    } as unknown as Awaited<ReturnType<GoTrueClient['getUser']>>)

    const { data, error } = await client.mfa.listFactors()

    expect(error).toBeNull()
    expect(data?.all).toHaveLength(1)
    expect(data?.recovery_code).toHaveLength(1)
    expect(data?.recovery_code[0].id).toBe('recovery-codes-factor-id')
  })
})
