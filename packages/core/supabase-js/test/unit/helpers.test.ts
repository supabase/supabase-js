import * as helpers from '../../src/lib/helpers'
import { DEFAULT_HEADERS } from '../../src/lib/constants'

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
  expect(settings.global.headers).toStrictEqual(DEFAULT_HEADERS)
  // Existing property values should remain constant
  expect(settings.db.schema).toBe(defaults.db.schema)
})

test('applySettingDefaults with accessToken', () => {
  const defaults = {
    db: { schema: 'public' },
    auth: { autoRefreshToken: true },
    global: { headers: {} },
  }

  const customAccessToken = async () => 'custom-token'
  const options = {
    accessToken: customAccessToken,
  }

  const settings = helpers.applySettingDefaults(options, defaults)
  expect(settings.accessToken).toBe(customAccessToken)
})

test('applySettingDefaults without accessToken', () => {
  const defaults = {
    db: { schema: 'public' },
    auth: { autoRefreshToken: true },
    global: { headers: {} },
  }

  const options = {}

  const settings = helpers.applySettingDefaults(options, defaults)
  expect(settings).not.toHaveProperty('accessToken')
})

describe('applySettingDefaults — tracePropagation', () => {
  const defaults = {
    db: { schema: 'public' },
    auth: { autoRefreshToken: true },
    global: { headers: {} },
    tracePropagation: { enabled: false, respectSamplingDecision: true },
  }

  test('defaults to disabled when no option provided', () => {
    const settings = helpers.applySettingDefaults({}, defaults)
    expect(settings.tracePropagation).toEqual({
      enabled: false,
      respectSamplingDecision: true,
    })
  })

  test('boolean true is normalized to { enabled: true }', () => {
    const settings = helpers.applySettingDefaults({ tracePropagation: true }, defaults)
    expect(settings.tracePropagation).toEqual({
      enabled: true,
      respectSamplingDecision: true,
    })
  })

  test('boolean false is normalized to { enabled: false }', () => {
    const settings = helpers.applySettingDefaults({ tracePropagation: false }, defaults)
    expect(settings.tracePropagation).toEqual({
      enabled: false,
      respectSamplingDecision: true,
    })
  })

  test('object form is honored', () => {
    const settings = helpers.applySettingDefaults(
      { tracePropagation: { enabled: true, respectSamplingDecision: false } },
      defaults
    )
    expect(settings.tracePropagation).toEqual({
      enabled: true,
      respectSamplingDecision: false,
    })
  })

  test('partial object inherits other defaults', () => {
    const settings = helpers.applySettingDefaults({ tracePropagation: { enabled: true } }, defaults)
    expect(settings.tracePropagation).toEqual({
      enabled: true,
      respectSamplingDecision: true,
    })
  })
})

test('isBrowser function', () => {
  const originalWindow = global.window

  // Test browser environment
  global.window = {} as any
  expect(helpers.isBrowser()).toBe(true)

  // Test non-browser environment
  delete (global as any).window
  expect(helpers.isBrowser()).toBe(false)

  // Restore
  if (originalWindow) global.window = originalWindow
})
