import { PostgrestClient } from '@supabase/postgrest-js'
import { createClient, SupabaseClient } from '../../src/index'
import { Database } from '../types'

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'

describe('SupabaseClient', () => {
  test('it should create a client with third-party auth accessToken', async () => {
    const client = createClient(URL, KEY, {
      accessToken: async () => {
        return 'jwt'
      },
    })

    expect(() => client.auth.getUser()).toThrow(
      '@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.getUser is not possible'
    )
  })

  test('it should create the client connection', async () => {
    const supabase = createClient(URL, KEY)
    expect(supabase).toBeDefined()
    expect(supabase).toBeInstanceOf(SupabaseClient)
  })

  test('it should throw an error if no valid params are provided', async () => {
    expect(() => createClient('', KEY)).toThrow('supabaseUrl is required.')
    expect(() => createClient(URL, '')).toThrow('supabaseKey is required.')
  })

  test('should validate supabaseUrl', () => {
    expect(() => createClient('https://xyz123.supabase.co', KEY)).not.toThrow()
    expect(() => createClient('http://localhost:54321', KEY)).not.toThrow()
    expect(() => createClient('http://[invalid', KEY)).toThrow(
      'Invalid supabaseUrl: Provided URL is malformed.'
    )
    expect(() =>
      createClient('postgresql://postgre:password@db.test.co:5432/postgres', KEY)
    ).toThrow('Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.')
    expect(() => createClient('http:/localhost:3000', KEY)).toThrow(
      'Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.'
    )

    expect(() => createClient('  https://xyz123.supabase.co  ', KEY)).not.toThrow()
    expect(() => createClient('http://user:pass@localhost:54321', KEY)).not.toThrow()
  })

  describe('URL Construction', () => {
    test('should construct URLs correctly', () => {
      const client = createClient(URL, KEY)

      // @ts-ignore
      expect(client.authUrl.toString()).toEqual('http://localhost:3000/auth/v1')
      // @ts-ignore
      expect(client.realtimeUrl.toString()).toEqual('ws://localhost:3000/realtime/v1')
      // @ts-ignore
      expect(client.storageUrl.toString()).toEqual('http://localhost:3000/storage/v1')
      // @ts-ignore
      expect(client.functionsUrl.toString()).toEqual('http://localhost:3000/functions/v1')
      // @ts-ignore
      expect(client.rest.url).toEqual('http://localhost:3000/rest/v1')
    })

    test('should preserve paths in supabaseUrl', () => {
      const baseUrlWithPath = 'http://localhost:3000/custom/base'
      const client = createClient(baseUrlWithPath, KEY)

      // @ts-ignore
      expect(client.authUrl.toString()).toEqual('http://localhost:3000/custom/base/auth/v1')
      // @ts-ignore
      expect(client.realtimeUrl.toString()).toEqual('ws://localhost:3000/custom/base/realtime/v1')
      // @ts-ignore
      expect(client.storageUrl.toString()).toEqual('http://localhost:3000/custom/base/storage/v1')
      // @ts-ignore
      expect(client.functionsUrl.toString()).toEqual(
        'http://localhost:3000/custom/base/functions/v1'
      )
      // @ts-ignore
      expect(client.rest.url).toEqual('http://localhost:3000/custom/base/rest/v1')
    })

    test('should handle HTTPS URLs correctly', () => {
      const client = createClient('https://localhost:3000', KEY)
      // @ts-ignore
      expect(client.realtimeUrl.toString()).toEqual('wss://localhost:3000/realtime/v1')
    })
  })

  describe('Custom Headers', () => {
    test('should have custom header set', () => {
      const customHeader = { 'X-Test-Header': 'value' }
      const request = createClient(URL, KEY, { global: { headers: customHeader } }).rpc('')
      //@ts-expect-error headers is protected attribute
      const requestHeader = request.headers.get('X-Test-Header')
      expect(requestHeader).toBe(customHeader['X-Test-Header'])
    })

    test('should merge custom headers with default headers', () => {
      const customHeader = { 'X-Test-Header': 'value' }
      const request = createClient(URL, KEY, { global: { headers: customHeader } }).rpc('')

      //@ts-expect-error headers is protected attribute
      const requestHeader = request.headers.get('X-Test-Header')
      expect(requestHeader).toBe(customHeader['X-Test-Header'])
      //@ts-expect-error headers is protected attribute
      expect(request.headers.get('X-Client-Info')).not.toBeNull()
    })
  })

  describe('Storage Key', () => {
    test('should use default storage key based on project ref', () => {
      const client = createClient('https://project-ref.supabase.co', KEY)
      // @ts-ignore
      expect(client.storageKey).toBe('sb-project-ref-auth-token')
    })

    test('should use custom storage key when provided', () => {
      const customStorageKey = 'custom-storage-key'
      const client = createClient(URL, KEY, {
        auth: { storageKey: customStorageKey },
      })
      // @ts-ignore
      expect(client.storageKey).toBe(customStorageKey)
    })

    test('should handle undefined storageKey and headers', () => {
      const client = createClient(URL, KEY, {
        auth: { storageKey: undefined },
        global: { headers: undefined },
      })
      expect(client).toBeDefined()
      // @ts-ignore
      expect(client.storageKey).toBe('')
      // @ts-ignore
      expect(client.headers).toHaveProperty('X-Client-Info')
    })
  })

  describe('Client Methods', () => {
    test('should initialize functions client', () => {
      const client = createClient(URL, KEY)
      const functions = client.functions
      expect(functions).toBeDefined()
      // @ts-ignore
      expect(functions.url).toBe('http://localhost:3000/functions/v1')
    })

    test('should initialize storage client', () => {
      const client = createClient(URL, KEY)
      const storage = client.storage
      expect(storage).toBeDefined()
      // @ts-ignore
      expect(storage.url).toBe('http://localhost:3000/storage/v1')
    })

    test('should initialize realtime client', () => {
      const client = createClient(URL, KEY)
      expect(client.realtime).toBeDefined()
      // @ts-ignore
      expect(client.realtime.endPoint).toBe('ws://localhost:3000/realtime/v1/websocket')
    })
  })

  describe('Realtime Channel Management', () => {
    test('should create and manage channels', () => {
      const client = createClient(URL, KEY)
      const channel = client.channel('test-channel')
      expect(channel).toBeDefined()
      expect(client.getChannels()).toHaveLength(1)
    })

    test('should remove channel', async () => {
      const client = createClient(URL, KEY)
      const channel = client.channel('test-channel')
      const result = await client.removeChannel(channel)
      expect(result).toBe('ok')
      expect(client.getChannels()).toHaveLength(0)
    })

    test('should remove all channels', async () => {
      const client = createClient(URL, KEY)
      client.channel('channel1')
      client.channel('channel2')
      const results = await client.removeAllChannels()
      expect(results).toEqual(['ok', 'ok'])
      expect(client.getChannels()).toHaveLength(0)
    })
  })

  describe('Schema Management', () => {
    test('should switch schema', () => {
      const client = createClient<Database>(URL, KEY)
      const schemaClient = client.schema('personal')
      expect(schemaClient).toBeDefined()
      expect(schemaClient).toBeInstanceOf(PostgrestClient)
    })
  })

  describe('Table/View Queries', () => {
    test('should query table with string relation', () => {
      const client = createClient<Database>(URL, KEY)
      const queryBuilder = client.from('users')
      expect(queryBuilder).toBeDefined()
    })
  })

  describe('RPC Calls', () => {
    test('should make RPC call with arguments', () => {
      const client = createClient<Database>(URL, KEY)
      const rpcCall = client.rpc('get_status', { name_param: 'test' })
      expect(rpcCall).toBeDefined()
    })

    test('should make RPC call with options', () => {
      const client = createClient<Database>(URL, KEY)
      const rpcCall = client.rpc('get_status', { name_param: 'test' }, { head: true })
      expect(rpcCall).toBeDefined()
    })
  })

  describe('Token Management', () => {
    describe('Token Resolution', () => {
      test('should resolve token from session', async () => {
        const expectedToken = 'test-jwt-token'
        const client = createClient(URL, KEY)

        client.auth.getSession = jest.fn().mockResolvedValue({
          data: { session: { access_token: expectedToken } },
        })

        // @ts-ignore - accessing private method
        const token = await client._getAccessToken()
        expect(token).toBe(expectedToken)
      })

      test('should use custom accessToken callback', async () => {
        const customToken = 'custom-access-token'
        const customAccessTokenFn = jest.fn().mockResolvedValue(customToken)
        const client = createClient(URL, KEY, { accessToken: customAccessTokenFn })

        // @ts-ignore - accessing private method
        const token = await client._getAccessToken()
        expect(token).toBe(customToken)
        expect(customAccessTokenFn).toHaveBeenCalled()
      })

      test('should fallback to supabaseKey when no session available', async () => {
        const client = createClient(URL, KEY)

        client.auth.getSession = jest.fn().mockResolvedValue({
          data: { session: null },
        })

        // @ts-ignore - accessing private method
        const token = await client._getAccessToken()
        expect(token).toBe(KEY)
      })
    })

    describe('Realtime Authentication', () => {
      afterEach(() => {
        jest.clearAllMocks()
      })

      test('should automatically call setAuth() when accessToken option is provided', async () => {
        const customToken = 'custom-jwt-token'
        const customAccessTokenFn = jest.fn().mockResolvedValue(customToken)

        const client = createClient(URL, KEY, { accessToken: customAccessTokenFn })
        const setAuthSpy = jest.spyOn(client.realtime, 'setAuth')

        // Wait for the constructor's async operation to complete
        await Promise.resolve()

        expect(setAuthSpy).toHaveBeenCalledWith(customToken)
        expect(customAccessTokenFn).toHaveBeenCalled()

        // Clean up
        setAuthSpy.mockRestore()
        client.realtime.disconnect()
      })

      test('should automatically populate token in channels when using custom JWT', async () => {
        const customToken = 'custom-channel-token'
        const customAccessTokenFn = jest.fn().mockResolvedValue(customToken)
        const client = createClient(URL, KEY, { accessToken: customAccessTokenFn })

        // The token should be available through the accessToken function
        const realtimeToken = await client.realtime.accessToken!()
        expect(realtimeToken).toBe(customToken)
        expect(customAccessTokenFn).toHaveBeenCalled()

        // Clean up
        client.realtime.disconnect()
      })

      test('should handle errors gracefully when accessToken callback fails', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const error = new Error('Token fetch failed')
        const failingAccessTokenFn = jest.fn().mockRejectedValue(error)

        const client = createClient(URL, KEY, { accessToken: failingAccessTokenFn })

        // Wait for the promise to reject and warning to be logged
        await Promise.resolve()
        await Promise.resolve()

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Failed to set initial Realtime auth token:',
          error
        )
        expect(client).toBeDefined()
        expect(client.realtime).toBeDefined()

        consoleWarnSpy.mockRestore()
        client.realtime.disconnect()
      })

      test('should not call setAuth() automatically in normal mode', () => {
        const client = createClient(URL, KEY)
        const setAuthSpy = jest.spyOn(client.realtime, 'setAuth')

        // In normal mode (no accessToken option), setAuth should not be called immediately
        expect(setAuthSpy).not.toHaveBeenCalled()

        setAuthSpy.mockRestore()
        client.realtime.disconnect()
      })

      test('should provide access token to realtime client', async () => {
        const expectedToken = 'test-jwt-token'
        const client = createClient(URL, KEY)

        client.auth.getSession = jest.fn().mockResolvedValue({
          data: { session: { access_token: expectedToken } },
        })

        const realtimeToken = await client.realtime.accessToken!()
        expect(realtimeToken).toBe(expectedToken)
      })

      test('should handle authentication state changes', async () => {
        const client = createClient(URL, KEY)
        const setAuthSpy = jest.spyOn(client.realtime, 'setAuth')

        // @ts-ignore - accessing private method for testing
        client._handleTokenChanged('TOKEN_REFRESHED', 'CLIENT', 'new-token')
        expect(setAuthSpy).toHaveBeenCalledWith('new-token')

        setAuthSpy.mockClear()

        // @ts-ignore - accessing private method for testing
        client._handleTokenChanged('SIGNED_IN', 'CLIENT', 'signin-token')
        expect(setAuthSpy).toHaveBeenCalledWith('signin-token')

        setAuthSpy.mockClear()

        // @ts-ignore - accessing private method for testing
        client._handleTokenChanged('SIGNED_OUT', 'CLIENT')
        expect(setAuthSpy).toHaveBeenCalledWith()
      })

      test('should update token in realtime client when setAuth is called', async () => {
        const client = createClient(URL, KEY)
        const testToken = 'test-realtime-token'

        client.realtime.setAuth = jest.fn(async (token) => {
          if (token) {
            ;(client.realtime as any).accessTokenValue = token
          } else {
            const freshToken = await client.realtime.accessToken!()
            ;(client.realtime as any).accessTokenValue = freshToken
          }
        })

        await client.realtime.setAuth(testToken)
        expect(client.realtime.setAuth).toHaveBeenCalledWith(testToken)
        expect((client.realtime as any).accessTokenValue).toBe(testToken)
      })
    })

    describe('FetchWithAuth Token Integration', () => {
      test('should pass correct token to fetchWithAuth wrapper', async () => {
        const expectedToken = 'test-fetch-token'
        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        })

        const client = createClient(URL, KEY, {
          global: { fetch: mockFetch },
        })

        client.auth.getSession = jest.fn().mockResolvedValue({
          data: { session: { access_token: expectedToken } },
        })

        await client.from('test').select('*')

        expect(mockFetch).toHaveBeenCalled()
        const [, options] = mockFetch.mock.calls[0]
        expect(options.headers.get('Authorization')).toBe(`Bearer ${expectedToken}`)
        expect(options.headers.get('apikey')).toBe(KEY)
      })

      test('should work across all fetchWithAuth services', async () => {
        const expectedToken = 'test-multi-service-token'
        const mockFetch = jest
          .fn()
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // rest
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) }) // storage
          .mockResolvedValueOnce({
            ok: true,
            text: () => Promise.resolve('{}'),
            headers: new Map(),
          }) // functions

        const client = createClient(URL, KEY, {
          global: { fetch: mockFetch },
        })

        client.auth.getSession = jest.fn().mockResolvedValue({
          data: { session: { access_token: expectedToken } },
        })

        await client.from('test').select('*')
        await client.storage.from('test').list()
        await client.functions.invoke('test-function')

        expect(mockFetch).toHaveBeenCalledTimes(3)

        mockFetch.mock.calls.forEach(([, options]) => {
          expect(options.headers.get('Authorization')).toBe(`Bearer ${expectedToken}`)
        })
      })

      test('should use supabaseKey fallback in fetchWithAuth', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        })

        const client = createClient(URL, KEY, {
          global: { fetch: mockFetch },
        })

        client.auth.getSession = jest.fn().mockResolvedValue({
          data: { session: null },
        })

        await client.from('test').select('*')

        expect(mockFetch).toHaveBeenCalled()
        const [, options] = mockFetch.mock.calls[0]
        expect(options.headers.get('Authorization')).toBe(`Bearer ${KEY}`)
        expect(options.headers.get('apikey')).toBe(KEY)
      })
    })
  })
})
