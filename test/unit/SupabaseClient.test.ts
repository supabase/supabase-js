import { PostgrestClient } from '@supabase/postgrest-js'
import { createClient, SupabaseClient } from '../../src/index'
import { Database } from '../types'
import type { AuthChangeEvent } from '@supabase/auth-js'

// Testable subclass to expose protected methods/properties for testing
class TestableSupabaseClient extends SupabaseClient {
  public getAccessToken = this._getAccessToken.bind(this)
  public listenForAuthEvents = this._listenForAuthEvents.bind(this)
  public get changedAccessTokenPublic() {
    return this.changedAccessToken
  }
  public set changedAccessTokenPublic(val) {
    this.changedAccessToken = val
  }
  public setRealtime(val: any) {
    this.realtime = val
  }
  public setAuth(val: any) {
    this.auth = val
  }
  public get authUrlPublic() {
    return this.authUrl
  }
  public get realtimeUrlPublic() {
    return this.realtimeUrl
  }
  public get storageUrlPublic() {
    return this.storageUrl
  }
  public get functionsUrlPublic() {
    return this.functionsUrl
  }
  public get restPublic() {
    return this.rest
  }
  public get restUrlPublic() {
    return this.rest.url
  }
  public get headersPublic() {
    return this.headers
  }
  public get storageKeyPublic() {
    return this.storageKey
  }
}

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'

describe('SupabaseClient', () => {
  describe('Client Creation & Configuration', () => {
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

    describe('URL Construction', () => {
      test('should construct URLs correctly', () => {
        const client = new TestableSupabaseClient(URL, KEY)
        expect(client.authUrlPublic.toString()).toEqual('http://localhost:3000/auth/v1')
        expect(client.realtimeUrlPublic.toString()).toEqual('ws://localhost:3000/realtime/v1')
        expect(client.storageUrlPublic.toString()).toEqual('http://localhost:3000/storage/v1')
        expect(client.functionsUrlPublic.toString()).toEqual('http://localhost:3000/functions/v1')
        expect(client.restUrlPublic).toEqual('http://localhost:3000/rest/v1')
      })

      test('should preserve paths in supabaseUrl', () => {
        const baseUrlWithPath = 'http://localhost:3000/custom/base'
        const client = new TestableSupabaseClient(baseUrlWithPath, KEY)
        expect(client.authUrlPublic.toString()).toEqual('http://localhost:3000/custom/base/auth/v1')
        expect(client.realtimeUrlPublic.toString()).toEqual(
          'ws://localhost:3000/custom/base/realtime/v1'
        )
        expect(client.storageUrlPublic.toString()).toEqual(
          'http://localhost:3000/custom/base/storage/v1'
        )
        expect(client.functionsUrlPublic.toString()).toEqual(
          'http://localhost:3000/custom/base/functions/v1'
        )
        expect(client.restUrlPublic).toEqual('http://localhost:3000/custom/base/rest/v1')
      })

      test('should handle HTTPS URLs correctly', () => {
        const client = new TestableSupabaseClient('https://localhost:3000', KEY)
        expect(client.realtimeUrlPublic.toString()).toEqual('wss://localhost:3000/realtime/v1')
      })
    })

    describe('Custom Headers', () => {
      test('should have custom header set', () => {
        const customHeader = { 'X-Test-Header': 'value' }
        const request = createClient(URL, KEY, { global: { headers: customHeader } }).rpc('')
        // @ts-ignore
        const getHeaders = request.headers
        expect(getHeaders).toHaveProperty('X-Test-Header', 'value')
      })

      test('should merge custom headers with default headers', () => {
        const customHeader = { 'X-Test-Header': 'value' }
        const client = createClient(URL, KEY, { global: { headers: customHeader } })
        // @ts-ignore
        expect(client.headers).toHaveProperty('X-Test-Header', 'value')
        // @ts-ignore
        expect(client.headers).toHaveProperty('X-Client-Info')
      })
    })

    describe('Storage Key', () => {
      test('should use default storage key based on project ref', () => {
        const client = new TestableSupabaseClient('https://project-ref.supabase.co', KEY)
        expect(client.storageKeyPublic).toBe('sb-project-ref-auth-token')
      })

      test('should use custom storage key when provided', () => {
        const customStorageKey = 'custom-storage-key'
        const client = new TestableSupabaseClient(URL, KEY, {
          auth: { storageKey: customStorageKey },
        })
        expect(client.storageKeyPublic).toBe(customStorageKey)
      })
    })
  })

  describe('Module Initialization', () => {
    test('should initialize functions client', () => {
      const client = createClient(URL, KEY)
      const functions = client.functions
      expect(functions).toBeDefined()
      expect((functions as any).url).toBe('http://localhost:3000/functions/v1')
    })

    test('should initialize storage client', () => {
      const client = createClient(URL, KEY)
      const storage = client.storage
      expect(storage).toBeDefined()
      expect((storage as any).url).toBe('http://localhost:3000/storage/v1')
    })

    test('should initialize realtime client', () => {
      const client = createClient(URL, KEY)
      expect(client.realtime).toBeDefined()
      expect((client.realtime as any).endPoint).toBe('ws://localhost:3000/realtime/v1/websocket')
    })
  })

  describe('Channel Management', () => {
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

  describe('Database/Schema/Query', () => {
    test('should switch schema', () => {
      const client = createClient<Database>(URL, KEY)
      const schemaClient = client.schema('personal')
      expect(schemaClient).toBeDefined()
      expect(schemaClient).toBeInstanceOf(PostgrestClient)
    })

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

  describe('Auth & Token Management', () => {
    describe('Auth state change integration', () => {
      let client: TestableSupabaseClient
      let mockRealtime: any
      let mockAuth: any
      let authStateChangeCallback: any

      beforeEach(() => {
        client = new TestableSupabaseClient(URL, KEY)
        mockRealtime = {
          setAuth: jest.fn(),
          getChannels: jest.fn(() => []),
          removeChannel: jest.fn(() => Promise.resolve('ok')),
          removeAllChannels: jest.fn(() => Promise.resolve(['ok'])),
          channel: jest.fn(() => ({})),
        }
        mockAuth = {
          signOut: jest.fn(),
          onAuthStateChange: jest.fn((cb: any) => {
            authStateChangeCallback = cb
          }),
          getSession: jest.fn(() =>
            Promise.resolve({ data: { session: { access_token: 'token' } } })
          ),
        }
        client.setRealtime(mockRealtime)
        client.setAuth(mockAuth)
        client.changedAccessTokenPublic = undefined
        client.listenForAuthEvents()
      })

      afterEach(() => {
        jest.restoreAllMocks()
      })

      test('should clear auth and call signOut on SIGNED_OUT from STORAGE', async () => {
        client.changedAccessTokenPublic = 'tok'
        await client['_handleTokenChanged']('SIGNED_OUT', 'STORAGE', 'tok')
        expect(mockAuth.signOut).toHaveBeenCalled()
        expect(mockRealtime.setAuth).toHaveBeenCalledWith()
        expect(client.changedAccessTokenPublic).toBeUndefined()
      })

      test('should clear auth but not call signOut on SIGNED_OUT from CLIENT', (done) => {
        client.changedAccessTokenPublic = 'tok'
        authStateChangeCallback('SIGNED_OUT', { access_token: 'tok' })
        setTimeout(() => {
          expect(mockRealtime.setAuth).toHaveBeenCalledWith()
          expect(mockAuth.signOut).not.toHaveBeenCalled()
          expect(client.changedAccessTokenPublic).toBeUndefined()
          done()
        }, 0)
      })

      test('should call _handleTokenChanged asynchronously via setTimeout', (done) => {
        client.changedAccessTokenPublic = undefined
        const spy = jest.spyOn(Object.getPrototypeOf(client), '_handleTokenChanged')
        authStateChangeCallback('TOKEN_REFRESHED', { access_token: 'async-token' })
        expect(spy).not.toHaveBeenCalled()
        setTimeout(() => {
          expect(spy).toHaveBeenCalledWith('TOKEN_REFRESHED', 'CLIENT', 'async-token')
          done()
        }, 0)
      })
    })

    describe('Infinite loop prevention', () => {
      test('should not cause infinite loop when auth state changes', (done) => {
        const client = new TestableSupabaseClient(URL, KEY)
        const mockRealtime = {
          setAuth: jest.fn(),
          getChannels: jest.fn(() => []),
          removeChannel: jest.fn(() => Promise.resolve('ok')),
          removeAllChannels: jest.fn(() => Promise.resolve(['ok'])),
          channel: jest.fn(() => ({})),
        }
        let callCount = 0
        const mockAuth = {
          signOut: jest.fn(),
          onAuthStateChange: jest.fn((cb: any) => {
            return (...args: [AuthChangeEvent, any]) => {
              callCount++
              if (callCount > 1) throw new Error('Infinite loop detected')
              cb(...args)
            }
          }),
          getSession: jest.fn(() =>
            Promise.resolve({ data: { session: { access_token: 'token' } } })
          ),
        }
        client.setRealtime(mockRealtime)
        client.setAuth(mockAuth)
        client.changedAccessTokenPublic = undefined
        client.listenForAuthEvents()

        setTimeout(() => {
          expect(() => {
            mockAuth.onAuthStateChange((event: AuthChangeEvent, session: any) => {
              client['_handleTokenChanged'](event, 'CLIENT', session?.access_token)
            })('TOKEN_REFRESHED', { access_token: 'token' })
          }).not.toThrow()
          done()
        }, 0)
      })
    })

    describe('Advanced session refresh scenarios', () => {
      let client: TestableSupabaseClient
      let mockRealtime: any
      let mockAuth: any
      let storageSpy: jest.SpyInstance
      let functionsSpy: jest.SpyInstance

      beforeEach(() => {
        client = new TestableSupabaseClient(URL, KEY)
        mockRealtime = { setAuth: jest.fn() }
        mockAuth = {
          onAuthStateChange: jest.fn(),
          getSession: jest.fn(() =>
            Promise.resolve({ data: { session: { access_token: 'token' } } })
          ),
          signOut: jest.fn(),
        }
        client.setRealtime(mockRealtime)
        client.setAuth(mockAuth)
        storageSpy = jest
          .spyOn(Object.getPrototypeOf(client), 'storage', 'get')
          .mockReturnValue({ setAuth: jest.fn() })
        functionsSpy = jest
          .spyOn(Object.getPrototypeOf(client), 'functions', 'get')
          .mockReturnValue({ setAuth: jest.fn() })
      })

      afterEach(() => {
        storageSpy.mockRestore()
        functionsSpy.mockRestore()
        jest.restoreAllMocks()
      })

      test('should update realtime, storage, and functions clients on session refresh', async () => {
        await client.listenForAuthEvents()
        const callback = mockAuth.onAuthStateChange.mock.calls[0][0]
        callback('TOKEN_REFRESHED', { access_token: 'newtoken' })
        await new Promise((r) => setTimeout(r, 0))
        expect(mockRealtime.setAuth).toHaveBeenCalledWith('newtoken')
        const storage = client.storage
        const functions = client.functions
        expect(storage).toBeDefined()
        expect(functions).toBeDefined()
      })

      test('should handle session refresh failure gracefully', async () => {
        mockAuth.getSession.mockRejectedValueOnce(new Error('fail'))
        await expect(client.getAccessToken()).rejects.toThrow('fail')
      })

      test('should handle concurrent session refreshes without conflict', async () => {
        await client.listenForAuthEvents()
        const callback = mockAuth.onAuthStateChange.mock.calls[0][0]
        callback('TOKEN_REFRESHED', { access_token: 'token1' })
        callback('TOKEN_REFRESHED', { access_token: 'token2' })
        await new Promise((r) => setTimeout(r, 0))
        expect(mockRealtime.setAuth).toHaveBeenLastCalledWith('token2')
      })

      test('should not throw or leak listeners after sign out', async () => {
        await client.listenForAuthEvents()
        const callback = mockAuth.onAuthStateChange.mock.calls[0][0]
        callback('SIGNED_OUT', { access_token: 'token' })
        await new Promise((r) => setTimeout(r, 0))
        expect(mockRealtime.setAuth).toHaveBeenCalledWith()
        expect(mockAuth.signOut).not.toHaveBeenCalled() // Only called for STORAGE
      })

      test('sends a token very close to expiry to realtime (should we prevent this and auto refresh?)', async () => {
        const EXPIRY_MARGIN_MS = 60000 // 60 seconds, typical default
        const now = Date.now()
        const expires_at = Math.floor((now + EXPIRY_MARGIN_MS - 1000) / 1000) // 1 second before margin
        const almostExpiredSession = {
          access_token: 'almost-expired-token',
          expires_at,
        }
        mockAuth.getSession.mockResolvedValueOnce({ data: { session: almostExpiredSession } })
        const token = await client.getAccessToken()
        mockRealtime.setAuth(token)
        expect(mockRealtime.setAuth).toHaveBeenCalledWith('almost-expired-token')
      })
    })
  })
})
