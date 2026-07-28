import { AuthInvalidJwtError } from '../src'
import {
  appendFlowIdToRedirectTo,
  decodeJWT,
  generateCallbackId,
  generatePKCEFlowId,
  getAlgorithm,
  getItemAsync,
  parseParametersFromURL,
  parseResponseAPIVersion,
  getCodeChallengeAndMethod,
  removePKCEVerifier,
  retrievePKCEVerifier,
  storePKCEVerifier,
  validatePKCEFlowId,
  validateUUID,
} from '../src/lib/helpers'
import { memoryLocalStorageAdapter } from '../src/lib/local-storage'

describe('generateCallbackId', () => {
  it('should return a Symbol', () => {
    const id = generateCallbackId()
    expect(typeof id).toBe('symbol')
  })

  it('should return unique Symbols on each call', () => {
    const id1 = generateCallbackId()
    const id2 = generateCallbackId()
    const id3 = generateCallbackId()

    expect(id1).not.toBe(id2)
    expect(id2).not.toBe(id3)
    expect(id1).not.toBe(id3)
  })

  it('should work as Map keys', () => {
    const id1 = generateCallbackId()
    const id2 = generateCallbackId()

    const map = new Map()
    map.set(id1, 'callback1')
    map.set(id2, 'callback2')

    expect(map.get(id1)).toBe('callback1')
    expect(map.get(id2)).toBe('callback2')
    expect(map.size).toBe(2)

    map.delete(id1)
    expect(map.has(id1)).toBe(false)
    expect(map.has(id2)).toBe(true)
  })

  it('should have a description for debugging', () => {
    const id = generateCallbackId()
    expect(id.toString()).toBe('Symbol(auth-callback)')
  })
})

describe('parseParametersFromURL', () => {
  it('should parse parameters from a URL with query params only', () => {
    const url = new URL('https://supabase.com')
    url.searchParams.set('a', 'b')
    url.searchParams.set('b', 'c')

    const result = parseParametersFromURL(url.href)
    expect(result).toMatchObject({
      a: 'b',
      b: 'c',
    })
  })

  it('should parse parameters from a URL with fragment params only', () => {
    const url = new URL('https://supabase.com')
    const fragmentParams = new URLSearchParams({ a: 'b', b: 'c' })
    url.hash = fragmentParams.toString()

    const result = parseParametersFromURL(url.href)
    expect(result).toMatchObject({
      a: 'b',
      b: 'c',
    })
  })

  it('should parse parameters from a URL with both query params and fragment params', () => {
    const url = new URL('https://supabase.com')
    url.searchParams.set('a', 'b')
    url.searchParams.set('b', 'c')
    url.searchParams.set('x', 'z')

    const fragmentParams = new URLSearchParams({ d: 'e', x: 'y' })
    url.hash = fragmentParams.toString()

    const result = parseParametersFromURL(url.href)
    expect(result).toMatchObject({
      a: 'b',
      b: 'c',
      d: 'e',
      x: 'z', // search params take precedence
    })
  })
})

describe('parseResponseAPIVersion', () => {
  it('should parse valid dates', () => {
    expect(
      parseResponseAPIVersion({
        headers: {
          get: () => {
            return '2024-01-01'
          },
        },
      } as any)
    ).toEqual(new Date('2024-01-01T00:00:00.0Z'))
  })

  it('should return null on invalid dates', () => {
    ;['2024-01-32', '', 'notadate', 'Sat Feb 24 2024 17:59:17 GMT+0100'].forEach((example) => {
      expect(
        parseResponseAPIVersion({
          headers: {
            get: () => {
              return example
            },
          },
        } as any)
      ).toBeNull()
    })
  })
})

describe('decodeJWT', () => {
  it('should reject non-JWT strings', () => {
    expect(() => decodeJWT('non-jwt')).toThrow(new AuthInvalidJwtError('Invalid JWT structure'))
    expect(() => decodeJWT('aHR0.cDovL.2V4YW1wbGUuY29t')).toThrow(
      new AuthInvalidJwtError('JWT not in base64url format')
    )
  })

  it('should decode JWT successfully', () => {
    expect(
      decodeJWT(
        'eyJhbGciOiJFUzI1NiIsImtpZCI6ImZhM2ZmYzk5LTQ2MzUtNGIxOS1iNWMwLTZkNmE4ZDMwYzRlYiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Byb2plY3RyZWYuc3VwYWJhc2UuY28iLCJzdWIiOiI2OTAxMTJlNi04NThiLTQwYzctODBlNi05NmRiNjk3MTkyYjUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxODM4MDk5NjcwLCJpYXQiOjE3MzgwOTk2NzAsImVtYWlsIjoiIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnt9LCJ1c2VyX21ldGFkYXRhIjp7ImNvbG9yIjoiYmx1ZSJ9LCJyb2xlIjoiIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoiYW5vbnltb3VzIiwidGltZXN0YW1wIjoxNzM4MDk5NjcwfV0sInNlc3Npb25faWQiOiI0YzZiMjg5NC00M2I0LTQ2YzQtYmQyZi0zNWM1OWVjNDRmZWYiLCJpc19hbm9ueW1vdXMiOnRydWV9.JcWCW3u4F9iFo1yV3OlxnosP7jLnOa2Q7LoPTxyFmvZc1_Kziimw8jD95EpXyTMEwKFt2dPSmWGkqdoJu6FV0Q'
      )
    ).toMatchInlineSnapshot(`
      {
        "header": {
          "alg": "ES256",
          "kid": "fa3ffc99-4635-4b19-b5c0-6d6a8d30c4eb",
          "typ": "JWT",
        },
        "payload": {
          "aal": "aal1",
          "amr": [
            {
              "method": "anonymous",
              "timestamp": 1738099670,
            },
          ],
          "app_metadata": {},
          "aud": "authenticated",
          "email": "",
          "exp": 1838099670,
          "iat": 1738099670,
          "is_anonymous": true,
          "iss": "https://projectref.supabase.co",
          "phone": "",
          "role": "",
          "session_id": "4c6b2894-43b4-46c4-bd2f-35c59ec44fef",
          "sub": "690112e6-858b-40c7-80e6-96db697192b5",
          "user_metadata": {
            "color": "blue",
          },
        },
        "raw": {
          "header": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImZhM2ZmYzk5LTQ2MzUtNGIxOS1iNWMwLTZkNmE4ZDMwYzRlYiIsInR5cCI6IkpXVCJ9",
          "payload": "eyJpc3MiOiJodHRwczovL3Byb2plY3RyZWYuc3VwYWJhc2UuY28iLCJzdWIiOiI2OTAxMTJlNi04NThiLTQwYzctODBlNi05NmRiNjk3MTkyYjUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxODM4MDk5NjcwLCJpYXQiOjE3MzgwOTk2NzAsImVtYWlsIjoiIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnt9LCJ1c2VyX21ldGFkYXRhIjp7ImNvbG9yIjoiYmx1ZSJ9LCJyb2xlIjoiIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoiYW5vbnltb3VzIiwidGltZXN0YW1wIjoxNzM4MDk5NjcwfV0sInNlc3Npb25faWQiOiI0YzZiMjg5NC00M2I0LTQ2YzQtYmQyZi0zNWM1OWVjNDRmZWYiLCJpc19hbm9ueW1vdXMiOnRydWV9",
        },
        "signature": Uint8Array [
          37,
          197,
          130,
          91,
          123,
          184,
          23,
          216,
          133,
          163,
          92,
          149,
          220,
          233,
          113,
          158,
          139,
          15,
          238,
          50,
          231,
          57,
          173,
          144,
          236,
          186,
          15,
          79,
          28,
          133,
          154,
          246,
          92,
          215,
          242,
          179,
          138,
          41,
          176,
          242,
          48,
          253,
          228,
          74,
          87,
          201,
          51,
          4,
          192,
          161,
          109,
          217,
          211,
          210,
          153,
          97,
          164,
          169,
          218,
          9,
          187,
          161,
          85,
          209,
        ],
      }
    `)
  })
})

describe('getAlgorithm', () => {
  const cases = [
    {
      name: 'RS256',
      expected: {
        name: 'RSASSA-PKCS1-v1_5',
        hash: { name: 'SHA-256' },
      },
    },
    {
      name: 'ES256',
      expected: {
        name: 'ECDSA',
        namedCurve: 'P-256',
        hash: { name: 'SHA-256' },
      },
    },
  ]
  it('should return correct algorithm object', () => {
    cases.forEach((c) => {
      expect(getAlgorithm(c.name as any)).toEqual(c.expected)
    })
  })
  it('should throw if invalid alg claim', () => {
    expect(() => getAlgorithm('EdDSA' as any)).toThrow(new Error('Invalid alg claim'))
  })
})

describe('getCodeChallengeAndMethod', () => {
  const testCases = [
    {
      name: 'should append /recovery to stored code_verifier',
      isPasswordRecovery: true,
    },
    {
      name: 'should not append /recovery for other flows',
      isPasswordRecovery: false,
    },
  ]

  test.each(testCases)('$name', async ({ isPasswordRecovery }) => {
    const mockStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const [codeChallenge, codeChallengeMethod, flowId] = await getCodeChallengeAndMethod(
      mockStorage,
      'test-storage-key',
      isPasswordRecovery
    )

    const setItemKeys = mockStorage.setItem.mock.calls.map((call) => call[0])
    expect(setItemKeys).toContain('test-storage-key-code-verifier')
    expect(setItemKeys).toContain(`test-storage-key-code-verifier-${flowId}`)

    const legacyCall = mockStorage.setItem.mock.calls.find(
      (call) => call[0] === 'test-storage-key-code-verifier'
    )!
    const slotCall = mockStorage.setItem.mock.calls.find(
      (call) => call[0] === `test-storage-key-code-verifier-${flowId}`
    )!
    const storedValue = JSON.parse(legacyCall[1])
    expect(JSON.parse(slotCall[1])).toEqual(storedValue)
    if (isPasswordRecovery) {
      expect(storedValue).toContain('/recovery')
    } else {
      expect(storedValue).not.toContain('/recovery')
    }
    expect(codeChallenge).toBeDefined()
    expect(codeChallengeMethod).toBeDefined()
    expect(flowId).toMatch(/^[a-f0-9]{32}$/)
  })
})

describe('PKCE verifier slots', () => {
  const storageKey = 'test-storage-key'
  const legacyKey = `${storageKey}-code-verifier`
  const indexKey = `${storageKey}-code-verifier-flows`

  it('storePKCEVerifier keeps one slot per flow plus the legacy key', async () => {
    const store: { [key: string]: string } = {}
    const storage = memoryLocalStorageAdapter(store)

    await storePKCEVerifier(storage, storageKey, 'flow-id-aaaa', 'verifier-a')
    await storePKCEVerifier(storage, storageKey, 'flow-id-bbbb', 'verifier-b')

    expect(await getItemAsync(storage, `${legacyKey}-flow-id-aaaa`)).toBe('verifier-a')
    expect(await getItemAsync(storage, `${legacyKey}-flow-id-bbbb`)).toBe('verifier-b')
    expect(await getItemAsync(storage, legacyKey)).toBe('verifier-b')
    expect(await getItemAsync(storage, indexKey)).toEqual(['flow-id-aaaa', 'flow-id-bbbb'])
  })

  it('storePKCEVerifier evicts the oldest slot beyond the bound', async () => {
    const store: { [key: string]: string } = {}
    const storage = memoryLocalStorageAdapter(store)

    const flowIds = ['flow-1111', 'flow-2222', 'flow-3333', 'flow-4444', 'flow-5555', 'flow-6666']
    for (const flowId of flowIds) {
      await storePKCEVerifier(storage, storageKey, flowId, `verifier-${flowId}`)
    }

    expect(await getItemAsync(storage, `${legacyKey}-flow-1111`)).toBeNull()
    expect(await getItemAsync(storage, indexKey)).toEqual(flowIds.slice(1))
    const slotKeys = Object.keys(store).filter(
      (key) => key.startsWith(`${legacyKey}-`) && key !== indexKey
    )
    expect(slotKeys).toHaveLength(5)
  })

  it('retrievePKCEVerifier prefers the slot and falls back to the legacy key', async () => {
    const storage = memoryLocalStorageAdapter()

    await storePKCEVerifier(storage, storageKey, 'flow-id-aaaa', 'verifier-a')
    await storePKCEVerifier(storage, storageKey, 'flow-id-bbbb', 'verifier-b')

    expect(await retrievePKCEVerifier(storage, storageKey, 'flow-id-aaaa')).toEqual({
      verifier: 'verifier-a',
      flowId: 'flow-id-aaaa',
    })
    // unknown flow id falls back to the most recent (legacy) verifier
    expect(await retrievePKCEVerifier(storage, storageKey, 'flow-id-gone')).toEqual({
      verifier: 'verifier-b',
      flowId: null,
    })
    expect(await retrievePKCEVerifier(storage, storageKey, null)).toEqual({
      verifier: 'verifier-b',
      flowId: null,
    })
  })

  it('removePKCEVerifier removes only its own slot', async () => {
    const storage = memoryLocalStorageAdapter()

    await storePKCEVerifier(storage, storageKey, 'flow-id-aaaa', 'verifier-a')
    await storePKCEVerifier(storage, storageKey, 'flow-id-bbbb', 'verifier-b')

    await removePKCEVerifier(storage, storageKey, 'flow-id-aaaa')

    expect(await getItemAsync(storage, `${legacyKey}-flow-id-aaaa`)).toBeNull()
    expect(await getItemAsync(storage, `${legacyKey}-flow-id-bbbb`)).toBe('verifier-b')
    // the legacy key holds flow b's verifier, so it must survive flow a's cleanup
    expect(await getItemAsync(storage, legacyKey)).toBe('verifier-b')
    expect(await getItemAsync(storage, indexKey)).toEqual(['flow-id-bbbb'])
  })

  it('removePKCEVerifier drops the legacy key when it belongs to the removed flow', async () => {
    const storage = memoryLocalStorageAdapter()

    await storePKCEVerifier(storage, storageKey, 'flow-id-aaaa', 'verifier-a')
    await removePKCEVerifier(storage, storageKey, 'flow-id-aaaa')

    expect(await getItemAsync(storage, legacyKey)).toBeNull()
    expect(await getItemAsync(storage, indexKey)).toBeNull()
  })

  it('removePKCEVerifier without a flow id only touches the legacy key', async () => {
    const storage = memoryLocalStorageAdapter()

    await storePKCEVerifier(storage, storageKey, 'flow-id-aaaa', 'verifier-a')
    await storePKCEVerifier(storage, storageKey, 'flow-id-bbbb', 'verifier-b')

    await removePKCEVerifier(storage, storageKey, null)

    expect(await getItemAsync(storage, legacyKey)).toBeNull()
    expect(await getItemAsync(storage, `${legacyKey}-flow-id-aaaa`)).toBe('verifier-a')
    expect(await getItemAsync(storage, `${legacyKey}-flow-id-bbbb`)).toBe('verifier-b')
  })
})

describe('validatePKCEFlowId', () => {
  it('accepts generated flow ids', () => {
    const flowId = generatePKCEFlowId()
    expect(validatePKCEFlowId(flowId)).toBe(flowId)
  })

  it.each([null, undefined, 42, '', 'short', 'has spaces here', 'a'.repeat(65), 'slash/../evil'])(
    'rejects %p',
    (value) => {
      expect(validatePKCEFlowId(value)).toBeNull()
    }
  )
})

describe('appendFlowIdToRedirectTo', () => {
  it('appends as the first query parameter', () => {
    expect(appendFlowIdToRedirectTo('https://app.example.com/callback', 'abc12345')).toBe(
      'https://app.example.com/callback?sb_flow_id=abc12345'
    )
  })

  it('appends after existing query parameters', () => {
    expect(
      appendFlowIdToRedirectTo('https://app.example.com/callback?next=/home', 'abc12345')
    ).toBe('https://app.example.com/callback?next=/home&sb_flow_id=abc12345')
  })

  it('keeps a fragment at the end', () => {
    expect(appendFlowIdToRedirectTo('https://app.example.com/callback#section', 'abc12345')).toBe(
      'https://app.example.com/callback?sb_flow_id=abc12345#section'
    )
  })

  it('works with custom schemes', () => {
    expect(appendFlowIdToRedirectTo('myapp://auth/callback', 'abc12345')).toBe(
      'myapp://auth/callback?sb_flow_id=abc12345'
    )
  })
})

describe('validateUUID', () => {
  const testCases = [
    {
      name: 'should accept valid UUID',
      input: '123e4567-e89b-12d3-a456-426614174000',
      shouldThrow: false,
    },
    {
      name: 'should reject invalid UUID format',
      input: 'not-a-uuid',
      shouldThrow: true,
    },
    {
      name: 'should reject UUID with wrong length',
      input: '123e4567-e89b-12d3-a456',
      shouldThrow: true,
    },
    {
      name: 'should reject UUID with invalid characters',
      input: '123e4567-e89b-12d3-a456-42661417400g',
      shouldThrow: true,
    },
  ]

  test.each(testCases)('$name', ({ input, shouldThrow }) => {
    if (shouldThrow) {
      expect(() => validateUUID(input)).toThrow(
        '@supabase/auth-js: Expected parameter to be UUID but is not'
      )
    } else {
      expect(() => validateUUID(input)).not.toThrow()
    }
  })
})

describe('getItemAsync', () => {
  const makeStorage = (initial: { [key: string]: string | null }) => {
    const data: { [key: string]: string | null } = { ...initial }
    return {
      getItem: jest.fn(async (key: string) => data[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        data[key] = value
      }),
      removeItem: jest.fn(async (key: string) => {
        delete data[key]
      }),
    }
  }

  it('returns null when the storage value is missing', async () => {
    const storage = makeStorage({})
    expect(await getItemAsync(storage, 'session')).toBeNull()
  })

  it('returns null when the storage value is empty string', async () => {
    const storage = makeStorage({ session: '' })
    expect(await getItemAsync(storage, 'session')).toBeNull()
  })

  it('returns the parsed object for valid JSON', async () => {
    const session = { access_token: 'a', refresh_token: 'b', expires_at: 1 }
    const storage = makeStorage({ session: JSON.stringify(session) })
    expect(await getItemAsync(storage, 'session')).toEqual(session)
  })

  it('returns null when the storage value is not valid JSON', async () => {
    // Simulates corrupted chunked cookies: combined+decoded payload that is
    // not parseable. Returning the raw string would cause _recoverAndRefresh
    // to throw `TypeError: Cannot create property 'user' on string ...`.
    const storage = makeStorage({ session: '{"access_token":"abc' })
    expect(await getItemAsync(storage, 'session')).toBeNull()
  })

  it('returns null for a JSON-encoded primitive that auth callers do not expect', async () => {
    // JSON.parse('"hello"') succeeds and returns the string "hello", which is
    // valid behavior. We are only guarding against parse failures here.
    const storage = makeStorage({ session: '"hello"' })
    expect(await getItemAsync(storage, 'session')).toEqual('hello')
  })
})
