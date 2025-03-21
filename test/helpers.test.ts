import * as helpers from '../src/lib/helpers'
import { DEFAULT_HEADERS } from '../src/lib/constants'

test('uuid', async () => {
  expect(helpers.uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
})

test('override setting defaults', async () => {
  const DEFAULT_GLOBAL_OPTIONS = {
    headers: DEFAULT_HEADERS,
  }

  const DEFAULT_DB_OPTIONS = {
    schema: 'public',
  }

  const DEFAULT_AUTH_OPTIONS = {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }

  let defaults = {
    db: DEFAULT_DB_OPTIONS,
    auth: DEFAULT_AUTH_OPTIONS,
    global: DEFAULT_GLOBAL_OPTIONS,
  }

  let autoRefreshOption = false
  let options = {
    auth: {
      autoRefreshToken: autoRefreshOption,
    },
  }
  let settings = helpers.applySettingDefaults(options, defaults)
  expect(settings.auth.autoRefreshToken).toBe(autoRefreshOption)
  // Existing default properties should not be overwritten
  expect(settings.auth.persistSession).not.toBeNull()
  expect(settings.global.headers).toBe(DEFAULT_HEADERS)
  // Existing property values should remain constant
  expect(settings.db.schema).toBe(defaults.db.schema)
})

describe('resolveFetch', () => {
  const TEST_URL = 'https://example.com'
  const TEST_OPTIONS = { method: 'GET' }

  beforeEach(() => {
    // Reset any mocks between tests
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('should use custom fetch if provided', async () => {
    const customFetch = jest.fn()
    const resolvedFetch = helpers.resolveFetch(customFetch)

    await resolvedFetch(TEST_URL, TEST_OPTIONS)

    expect(customFetch).toHaveBeenCalledTimes(1)
    expect(customFetch).toHaveBeenCalledWith(TEST_URL, TEST_OPTIONS)
  })

  test('should use global fetch if no custom fetch is provided', async () => {
    const globalFetch = jest.fn()
    global.fetch = globalFetch
    const resolvedFetch = helpers.resolveFetch()

    await resolvedFetch(TEST_URL, TEST_OPTIONS)

    expect(globalFetch).toHaveBeenCalledTimes(1)
    expect(globalFetch).toHaveBeenCalledWith(TEST_URL, TEST_OPTIONS)
  })

  test('should use node-fetch if global fetch is not available', async () => {
    const nodeFetch = jest.fn()
    jest.mock('@supabase/node-fetch', () => nodeFetch)

    global.fetch = undefined as any
    const resolvedFetch = helpers.resolveFetch()

    await resolvedFetch(TEST_URL, TEST_OPTIONS)

    expect(nodeFetch).toHaveBeenCalledTimes(1)
    expect(nodeFetch).toHaveBeenCalledWith(TEST_URL, TEST_OPTIONS)
  })
})

describe('resolveHeadersConstructor', () => {
  beforeEach(() => {
    // Reset any mocks between tests
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('should use Headers if available', async () => {
    const resolvedHeadersConstructor = await helpers.resolveHeadersConstructor()
    expect(resolvedHeadersConstructor).toBe(Headers)
  })

  test('should use node-fetch Headers if global Headers is not available', async () => {
    const MockHeaders = jest.fn()
    jest.mock('@supabase/node-fetch', () => ({
      Headers: MockHeaders,
    }))

    // Cannot assign read-only property, delete is available
    // @ts-ignore
    delete global.Headers

    const resolvedHeadersConstructor = await helpers.resolveHeadersConstructor()
    expect(resolvedHeadersConstructor).toBe(MockHeaders)
  })
})
