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
    tokenRefreshType: 'WeChat' as 'WeChat',
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
      tokenRefreshType: 'WeChat' as 'WeChat',
    },
  }
  let settings = helpers.applySettingDefaults(options, defaults)
  expect(settings?.auth?.autoRefreshToken).toBe(autoRefreshOption)
  // Existing default properties should not be overwritten
  expect(settings?.auth?.persistSession).not.toBeNull()
  expect(settings?.global?.headers).toBe(DEFAULT_HEADERS)
  // Existing property values should remain constant
  expect(settings?.db?.schema).toBe(defaults.db.schema)
})
