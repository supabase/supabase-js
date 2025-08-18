/**
 * @jest-environment jsdom
 */

import { autoRefreshClient, getClientWithSpecificStorage, pkceClient } from './lib/clients'
import { mockUserCredentials } from './lib/utils'
import {
  supportsLocalStorage,
  validateExp,
  sleep,
  userNotAvailableProxy,
  resolveFetch,
} from '../src/lib/helpers'

// Add structuredClone polyfill for jsdom
if (typeof structuredClone === 'undefined') {
  ; (global as any).structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj))
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
      (proxy as any).email = 'test@example.com'
    }).toThrow()
  })
})

describe('Fetch resolution in browser environment', () => {
  it('should resolve fetch correctly', () => {
    const customFetch = jest.fn()
    const resolvedFetch = resolveFetch(customFetch)
    expect(typeof resolvedFetch).toBe('function')
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
    const mockRequest = jest.fn().mockImplementation((_, __, callback) =>
      Promise.resolve(callback(mockLock))
    )

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
