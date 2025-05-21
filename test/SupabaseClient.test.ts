import { PostgrestClient } from '@supabase/postgrest-js'
import { createClient, SupabaseClient } from '../src/index'
import { Database } from './types'

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
})
