import {
  getAddress,
  fromHex,
  toHex,
  createSiweMessage,
  type SiweMessage,
  type Hex,
} from '../src/lib/web3/ethereum'

describe('ethereum', () => {
  describe('getAddress', () => {
    test('should return lowercase address for valid Ethereum address', () => {
      const validAddresses = [
        '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        '0x742d35cc6634c0532925a3b8d4c9db96c4b4d8b6',
        '0x1234567890123456789012345678901234567890',
        '0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD',
      ]

      validAddresses.forEach((address) => {
        const result = getAddress(address)
        expect(result).toBe(address.toLowerCase())
        expect(result).toMatch(/^0x[a-f0-9]{40}$/)
      })
    })

    test('should throw error for invalid address format', () => {
      const invalidAddresses = [
        '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b', // too short
        '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b67', // too long
        '742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6', // missing 0x
        '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8bG', // invalid character
        '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b!', // invalid character
        '', // empty string
        'not-an-address', // random string
      ]

      invalidAddresses.forEach((address) => {
        expect(() => getAddress(address)).toThrow(
          `@supabase/auth-js: Address "${address}" is invalid.`
        )
      })
    })

    test('should handle edge cases', () => {
      // Valid address with all zeros
      expect(getAddress('0x0000000000000000000000000000000000000000')).toBe(
        '0x0000000000000000000000000000000000000000'
      )

      // Valid address with all f's
      expect(getAddress('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toBe(
        '0xffffffffffffffffffffffffffffffffffffffff'
      )
    })
  })

  describe('fromHex', () => {
    test('should convert hex to number', () => {
      const testCases: Array<{ hex: Hex; expected: number }> = [
        { hex: '0x0', expected: 0 },
        { hex: '0x1', expected: 1 },
        { hex: '0xff', expected: 255 },
        { hex: '0x100', expected: 256 },
        { hex: '0xffff', expected: 65535 },
        { hex: '0x123456', expected: 1193046 },
        { hex: '0x7fffffff', expected: 2147483647 },
      ]

      testCases.forEach(({ hex, expected }) => {
        expect(fromHex(hex)).toBe(expected)
      })
    })

    test('should handle uppercase and lowercase hex', () => {
      expect(fromHex('0xFF')).toBe(255)
      expect(fromHex('0xff')).toBe(255)
      expect(fromHex('0xFf')).toBe(255)
    })
  })

  describe('toHex', () => {
    test('should convert string to hex', () => {
      const testCases: Array<{ input: string; expected: Hex }> = [
        { input: '', expected: '0x' },
        { input: 'a', expected: '0x61' },
        { input: 'hello', expected: '0x68656c6c6f' },
        { input: 'Hello World!', expected: '0x48656c6c6f20576f726c6421' },
        { input: '123', expected: '0x313233' },
        { input: 'привет', expected: '0xd0bfd180d0b8d0b2d0b5d182' },
      ]

      testCases.forEach(({ input, expected }) => {
        expect(toHex(input)).toBe(expected)
      })
    })

    test('should handle special characters', () => {
      expect(toHex('\n')).toBe('0x0a')
      expect(toHex('\t')).toBe('0x09')
      expect(toHex('\r')).toBe('0x0d')
      expect(toHex(' ')).toBe('0x20')
      expect(toHex('!@#$%^&*()')).toBe('0x21402324255e262a2829')
    })
  })

  describe('createSiweMessage', () => {
    const baseMessage: SiweMessage = {
      address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      chainId: 1,
      domain: 'example.com',
      uri: 'https://example.com',
      version: '1',
    }

    test('should create basic SIWE message', () => {
      const message = createSiweMessage(baseMessage)

      expect(message).toContain('example.com wants you to sign in with your Ethereum account:')
      expect(message).toContain('0x742d35cc6634c0532925a3b8d4c9db96c4b4d8b6')
      expect(message).toContain('URI: https://example.com')
      expect(message).toContain('Version: 1')
      expect(message).toContain('Chain ID: 1')
      expect(message).toContain('Issued At:')
    })

    test('should include optional fields when provided', () => {
      const messageWithOptions: SiweMessage = {
        ...baseMessage,
        statement: 'Please sign this message to authenticate',
        nonce: '1234567890',
        expirationTime: new Date('2024-12-31T23:59:59Z'),
        notBefore: new Date('2024-01-01T00:00:00Z'),
        requestId: 'req-123',
        resources: ['https://example.com/resource1', 'https://example.com/resource2'],
        scheme: 'https',
      }

      const message = createSiweMessage(messageWithOptions)

      expect(message).toContain('Please sign this message to authenticate')
      expect(message).toContain('Nonce: 1234567890')
      expect(message).toContain('Expiration Time: 2024-12-31T23:59:59.000Z')
      expect(message).toContain('Not Before: 2024-01-01T00:00:00.000Z')
      expect(message).toContain('Request ID: req-123')
      expect(message).toContain('Resources:')
      expect(message).toContain('- https://example.com/resource1')
      expect(message).toContain('- https://example.com/resource2')
      expect(message).toContain('https://example.com wants you to sign in')
    })

    test('should handle scheme correctly', () => {
      const messageWithScheme: SiweMessage = {
        ...baseMessage,
        scheme: 'https',
      }

      const message = createSiweMessage(messageWithScheme)
      expect(message).toContain('https://example.com wants you to sign in')
    })

    test('should validate chainId', () => {
      const invalidChainId: SiweMessage = {
        ...baseMessage,
        chainId: 1.5, // non-integer
      }

      expect(() => createSiweMessage(invalidChainId)).toThrow(
        '@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: 1.5'
      )
    })

    test('should validate domain', () => {
      const invalidDomain: SiweMessage = {
        ...baseMessage,
        domain: '', // empty domain
      }

      expect(() => createSiweMessage(invalidDomain)).toThrow(
        '@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.'
      )
    })

    test('should validate nonce length', () => {
      const shortNonce: SiweMessage = {
        ...baseMessage,
        nonce: '123', // too short
      }

      expect(() => createSiweMessage(shortNonce)).toThrow(
        '@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: 123'
      )
    })

    test('should validate uri', () => {
      const invalidUri: SiweMessage = {
        ...baseMessage,
        uri: '', // empty uri
      }

      expect(() => createSiweMessage(invalidUri)).toThrow(
        '@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.'
      )
    })

    test('should validate version', () => {
      const invalidVersion: SiweMessage = {
        ...baseMessage,
        version: '2' as any, // invalid version
      }

      expect(() => createSiweMessage(invalidVersion)).toThrow(
        '@supabase/auth-js: Invalid SIWE message field "version". Version must be \'1\'. Provided value: 2'
      )
    })

    test('should validate statement does not contain newlines', () => {
      const invalidStatement: SiweMessage = {
        ...baseMessage,
        statement: 'Line 1\nLine 2', // contains newline
      }

      expect(() => createSiweMessage(invalidStatement)).toThrow(
        '@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include \'\\n\'. Provided value: Line 1\nLine 2'
      )
    })

    test('should validate resources array', () => {
      const invalidResources: SiweMessage = {
        ...baseMessage,
        resources: ['valid-resource', '', 'another-valid'], // contains empty string
      }

      expect(() => createSiweMessage(invalidResources)).toThrow(
        '@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: '
      )
    })

    test('should validate resources are strings', () => {
      const invalidResources: SiweMessage = {
        ...baseMessage,
        resources: ['valid-resource', null as any, 'another-valid'], // contains null
      }

      expect(() => createSiweMessage(invalidResources)).toThrow(
        '@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: null'
      )
    })

    test('should handle empty resources array', () => {
      const messageWithEmptyResources: SiweMessage = {
        ...baseMessage,
        resources: [],
      }

      const message = createSiweMessage(messageWithEmptyResources)
      expect(message).toContain('Resources:')
    })

    test('should format message correctly with all optional fields', () => {
      const fullMessage: SiweMessage = {
        address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        chainId: 137,
        domain: 'polygon.example.com',
        uri: 'https://polygon.example.com/auth',
        version: '1',
        statement: 'Sign in to access your account',
        nonce: 'abcdef1234567890',
        expirationTime: new Date('2024-12-31T23:59:59Z'),
        notBefore: new Date('2024-01-01T00:00:00Z'),
        requestId: 'auth-request-12345',
        resources: ['https://polygon.example.com/api', 'https://polygon.example.com/dashboard'],
        scheme: 'https',
      }

      const message = createSiweMessage(fullMessage)

      // Check the structure
      const lines = message.split('\n')
      expect(lines[0]).toBe(
        'https://polygon.example.com wants you to sign in with your Ethereum account:'
      )
      expect(lines[1]).toBe('0x742d35cc6634c0532925a3b8d4c9db96c4b4d8b6')
      expect(lines[2]).toBe('')
      expect(lines[3]).toBe('Sign in to access your account')
      expect(lines[4]).toBe('')
      expect(lines[5]).toBe('URI: https://polygon.example.com/auth')
      expect(lines[6]).toBe('Version: 1')
      expect(lines[7]).toBe('Chain ID: 137')
      expect(lines[8]).toBe('Nonce: abcdef1234567890')
      expect(lines[9]).toMatch(/^Issued At: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(lines[10]).toBe('Expiration Time: 2024-12-31T23:59:59.000Z')
      expect(lines[11]).toBe('Not Before: 2024-01-01T00:00:00.000Z')
      expect(lines[12]).toBe('Request ID: auth-request-12345')
      expect(lines[13]).toBe('Resources:')
      expect(lines[14]).toBe('- https://polygon.example.com/api')
      expect(lines[15]).toBe('- https://polygon.example.com/dashboard')
    })

    test('should handle issuedAt default value', () => {
      const beforeTest = new Date()
      const message = createSiweMessage(baseMessage)
      const afterTest = new Date()

      const issuedAtMatch = message.match(/Issued At: (.+)/)
      expect(issuedAtMatch).toBeTruthy()

      const issuedAt = new Date(issuedAtMatch![1])
      expect(issuedAt.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime())
      expect(issuedAt.getTime()).toBeLessThanOrEqual(afterTest.getTime())
    })
  })
})
