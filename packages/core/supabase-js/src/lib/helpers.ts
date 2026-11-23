// helpers.ts
import { CLIENT_INFO_HEADER } from './constants'
import { SupabaseClientOptions, TracePropagationOptions } from './types'

function normalizeTracePropagation(
  value: TracePropagationOptions | boolean | undefined
): TracePropagationOptions | undefined {
  return typeof value === 'boolean' ? { enabled: value } : value
}

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : url + '/'
}

export const isBrowser = () => typeof window !== 'undefined'

let warnedTopLevelSchema = false

/**
 * Warn (once per process) when `schema` is passed at the top level of the client options
 * instead of under `db`. A top-level `schema` is not part of the options shape and is
 * ignored, so queries silently go to the default schema. Never throws.
 *
 * Only `undefined` counts as unset, matching `db.schema`, where any other value is sent
 * as the profile header.
 */
export function checkTopLevelSchemaOption(options: unknown): void {
  if (warnedTopLevelSchema) {
    return
  }
  if (
    typeof options !== 'object' ||
    options === null ||
    !('schema' in options) ||
    (options as { schema?: unknown }).schema === undefined
  ) {
    return
  }
  warnedTopLevelSchema = true
  console.warn(
    '@supabase/supabase-js: The "schema" option must be nested under "db", ' +
      "e.g. createClient(url, key, { db: { schema: 'myschema' } }). " +
      'A top-level "schema" is ignored and queries go to the default schema.'
  )
}

/**
 * For tests only. Resets the one-time top-level `schema` warning.
 *
 * @internal
 */
export function _resetTopLevelSchemaWarning(): void {
  warnedTopLevelSchema = false
}

const isClientInfoHeader = (name: string) => name.toLowerCase() === CLIENT_INFO_HEADER.toLowerCase()

// SDK-owned metadata is reserved even when this environment does not emit it.
const RESERVED_CLIENT_INFO_KEYS = new Set([
  'platform',
  'platform-version',
  'platform-architecture',
  'runtime',
  'runtime-version',
  'framework',
  'framework-version',
  'features',
])

/**
 * Percent-encodes every `;`, `%` and character outside printable ASCII (0x20 to 0x7E) as its
 * UTF-8 bytes. Spaces stay as they are.
 */
function encodeClientInfoValue(value: string): string {
  // `u` iterates by code point, so characters outside the BMP are not split into surrogates.
  return value.replace(/[^\x20-\x7e]|[;%]/gu, (char) => {
    return Array.from(new TextEncoder().encode(char), (byte) => {
      return '%' + byte.toString(16).toUpperCase().padStart(2, '0')
    }).join('')
  })
}

/**
 * Parses an `X-Client-Info` value into the lowercase keys of its parameters.
 * e.g. `X-Client-Info: sdk=js; platform=web; runtime=node`
 * becomes a set of `'sdk', 'platform', 'runtime'`.
 */
function clientInfoKeys(header: string): Set<string> {
  const keys = new Set<string>()
  for (const segment of header.split(';').slice(1)) {
    const key = segment.split('=')[0].trim().toLowerCase()
    if (key) keys.add(key)
  }
  return keys
}

/**
 * Appends the `global.clientInfo` entries to the resolved `X-Client-Info` header, as
 * `; key=value` in the entries' order. Uses caller's `X-Client-Info` header
 * (matched case-insensitively) when there is one, otherwise uses the SDK's default.
 * Throws on an invalid key or value.
 *
 * @internal
 */
function appendClientInfo(
  headers: Record<string, string>,
  callerHeaders: Record<string, string> | undefined,
  clientInfo: Record<string, string>
): Record<string, string> {
  const entries = Object.entries(clientInfo)
  if (entries.length === 0) {
    return headers
  }

  const callerName = Object.keys(callerHeaders ?? {})
    .reverse()
    .find(isClientInfoHeader)
  const defaultName = Object.keys(headers).reverse().find(isClientInfoHeader)
  let value = String(
    (callerName !== undefined ? callerHeaders?.[callerName] : undefined) ??
      (defaultName !== undefined ? headers[defaultName] : undefined) ??
      ''
  )

  const seen = clientInfoKeys(value)
  for (const [key, raw] of entries) {
    if (!/^[A-Za-z0-9_-]+$/.test(key)) {
      throw new Error(
        `Invalid global.clientInfo key "${key}": expected only letters, numbers, underscores or hyphens.`
      )
    }
    if (RESERVED_CLIENT_INFO_KEYS.has(key.toLowerCase())) {
      throw new Error(
        `Invalid global.clientInfo key "${key}": this parameter is reserved by the SDK.`
      )
    }
    if (seen.has(key.toLowerCase())) {
      throw new Error(
        `Invalid global.clientInfo key "${key}": the X-Client-Info header already has this parameter.`
      )
    }
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new Error(`Invalid global.clientInfo value for "${key}": must be a non-empty string.`)
    }
    seen.add(key.toLowerCase())
    value += `; ${key}=${encodeClientInfoValue(raw.trim())}`
  }

  const result: Record<string, string> = {}
  for (const [name, headerValue] of Object.entries(headers)) {
    if (!isClientInfoHeader(name)) result[name] = headerValue
  }
  result[CLIENT_INFO_HEADER] = value
  return result
}

export type ResolvedSupabaseClientOptions<SchemaName> = Omit<
  Required<SupabaseClientOptions<SchemaName>>,
  'tracePropagation'
> & {
  tracePropagation: TracePropagationOptions
}

export function applySettingDefaults<
  Database = any,
  SchemaName extends string & keyof Database = 'public' extends keyof Database
    ? 'public'
    : string & keyof Database,
>(
  options: SupabaseClientOptions<SchemaName>,
  defaults: SupabaseClientOptions<any>
): ResolvedSupabaseClientOptions<SchemaName> {
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

  // Accept either a boolean shorthand or an options object on both sides.
  const tracePropagationOptions = normalizeTracePropagation(options.tracePropagation)
  const DEFAULT_TRACE_PROPAGATION_OPTIONS = normalizeTracePropagation(defaults.tracePropagation)

  const result: ResolvedSupabaseClientOptions<SchemaName> = {
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
    storage: {},
    global: {
      ...DEFAULT_GLOBAL_OPTIONS,
      ...globalOptions,
      headers: appendClientInfo(
        {
          ...(DEFAULT_GLOBAL_OPTIONS?.headers ?? {}),
          ...(globalOptions?.headers ?? {}),
        },
        globalOptions?.headers,
        globalOptions?.clientInfo ?? {}
      ),
    },
    tracePropagation: {
      enabled:
        tracePropagationOptions?.enabled ?? DEFAULT_TRACE_PROPAGATION_OPTIONS?.enabled ?? false,
      respectSamplingDecision:
        tracePropagationOptions?.respectSamplingDecision ??
        DEFAULT_TRACE_PROPAGATION_OPTIONS?.respectSamplingDecision ??
        true,
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

/**
 * Validates a Supabase client URL
 *
 * @param {string} supabaseUrl - The Supabase client URL string.
 * @returns {URL} - The validated base URL.
 * @throws {Error}
 */
export function validateSupabaseUrl(supabaseUrl: string): URL {
  const trimmedUrl = supabaseUrl?.trim()

  if (!trimmedUrl) {
    throw new Error('supabaseUrl is required.')
  }

  if (!trimmedUrl.match(/^https?:\/\//i)) {
    throw new Error('Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.')
  }

  try {
    return new URL(ensureTrailingSlash(trimmedUrl))
  } catch {
    throw Error('Invalid supabaseUrl: Provided URL is malformed.')
  }
}
