// helpers.ts
import { SupabaseClientOptions } from './types'

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

export const isBrowser = () => typeof window !== 'undefined'

export function applySettingDefaults<
  Database = any,
  SchemaName extends string & keyof Database = 'public' extends keyof Database
    ? 'public'
    : string & keyof Database
>(
  options: SupabaseClientOptions<SchemaName>,
  defaults: SupabaseClientOptions<any>
): Required<SupabaseClientOptions<SchemaName>> {
  const {
    db: dbOptions,
    auth: authOptions,
    realtime: realtimeOptions,
    global: globalOptions,
  } = options
  const {
    db: DEFAULT_DB_OPTIONS,
    auth: DEFAULT_AUTH_OPTIONS,
    realtime: DEFAULT_REALTIME_OPTIONS,
    global: DEFAULT_GLOBAL_OPTIONS,
  } = defaults

  const result: Required<SupabaseClientOptions<SchemaName>> = {
    db: {
      ...DEFAULT_DB_OPTIONS,
      ...dbOptions,
    },
    auth: {
      ...DEFAULT_AUTH_OPTIONS,
      ...authOptions,
    },
    realtime: {
      ...DEFAULT_REALTIME_OPTIONS,
      ...realtimeOptions,
    },
    global: {
      ...DEFAULT_GLOBAL_OPTIONS,
      ...globalOptions,
    },
    accessToken: async () => '',
  }

  if (options.accessToken) {
    result.accessToken = options.accessToken
  } else {
    // hack around Required<>
    delete (result as any).accessToken
  }

  return result
}

export const BASE64URL_REGEX = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i

/**
 * Checks that the value somewhat looks like a JWT, does not do any additional parsing or verification.
 */
export function isJWT(value: string): boolean {
  if (value.startsWith('Bearer ')) {
    value = value.substring('Bearer '.length)
  }

  value = value.trim()

  if (!value) {
    return false
  }

  const parts = value.split('.')

  if (parts.length !== 3) {
    return false
  }

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]

    if (part.length < 4 || !BASE64URL_REGEX.test(part)) {
      return false
    }
  }

  return true
}

export function checkAuthorizationHeader(headers: { [header: string]: string }) {
  if (headers.authorization && headers.Authorization) {
    console.warn(
      '@supabase-js: Both `authorization` and `Authorization` headers specified in createClient options. `Authorization` will be used.'
    )

    delete headers.authorization
  }

  const authorization = headers.Authorization ?? headers.authorization ?? null

  if (!authorization) {
    return
  }

  if (authorization.startsWith('Bearer ') && authorization.length > 'Bearer '.length) {
    if (!isJWT(authorization)) {
      throw new Error(
        '@supabase-js: createClient called with global Authorization header that does not contain a JWT'
      )
    }
  }
}
