// constants.ts
import { RealtimeClientOptions } from '@supabase/realtime-js'
import { SupabaseAuthClientOptions, TracePropagationOptions } from './types'
import { version } from './version'

const _clientInfoMeta: string[] = []
// @ts-ignore
if (typeof Deno !== 'undefined') {
  _clientInfoMeta.push('runtime=deno')
  // @ts-ignore
  const denoVersion: string | undefined = Deno.version?.deno
  if (denoVersion) {
    _clientInfoMeta.push(`runtime-version=${denoVersion}`)
  }
} else if (typeof document !== 'undefined') {
  _clientInfoMeta.push('platform=browser')
} else if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  _clientInfoMeta.push('framework=react-native')
} else {
  _clientInfoMeta.push('runtime=node')
  const _process = (globalThis as any)['process']
  const nodeVersion: string | undefined = _process?.['version']?.replace(/^v/, '')
  if (nodeVersion) {
    _clientInfoMeta.push(`runtime-version=${nodeVersion}`)
  }
}

export const DEFAULT_HEADERS = {
  'X-Client-Info': [`supabase-js/${version}`, ..._clientInfoMeta].join('; '),
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
