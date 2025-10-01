import { createClient } from '../../src/index'
import SupabaseClient from '../../src/SupabaseClient'

// Mock the SupabaseClient constructor
jest.mock('../../src/SupabaseClient')

describe('index module', () => {
  const originalProcess = global.process
  const originalConsole = global.console
  const originalWindow = global.window

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset globals
    delete (global as any).process
    delete (global as any).window
    global.console = { ...originalConsole, warn: jest.fn() }
  })

  afterEach(() => {
    // Restore globals
    if (originalProcess) global.process = originalProcess
    if (originalWindow) global.window = originalWindow
    global.console = originalConsole
  })

  describe('createClient', () => {
    test('should create a new SupabaseClient instance', () => {
      const mockSupabaseClient = SupabaseClient as jest.MockedClass<typeof SupabaseClient>
      mockSupabaseClient.mockImplementation(() => ({}) as any)

      const supabaseUrl = 'https://test.supabase.co'
      const supabaseKey = 'test-key'
      const options = { auth: { autoRefreshToken: false } }

      const client = createClient(supabaseUrl, supabaseKey, options)

      expect(mockSupabaseClient).toHaveBeenCalledWith(supabaseUrl, supabaseKey, options)
      expect(client).toBeDefined()
    })

    test('should create client without options', () => {
      const mockSupabaseClient = SupabaseClient as jest.MockedClass<typeof SupabaseClient>
      mockSupabaseClient.mockImplementation(() => ({}) as any)

      const supabaseUrl = 'https://test.supabase.co'
      const supabaseKey = 'test-key'

      const client = createClient(supabaseUrl, supabaseKey)

      expect(mockSupabaseClient).toHaveBeenCalledWith(supabaseUrl, supabaseKey, undefined)
      expect(client).toBeDefined()
    })

    test('should work with generic types', () => {
      const mockSupabaseClient = SupabaseClient as jest.MockedClass<typeof SupabaseClient>
      mockSupabaseClient.mockImplementation(() => ({}) as any)

      interface TestDatabase {
        public: {
          Tables: {
            users: {
              Row: { id: number; name: string }
              Insert: { name: string }
              Update: { name?: string }
            }
          }
        }
      }

      const supabaseUrl = 'https://test.supabase.co'
      const supabaseKey = 'test-key'

      const client = createClient<TestDatabase>(supabaseUrl, supabaseKey)

      expect(mockSupabaseClient).toHaveBeenCalledWith(supabaseUrl, supabaseKey, undefined)
      expect(client).toBeDefined()
    })
  })

  describe('deprecation warnings', () => {
    test('should show warning for Node.js 18', () => {
      global.process = { version: 'v18.17.0' } as any

      // Re-import to trigger the deprecation check
      jest.resetModules()
      require('../../src/index')

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Node.js 18 and below are deprecated')
      )
    })

    test('should not show warning for Node.js 20', () => {
      global.process = { version: 'v20.0.0' } as any

      // Re-import to trigger the deprecation check
      jest.resetModules()
      require('../../src/index')

      expect(console.warn).not.toHaveBeenCalled()
    })

    test('should not show warning in browser environment', () => {
      global.window = {} as any

      // Re-import to trigger the deprecation check
      jest.resetModules()
      require('../../src/index')

      expect(console.warn).not.toHaveBeenCalled()
    })
  })
})
