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

export function getClientPlatform(): string {
  // @ts-ignore
  if (typeof navigator !== 'undefined' && navigator.platform) {
    // @ts-ignore
    const platform = navigator.platform.toLowerCase()
    if (platform.includes('mac')) return 'macOS'
    if (platform.includes('win')) return 'Windows'
    if (platform.includes('linux')) return 'Linux'
    if (platform.includes('iphone') || platform.includes('ipad')) return 'iOS'
    if (platform.includes('android')) return 'Android'
    // @ts-ignore
    return navigator.platform
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.platform) {
    // @ts-ignore
    const platform = process.platform
    if (platform === 'darwin') return 'macOS'
    if (platform === 'win32') return 'Windows'
    if (platform === 'linux') return 'Linux'
    return platform
  }
  return 'unknown'
}

export function getClientPlatformVersion(): string {
  // @ts-ignore
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    // @ts-ignore
    const userAgent = navigator.userAgent
    const macMatch = userAgent.match(/Mac OS X (\d+[._]\d+[._]\d+)/)
    if (macMatch) return macMatch[1].replace(/_/g, '.')

    const windowsMatch = userAgent.match(/Windows NT (\d+\.\d+)/)
    if (windowsMatch) return windowsMatch[1]

    const iosMatch = userAgent.match(/OS (\d+[._]\d+[._]\d+)/)
    if (iosMatch) return iosMatch[1].replace(/_/g, '.')

    const androidMatch = userAgent.match(/Android (\d+\.\d+)/)
    if (androidMatch) return androidMatch[1]
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.version) {
    // @ts-ignore
    return process.version.slice(1)
  }
  return 'unknown'
}

export function getClientRuntime(): string {
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
  if (typeof document !== 'undefined') {
    return 'web'
  }
  return 'unknown'
}

export function getClientRuntimeVersion(): string {
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
  if (typeof document !== 'undefined') {
    return 'unknown'
  }
  return 'unknown'
}

export const DEFAULT_HEADERS = {
  'X-Client-Info': `supabase-js-${JS_ENV}/${version}`,
  'X-Supabase-Client-Platform': getClientPlatform(),
  'X-Supabase-Client-Platform-Version': getClientPlatformVersion(),
  'X-Supabase-Client-Runtime': getClientRuntime(),
  'X-Supabase-Client-Runtime-Version': getClientRuntimeVersion(),
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
