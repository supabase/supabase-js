// constants.ts
import { RealtimeClientOptions } from '@supabase/realtime-js'
import { SupabaseAuthClientOptions, TracePropagationOptions } from './types'
import { version } from './version'

let JS_ENV = ''
let JS_RUNTIME_VERSION: string | undefined
// @ts-ignore
if (typeof Deno !== 'undefined') {
  JS_ENV = 'deno'
  // @ts-ignore
  JS_RUNTIME_VERSION = Deno.version?.deno
} else if (typeof document !== 'undefined') {
  JS_ENV = 'web'
} else if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  JS_ENV = 'react-native'
} else {
  JS_ENV = 'node'
  JS_RUNTIME_VERSION =
    typeof process !== 'undefined' ? process.version?.replace(/^v/, '') : undefined
}

const _runtimeMeta = [`runtime=${JS_ENV}`]
if (JS_RUNTIME_VERSION) {
  _runtimeMeta.push(`runtime-version=${JS_RUNTIME_VERSION}`)
}

export const DEFAULT_HEADERS = {
  'X-Client-Info': `supabase-js/${version}; ${_runtimeMeta.join('; ')}`,
}

export const DEFAULT_GLOBAL_OPTIONS = {
  headers: DEFAULT_HEADERS,
}

export const DEFAULT_DB_OPTIONS = {
  schema: 'public',
}

export const DEFAULT_AUTH_OPTIONS: SupabaseAuthClientOptions = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: 'implicit',
}

export const DEFAULT_REALTIME_OPTIONS: RealtimeClientOptions = {}

export const DEFAULT_TRACE_PROPAGATION_OPTIONS: TracePropagationOptions = {
  enabled: false,
  respectSamplingDecision: true,
}
