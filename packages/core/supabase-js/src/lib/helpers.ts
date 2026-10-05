// helpers.ts
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
      headers: {
        ...(DEFAULT_GLOBAL_OPTIONS?.headers ?? {}),
        ...(globalOptions?.headers ?? {}),
      },
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
