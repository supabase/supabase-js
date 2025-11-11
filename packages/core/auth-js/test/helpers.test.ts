import { AuthInvalidJwtError } from '../src'
import {
  decodeJWT,
  generateCallbackId,
  getAlgorithm,
  parseParametersFromURL,
  parseResponseAPIVersion,
  getCodeChallengeAndMethod,
  validateUUID,
} from '../src/lib/helpers'

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
    expect(() => decodeJWT('non-jwt')).toThrowError(
      new AuthInvalidJwtError('Invalid JWT structure')
    )
    expect(() => decodeJWT('aHR0.cDovL.2V4YW1wbGUuY29t')).toThrowError(
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
    expect(() => getAlgorithm('EdDSA' as any)).toThrowError(new Error('Invalid alg claim'))
  })
})

describe('getCodeChallengeAndMethod', () => {
  const testCases = [
    {
      name: 'should append /PASSWORD_RECOVERY to stored code_verifier',
      isPasswordRecovery: true,
    },
    {
      name: 'should not append /PASSWORD_RECOVERY for other flows',
      isPasswordRecovery: false,
    },
  ]

  test.each(testCases)('$name', async ({ isPasswordRecovery }) => {
    const mockStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(
      mockStorage,
      'test-storage-key',
      isPasswordRecovery
    )

    const setItemCall = mockStorage.setItem.mock.calls[0]
    expect(setItemCall[0]).toBe('test-storage-key-code-verifier')
    const storedValue = JSON.parse(setItemCall[1])
    if (isPasswordRecovery) {
      expect(storedValue).toContain('/PASSWORD_RECOVERY')
    } else {
      expect(storedValue).not.toContain('/PASSWORD_RECOVERY')
    }
    expect(codeChallenge).toBeDefined()
    expect(codeChallengeMethod).toBeDefined()
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
