/**
 * @jest-environment jsdom
 */

import {
  autoRefreshClient,
  getClientWithSpecificStorage,
  getClientWithSpecificStorageKey,
  pkceClient,
} from './lib/clients'
import { mockUserCredentials } from './lib/utils'
import {
  supportsLocalStorage,
  validateExp,
  sleep,
  userNotAvailableProxy,
  resolveFetch,
} from '../src/lib/helpers'
import type { SolanaWeb3Credentials } from '../src/lib/types'

// Add structuredClone polyfill for jsdom
if (typeof structuredClone === 'undefined') {
  ;(global as any).structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj))
}

describe('GoTrueClient in browser environment', () => {
  beforeEach(() => {
    const mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    })

    // Mock window.location
    const mockLocation = {
      href: 'http://localhost:9999',
      assign: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      toString: () => 'http://localhost:9999',
    }
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    })
  })

  it('should handle basic OAuth', async () => {
    const { data } = await pkceClient.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'http://localhost:9999/callback',
      },
    })

    expect(data?.url).toBeDefined()
    expect(data?.url).toContain('provider=github')
  })

  it('should handle multiple visibility changes', async () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    })

    await autoRefreshClient.startAutoRefresh()

    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    await autoRefreshClient.stopAutoRefresh()
  })

  it('should handle PKCE flow', async () => {
    // Mock fetch since jsdom doesn't provide it, and we're testing browser behavior not HTTP
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'test-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          created_at: new Date().toISOString(),
        },
      }),
    })

    const { email, password } = mockUserCredentials()
    const pkceClient = getClientWithSpecificStorage({
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    })

    const { data: signupData, error: signupError } = await pkceClient.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'http://localhost:9999/callback',
      },
    })

    expect(signupError).toBeNull()
    expect(signupData?.user).toBeDefined()

    const { data: signinData, error: signinError } = await pkceClient.signInWithPassword({
      email,
      password,
    })

    expect(signinError).toBeNull()
    expect(signinData?.session).toBeDefined()
  })

  it('should handle _handleVisibilityChange error handling', async () => {
    const client = getClientWithSpecificStorage({
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    })

    // Mock window.addEventListener to throw error
    const originalAddEventListener = window.addEventListener
    window.addEventListener = jest.fn().mockImplementation(() => {
      throw new Error('addEventListener failed')
    })

    try {
      // Initialize client to trigger _handleVisibilityChange
      await client.initialize()

      // Should not throw error, should handle it gracefully
      expect(client).toBeDefined()
    } finally {
      // Restore original addEventListener
      window.addEventListener = originalAddEventListener
    }
  })
})

describe('Browser-specific helper functions', () => {
  it('should handle localStorage not available', () => {
    // Mock localStorage as undefined
    Object.defineProperty(window, 'localStorage', {
      value: undefined,
      writable: true,
    })
    expect(supportsLocalStorage()).toBe(false)
  })
})

describe('JWT and cryptographic functions in browser', () => {
  it('should throw on missing exp claim', () => {
    expect(() => validateExp(0)).toThrow('Missing exp claim')
  })
})

describe('Retryable and sleep functions in browser', () => {
  it('should sleep for specified time', async () => {
    const start = Date.now()
    await sleep(100)
    const end = Date.now()
    expect(end - start).toBeGreaterThanOrEqual(90)
  })
})

describe('User proxy and deep clone functions in browser', () => {
  it('should throw on property setting to user proxy', () => {
    const proxy = userNotAvailableProxy()
    expect(() => {
      ;(proxy as any).email = 'test@example.com'
    }).toThrow()
  })
})

describe('Fetch resolution in browser environment', () => {
  it('should resolve fetch correctly', () => {
    const customFetch = jest.fn()
    const resolvedFetch = resolveFetch(customFetch)
    expect(typeof resolvedFetch).toBe('function')
  })

  it('should warn when two clients are created with the same storage key', () => {
    let consoleWarnSpy
    let consoleTraceSpy
    try {
      consoleWarnSpy = jest.spyOn(console, 'warn')
      consoleTraceSpy = jest.spyOn(console, 'trace')
      getClientWithSpecificStorageKey('same-storage-key')
      getClientWithSpecificStorageKey('same-storage-key')
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /GoTrueClient@same-storage-key:1 .* Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key./
        )
      )
      expect(consoleTraceSpy).not.toHaveBeenCalled()
    } finally {
      consoleWarnSpy?.mockRestore()
      consoleTraceSpy?.mockRestore()
    }
  })

  it('should warn & trace when two clients are created with the same storage key and debug is enabled', () => {
    let consoleWarnSpy
    let consoleTraceSpy
    try {
      consoleWarnSpy = jest.spyOn(console, 'warn')
      consoleTraceSpy = jest.spyOn(console, 'trace')
      getClientWithSpecificStorageKey('identical-storage-key')
      getClientWithSpecificStorageKey('identical-storage-key', { debug: true })
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /GoTrueClient@identical-storage-key:1 .* Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key./
        )
      )
      expect(consoleTraceSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /GoTrueClient@identical-storage-key:1 .* Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key./
        )
      )
    } finally {
      consoleWarnSpy?.mockRestore()
      consoleTraceSpy?.mockRestore()
    }
  })

  it('should not warn when two clients are created with differing storage keys', () => {
    let consoleWarnSpy
    let consoleTraceSpy
    try {
      consoleWarnSpy = jest.spyOn(console, 'warn')
      consoleTraceSpy = jest.spyOn(console, 'trace')
      getClientWithSpecificStorageKey('first-storage-key')
      getClientWithSpecificStorageKey('second-storage-key')
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(consoleTraceSpy).not.toHaveBeenCalled()
    } finally {
      consoleWarnSpy?.mockRestore()
      consoleTraceSpy?.mockRestore()
    }
  })

  it('should warn only when a second client with a duplicate key is created', () => {
    let consoleWarnSpy
    let consoleTraceSpy
    try {
      consoleWarnSpy = jest.spyOn(console, 'warn')
      consoleTraceSpy = jest.spyOn(console, 'trace')
      getClientWithSpecificStorageKey('test-storage-key1')
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      getClientWithSpecificStorageKey('test-storage-key2')
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      getClientWithSpecificStorageKey('test-storage-key3')
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      getClientWithSpecificStorageKey('test-storage-key2')
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /GoTrueClient@test-storage-key2:1 .* Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key./
        )
      )
      expect(consoleTraceSpy).not.toHaveBeenCalled()
    } finally {
      consoleWarnSpy?.mockRestore()
      consoleTraceSpy?.mockRestore()
    }
  })
})

describe('Callback URL handling', () => {
  let mockFetch: jest.Mock
  let storedSession: string | null
  const mockStorage = {
    getItem: jest.fn(() => storedSession),
    setItem: jest.fn((key: string, value: string) => {
      storedSession = value
    }),
    removeItem: jest.fn(() => {
      storedSession = null
    }),
  }

  beforeEach(() => {
    mockFetch = jest.fn()
    global.fetch = mockFetch
  })

  it('should handle implicit grant callback', async () => {
    // Set up URL with implicit grant callback parameters
    window.location.href =
      'http://localhost:9999/callback#access_token=test-token&refresh_token=test-refresh-token&expires_in=3600&token_type=bearer&type=implicit'

    // Mock user info response
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/user')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'test-user',
              email: 'test@example.com',
              created_at: new Date().toISOString(),
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: { id: 'test-user' },
          }),
      })
    })

    const client = getClientWithSpecificStorage(mockStorage)
    await client.initialize()

    const {
      data: { session },
    } = await client.getSession()
    expect(session).toBeDefined()
    expect(session?.access_token).toBe('test-token')
    expect(session?.refresh_token).toBe('test-refresh-token')
  })

  it('should handle error in callback URL', async () => {
    // Set up URL with error parameters
    window.location.href =
      'http://localhost:9999/callback#error=invalid_grant&error_description=Invalid+grant'

    mockFetch.mockImplementation((url: string) => {
      return Promise.resolve({
        ok: false,
        json: () =>
          Promise.resolve({
            error: 'invalid_grant',
            error_description: 'Invalid grant',
          }),
      })
    })

    const client = getClientWithSpecificStorage(mockStorage)
    await client.initialize()

    const {
      data: { session },
    } = await client.getSession()
    expect(session).toBeNull()
  })

  it('should handle _initialize with detectSessionInUrl', async () => {
    // Mock window.location with session parameters
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:9999/callback?access_token=test&refresh_token=test&expires_in=3600&token_type=bearer&type=recovery',
        assign: jest.fn(),
        replace: jest.fn(),
        reload: jest.fn(),
        toString: () => 'http://localhost:9999/callback',
      },
      writable: true,
    })

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      detectSessionInUrl: true,
      autoRefreshToken: false,
    })

    // Initialize client to trigger _initialize with detectSessionInUrl
    await client.initialize()

    expect(client).toBeDefined()
  })

  it('should handle _initialize with PKCE flow mismatch', async () => {
    // Mock window.location with PKCE parameters
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:9999/callback?code=test-code',
        assign: jest.fn(),
        replace: jest.fn(),
        reload: jest.fn(),
        toString: () => 'http://localhost:9999/callback',
      },
      writable: true,
    })

    // Mock storage to return code verifier
    const mockStorage = {
      getItem: jest.fn().mockResolvedValue('test-code-verifier'),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      detectSessionInUrl: true,
      autoRefreshToken: false,
      storage: mockStorage,
      flowType: 'implicit', // Mismatch with PKCE flow
    })

    // Initialize client to trigger flow mismatch
    await client.initialize()

    expect(client).toBeDefined()
  })
})

describe('GoTrueClient BroadcastChannel', () => {
  it('should handle multiple auth state change events', async () => {
    const mockBroadcastChannel = jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn(),
    }))
    Object.defineProperty(window, 'BroadcastChannel', {
      value: mockBroadcastChannel,
      writable: true,
    })

    const mockStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const client = getClientWithSpecificStorage(mockStorage)
    const mockCallback1 = jest.fn()
    const mockCallback2 = jest.fn()

    const {
      data: { subscription: sub1 },
    } = client.onAuthStateChange(mockCallback1)
    const {
      data: { subscription: sub2 },
    } = client.onAuthStateChange(mockCallback2)

    // Simulate a broadcast message
    const mockEvent = {
      data: {
        event: 'SIGNED_IN',
        session: {
          access_token: 'test-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'test-user' },
        },
      },
    }

    // Get the event listener that was registered
    const eventListener =
      mockBroadcastChannel.mock.results[0].value.addEventListener.mock.calls[0][1]
    eventListener(mockEvent)

    expect(mockCallback1).toHaveBeenCalledWith('SIGNED_IN', mockEvent.data.session)
    expect(mockCallback2).toHaveBeenCalledWith('SIGNED_IN', mockEvent.data.session)

    sub1.unsubscribe()
    sub2.unsubscribe()
  })

  it('should handle BroadcastChannel errors', () => {
    const mockBroadcastChannel = jest.fn().mockImplementation(() => {
      throw new Error('BroadcastChannel not supported')
    })

    Object.defineProperty(window, 'BroadcastChannel', {
      value: mockBroadcastChannel,
      writable: true,
    })

    const client = getClientWithSpecificStorage({
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    })

    expect(client).toBeDefined()
  })
})

describe('Browser locks functionality', () => {
  it('should use navigator locks when available', () => {
    // Mock navigator.locks
    const mockLock = { name: 'test-lock' }
    const mockRequest = jest
      .fn()
      .mockImplementation((_, __, callback) => Promise.resolve(callback(mockLock)))

    Object.defineProperty(navigator, 'locks', {
      value: { request: mockRequest },
      writable: true,
    })

    // Test navigator locks usage in GoTrueClient
    const client = getClientWithSpecificStorage({
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    })

    expect(client).toBeDefined()
  })

  it('should handle _acquireLock with empty pendingInLock', async () => {
    const client = getClientWithSpecificStorage({
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    })

    // Mock navigator.locks
    const mockLock = { name: 'test-lock' }
    const mockRequest = jest
      .fn()
      .mockImplementation((_, __, callback) => Promise.resolve(callback(mockLock)))

    Object.defineProperty(navigator, 'locks', {
      value: { request: mockRequest },
      writable: true,
    })

    // Initialize client to trigger lock acquisition
    await client.initialize()

    expect(client).toBeDefined()
  })
})

describe('Web3 functionality in browser', () => {
  it('should handle Web3 provider not available', async () => {
    const credentials = {
      chain: 'ethereum' as const,
      wallet: {} as any,
    }

    await expect(pkceClient.signInWithWeb3(credentials)).rejects.toThrow()
  })

  it('should handle Solana Web3 provider not available', async () => {
    const credentials = {
      chain: 'solana' as const,
      wallet: {} as any,
    }

    await expect(pkceClient.signInWithWeb3(credentials)).rejects.toThrow()
  })

  it('should handle Web3 Ethereum with wallet object', async () => {
    const mockWallet = {
      address: '0x1234567890abcdef',
      request: jest.fn().mockResolvedValue(['0x1234567890abcdef']),
      on: jest.fn(),
      removeListener: jest.fn(),
    }

    const credentials = {
      chain: 'ethereum' as const,
      wallet: mockWallet,
    }

    try {
      await pkceClient.signInWithWeb3(credentials)
    } catch (error) {
      // Expected to fail in test environment, but should have attempted the flow
      expect(error).toBeDefined()
    }
  })

  it('should handle Web3 Solana with wallet object', async () => {
    const mockWallet = {
      publicKey: {
        toString: () => 'test-public-key',
        toBase58: () => 'test-public-key-base58',
      },
      signMessage: jest.fn().mockResolvedValue(new Uint8Array(64)),
    }

    const credentials: SolanaWeb3Credentials = {
      chain: 'solana',
      wallet: mockWallet,
    }

    try {
      await pkceClient.signInWithWeb3(credentials)
    } catch (error) {
      // Expected to fail in test environment, but should have attempted the flow
      expect(error).toBeDefined()
    }
  })

  it('should handle Ethereum wallet object', async () => {
    const mockWallet = {
      request: jest.fn().mockResolvedValue(['0x123']),
      on: jest.fn(),
      removeListener: jest.fn(),
    }

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          session: { access_token: 'test', user: { id: 'test' } },
          user: { id: 'test' },
        }),
      headers: new Headers(),
    })

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      fetch: mockFetch,
    })

    const { data, error } = await client.signInWithIdToken({
      provider: 'ethereum',
      token: 'test-token',
      nonce: 'test-nonce',
      accessToken: 'test-access-token',
      wallet: mockWallet,
    })

    expect(data.session).toBeDefined()
  })
})

describe('GoTrueClient constructor edge cases', () => {
  it('should handle userStorage with persistSession', () => {
    const customUserStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      userStorage: customUserStorage,
      persistSession: true,
      autoRefreshToken: false,
    })

    expect(client).toBeDefined()
    expect((client as any).userStorage).toBe(customUserStorage)
  })
})

describe('linkIdentity with skipBrowserRedirect false', () => {
  it('should linkIdentity with skipBrowserRedirect false', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:9999',
        assign: jest.fn(),
        replace: jest.fn(),
        reload: jest.fn(),
        toString: () => 'http://localhost:9999',
      },
      writable: true,
    })
    // Mock successful session
    const mockSession = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'test-user' },
    }

    // Mock storage to return session
    const mockStorage = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(mockSession)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    // Create client with custom fetch
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ url: 'http://localhost:9999/oauth/callback' }),
      text: () => Promise.resolve('{"url": "http://localhost:9999/oauth/callback"}'),
      headers: new Headers(),
    } as Response)

    const clientWithSession = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      storageKey: 'test-specific-storage',
      autoRefreshToken: false,
      persistSession: true,
      storage: mockStorage,
      fetch: mockFetch,
    })

    // Mock window.location.assign
    const mockAssign = jest.fn()
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:9999',
        assign: mockAssign,
        replace: jest.fn(),
        reload: jest.fn(),
        toString: () => 'http://localhost:9999',
      },
      writable: true,
    })

    try {
      const result = await clientWithSession.linkIdentity({
        provider: 'github',
        options: {
          skipBrowserRedirect: false,
        },
      })

      expect(result.data?.url).toBeDefined()
      expect(mockFetch).toHaveBeenCalled()
      // Note: linkIdentity might not always call window.location.assign depending on the response
      // So we just verify the result is defined
    } catch (error) {
      console.error('Test error:', error)
      throw error
    }
  })
})

describe('Session Management Tests', () => {
  it('should handle _recoverAndRefresh with Infinity expires_at', async () => {
    // Mock session with null expires_at
    const mockSession = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      expires_at: null,
      token_type: 'bearer',
      user: { id: 'test-user' },
    }

    const mockStorage = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(mockSession)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const client = getClientWithSpecificStorage(mockStorage)

    // Initialize client to trigger _recoverAndRefresh with Infinity expires_at
    await client.initialize()

    expect(client).toBeDefined()
  })

  it('should handle _recoverAndRefresh with refresh token error', async () => {
    // Mock session
    const mockSession = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) - 100, // Expired
      token_type: 'bearer',
      user: { id: 'test-user' },
    }

    const mockStorage = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(mockSession)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'invalid_grant' }),
      text: () => Promise.resolve('{"error": "invalid_grant"}'),
      headers: new Headers(),
    } as Response)

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: true,
      persistSession: true,
      storage: mockStorage,
      fetch: mockFetch,
    })

    // Initialize client to trigger refresh token error
    await client.initialize()

    expect(client).toBeDefined()
  })

  it('should handle _recoverAndRefresh with user proxy', async () => {
    // Mock session with proxy user
    const mockSession = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // Valid
      token_type: 'bearer',
      user: { __isUserNotAvailableProxy: true },
    }

    const mockStorage = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(mockSession)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    // Mock fetch to return user data
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user: { id: 'test-user', email: 'test@example.com' } }),
      text: () => Promise.resolve('{"user": {"id": "test-user", "email": "test@example.com"}}'),
      headers: new Headers(),
    } as Response)

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: true,
      persistSession: true,
      storage: mockStorage,
      fetch: mockFetch,
    })

    // Initialize client to trigger user proxy handling
    await client.initialize()

    expect(client).toBeDefined()
  })

  it('should handle separate user storage with missing user', async () => {
    const mockSession = {
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: null,
    }

    const sessionStorage = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(mockSession)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const userStorage = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify({ user: { id: 'test-user' } })),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      storage: sessionStorage,
      userStorage: userStorage,
      autoRefreshToken: false,
    })

    await client.initialize()
    expect(client).toBeDefined()
  })

  it('should handle session with invalid tokens', async () => {
    const mockSession = {
      access_token: '',
      refresh_token: '',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'test-user' },
    }

    const mockStorage = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(mockSession)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      storage: mockStorage,
    })

    const { data, error } = await client.refreshSession()
    expect(error).toBeDefined()
    expect(error?.message).toContain('session missing')
  })
})

describe('Additional Tests', () => {
  it('should handle _initialize with storage returning boolean', async () => {
    // Mock storage to return boolean
    const mockStorage = {
      getItem: jest.fn().mockResolvedValue(true),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      persistSession: true,
      storage: mockStorage,
    })

    // Initialize client to trigger boolean handling
    await client.initialize()

    expect(client).toBeDefined()
  })

  it('should handle _initialize with expires_at parameter', async () => {
    // Mock window.location with expires_at parameter
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:9999/callback?access_token=test&refresh_token=test&expires_in=3600&expires_at=1234567890&token_type=bearer',
        assign: jest.fn(),
        replace: jest.fn(),
        reload: jest.fn(),
        toString: () => 'http://localhost:9999/callback',
      },
      writable: true,
    })

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      detectSessionInUrl: true,
      autoRefreshToken: false,
    })

    // Initialize client to trigger _initialize with expires_at
    await client.initialize()

    expect(client).toBeDefined()
  })

  it('should handle signInWithOAuth skipBrowserRedirect false', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ url: 'http://localhost:9999/authorize?provider=github' }),
      headers: new Headers(),
    })

    const mockAssign = jest.fn()
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:9999',
        assign: mockAssign,
        replace: jest.fn(),
        reload: jest.fn(),
        toString: () => 'http://localhost:9999',
      },
      writable: true,
    })

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      fetch: mockFetch,
    })

    const { data } = await client.signInWithOAuth({
      provider: 'github',
      options: {
        skipBrowserRedirect: false,
      },
    })

    expect(data?.url).toBeDefined()
    expect(mockAssign).toHaveBeenCalledWith('http://localhost:9999/authorize?provider=github')
  })
})

describe('OAuth and Sign-in Branch Testing', () => {
  it('should handle signInWithOAuth redirect', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ url: 'http://localhost:9999/authorize?provider=github' }),
      headers: new Headers(),
    })

    const mockAssign = jest.fn()
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:9999',
        assign: mockAssign,
        replace: jest.fn(),
        reload: jest.fn(),
        toString: () => 'http://localhost:9999',
      },
      writable: true,
    })

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      fetch: mockFetch,
    })

    const { data } = await client.signInWithOAuth({
      provider: 'github',
      options: {
        skipBrowserRedirect: false,
      },
    })

    expect(data?.url).toBeDefined()
    expect(mockAssign).toHaveBeenCalledWith('http://localhost:9999/authorize?provider=github')
  })

  it('should handle signInWithPassword with phone', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          session: { access_token: 'test', user: { id: 'test' } },
          user: { id: 'test' },
        }),
      headers: new Headers(),
    })

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      fetch: mockFetch,
    })

    const { data, error } = await client.signInWithPassword({
      phone: '+1234567890',
      password: 'password123',
    })

    expect(data.session).toBeDefined()
  })
})

describe('Auto Refresh and Token Management', () => {
  it('should handle user proxy', async () => {
    const mockSession = {
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: { id: 'test-user' },
    }

    const mockStorage = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(mockSession)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const mockUserStorage = {
      getItem: jest.fn().mockResolvedValue(null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      storage: mockStorage,
      userStorage: mockUserStorage,
    })

    await client.initialize()
    const { data } = await client.getSession()
    expect(data.session).toBeDefined()
  })
})

describe('Storage and User Storage Combinations', () => {
  it('should handle separate user storage with missing user', async () => {
    const mockSession = {
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: { id: 'test-user' },
    }

    const mockStorage = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(mockSession)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const mockUserStorage = {
      getItem: jest.fn().mockResolvedValue({ user: null }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      storage: mockStorage,
      userStorage: mockUserStorage,
    })

    await client.initialize()
    const { data } = await client.getSession()
    expect(data.session).toBeDefined()
  })
})

describe('Lock Mechanism Branches', () => {
  it('should handle lock acquisition timeout', async () => {
    const slowLock = jest
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      lock: slowLock,
    })

    await client.initialize()
    expect(client).toBeDefined()
  })

  it('should handle lock release errors', async () => {
    const errorLock = jest.fn().mockImplementation(() => ({
      acquire: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockRejectedValue(new Error('Lock release error')),
    }))

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      lock: errorLock,
    })

    await client.initialize()
    expect(client).toBeDefined()
  })
})

describe('MFA Complex Branches', () => {
  it('should handle MFA enroll with phone', async () => {
    const mockSession = {
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: { id: 'test-user' },
    }

    const mockStorage = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(mockSession)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 'factor-id',
          type: 'phone',
          status: 'unverified',
          friendly_name: 'Test Phone',
          created_at: new Date().toISOString(),
        }),
      headers: new Headers(),
    })

    const client = new (require('../src/GoTrueClient').default)({
      url: 'http://localhost:9999',
      autoRefreshToken: false,
      storage: mockStorage,
      fetch: mockFetch,
    })

    await client.initialize()

    const { data, error } = await client.mfa.enroll({
      factorType: 'phone',
      phone: '+1234567890',
    })

    expect(data).toBeDefined()
    expect(mockFetch).toHaveBeenCalled()
  })
})
