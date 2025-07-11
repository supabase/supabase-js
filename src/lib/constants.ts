// constants.ts
import { RealtimeClientOptions } from '@supabase/realtime-js'
import { SupabaseAuthClientOptions } from './types'
import { version } from './version'

// Type definitions for User-Agent Client Hints API
interface NavigatorUAData {
  platform: string
  platformVersion?: string
}

interface NavigatorWithUAData extends Navigator {
  userAgentData?: NavigatorUAData
}

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

function getRuntimeName(): string | undefined {
  // @ts-ignore
  if (typeof Deno !== 'undefined') {
    return 'deno'
  }

  if (typeof process !== 'undefined' && process.versions) {
    if (process.versions.bun) {
      return 'bun'
    }
    if (process.versions.node) {
      return 'node'
    }
  }

  if (typeof navigator !== 'undefined') {
    if (navigator.product === 'ReactNative') {
      return 'react-native'
    }
    return 'web'
  }

  return undefined
}

function getRuntimeVersion(): string | undefined {
  // @ts-ignore
  if (typeof Deno !== 'undefined') {
    // @ts-ignore
    return Deno.version?.deno
  }

  if (typeof process !== 'undefined' && process.versions) {
    if (process.versions.bun) {
      return process.versions.bun
    }
    if (process.versions.node) {
      return process.versions.node
    }
  }

  return undefined
}

function getPlatformName(): string | undefined {
  if (typeof process !== 'undefined' && process.versions?.node) {
    switch (process.platform) {
      case 'win32':
        return 'windows'
      case 'darwin':
        return 'macos'
      case 'linux':
        return detectLinuxPlatform()
      default:
        return undefined
    }
  }

  if (typeof navigator !== 'undefined') {
    const nav = navigator as NavigatorWithUAData
    if ('userAgentData' in navigator && nav.userAgentData?.platform) {
      return normalizePlatform(nav.userAgentData.platform)
    }
  }

  return undefined
}

function normalizePlatform(platform: string): string | undefined {
  switch (platform.toLowerCase()) {
    case 'windows':
      return 'Windows'
    case 'macos':
      return 'macOS'
    case 'linux':
      return 'Linux'
    case 'android':
      return 'Android'
    case 'chrome os':
      return 'Chrome OS'
    default:
      return undefined
  }
}

function detectLinuxPlatform(): string | undefined {
  try {
    const fs = require('fs')
    const osRelease = fs.readFileSync('/etc/os-release', 'utf8')
    if (osRelease.includes('Chrome OS')) return 'Chrome OS'
    if (osRelease.includes('Chromium OS')) return 'Chromium OS'
  } catch {
    // If the file isn't readable, assume generic Linux
  }
  return undefined
}

function getPlatformVersion(): string | undefined {
  // Check if running in Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    return detectNodeVersion()
  }

  // Check if running in a browser
  if (typeof navigator !== 'undefined') {
    return detectBrowserVersion()
  }

  return undefined
}

// Get OS version in Node.js
function detectNodeVersion(): string | undefined {
  try {
    const os = require('os')
    return os.release() // Returns the OS kernel version
  } catch {
    return undefined
  }
}

// Get OS version in Browsers
function detectBrowserVersion(): string | undefined {
  if (typeof navigator !== 'undefined') {
    const nav = navigator as NavigatorWithUAData
    if ('userAgentData' in navigator && nav.userAgentData?.platformVersion) {
      return nav.userAgentData.platformVersion
    }
  }

  return undefined
}

export const DEFAULT_HEADERS = {
  'X-Client-Info': `supabase-js-${JS_ENV}/${version}`,
  'X-Supabase-Platform': getPlatformName(),
  'X-Supabase-Platform-Version': getPlatformVersion(),
  'X-Supabase-Client-Runtime': getRuntimeName(),
  'X-Supabase-Client-Runtime-Version': getRuntimeVersion(),
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
