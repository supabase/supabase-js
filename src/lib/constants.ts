// constants.ts
import { RealtimeClientOptions } from '@supabase/realtime-js'
import { SupabaseAuthClientOptions } from './types'
import { version } from './version'

let JS_ENV = ''
// @ts-ignore
if (typeof Deno !== 'undefined') {
  JS_ENV = 'deno'
} else if (typeof document !== 'undefined') {
  JS_ENV = 'web'
} else if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  JS_ENV = 'react-native'
} else {
  JS_ENV = 'node'
}

export function getClientPlatform(): string | null {
  // @ts-ignore
  if (typeof process !== 'undefined' && process.platform) {
    // @ts-ignore
    const platform = process.platform
    if (platform === 'darwin') return 'macOS'
    if (platform === 'win32') return 'Windows'
    if (platform === 'linux') return 'Linux'
    if (platform === 'android') return 'Android'
  }

  // @ts-ignore
  if (typeof navigator !== 'undefined') {
    // Modern User-Agent Client Hints API
    // @ts-ignore
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      // @ts-ignore
      const platform = navigator.userAgentData.platform
      if (platform === 'macOS') return 'macOS'
      if (platform === 'Windows') return 'Windows'
      if (platform === 'Linux') return 'Linux'
      if (platform === 'Android') return 'Android'
      if (platform === 'iOS') return 'iOS'
    }
  }

  return null
}

export function getClientPlatformVersion(): string | null {
  // @ts-ignore
  if (typeof process !== 'undefined' && process.version) {
    // @ts-ignore
    return process.version.slice(1)
  }

  // @ts-ignore
  if (typeof navigator !== 'undefined') {
    // Modern User-Agent Client Hints API
    // @ts-ignore
    if (navigator.userAgentData && navigator.userAgentData.platformVersion) {
      // @ts-ignore
      return navigator.userAgentData.platformVersion
    }
  }

  return null
}

export function getClientRuntime(): string | null {
  // @ts-ignore
  if (typeof Deno !== 'undefined') {
    return 'deno'
  }
  // @ts-ignore
  if (typeof Bun !== 'undefined') {
    return 'bun'
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node'
  }
  return null
}

export function getClientRuntimeVersion(): string | null {
  // @ts-ignore
  if (typeof Deno !== 'undefined' && Deno.version) {
    // @ts-ignore
    return Deno.version.deno
  }
  // @ts-ignore
  if (typeof Bun !== 'undefined' && Bun.version) {
    // @ts-ignore
    return Bun.version
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // @ts-ignore
    return process.versions.node
  }
  return null
}

function buildHeaders() {
  const headers: Record<string, string> = {
    'X-Client-Info': `supabase-js-${JS_ENV}/${version}`,
  }

  const platform = getClientPlatform()
  if (platform) {
    headers['X-Supabase-Client-Platform'] = platform
  }

  const platformVersion = getClientPlatformVersion()
  if (platformVersion) {
    headers['X-Supabase-Client-Platform-Version'] = platformVersion
  }

  const runtime = getClientRuntime()
  if (runtime) {
    headers['X-Supabase-Client-Runtime'] = runtime
  }

  const runtimeVersion = getClientRuntimeVersion()
  if (runtimeVersion) {
    headers['X-Supabase-Client-Runtime-Version'] = runtimeVersion
  }

  return headers
}

export const DEFAULT_HEADERS = buildHeaders()

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
