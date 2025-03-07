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
    if ('userAgentData' in navigator && navigator.userAgentData?.platform) {
      return normalizePlatform(navigator.userAgentData.platform);
    }
    if (navigator.userAgent) {
      return detectFromUserAgent(navigator.userAgent)
    }
  }

  return undefined
}

function normalizePlatform(platform: string): string | undefined {
  switch (platform.toLowerCase()) {
    case "windows": return "Windows";
    case "macos": return "macOS";
    case "linux": return "Linux";
    case "android": return "Android";
    case "chrome os": return "Chrome OS";
    default: return undefined;
  }
}
function detectFromUserAgent(ua: string): string | undefined {
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/CrOS/i.test(ua)) return "Chrome OS";
  if (/Linux/i.test(ua)) return "Linux";
  return undefined;
}
function detectLinuxPlatform(): string | undefined {
  try {
    const fs = require("fs");
    const osRelease = fs.readFileSync("/etc/os-release", "utf8");
    if (osRelease.includes("Chrome OS")) return "Chrome OS";
    if (osRelease.includes("Chromium OS")) return "Chromium OS";
  } catch {
    // If the file isn't readable, assume generic Linux
  }
  return undefined;
}

function getPlatformVersion(): string | undefined {
  if (typeof process !== 'undefined' && process.versions?.node) {
    return process.versions.node
  }
  if (typeof navigator !== 'undefined' && navigator.userAgentData?.platform) {
    return navigator.userAgentData.platform
  }
  return undefined
}

function getPlatformVersion(): string | undefined {
  // Check if running in Node.js
  if (typeof process !== "undefined" && process.versions?.node) {
    return detectNodeVersion();
  }

  // Check if running in a browser
  if (typeof navigator !== "undefined") {
    return detectBrowserVersion();
  }

  return undefined;
}

// Get OS version in Node.js
function detectNodeVersion(): string | undefined {
  try {
    const os = require("os");
    return os.release(); // Returns the OS kernel version
  } catch {
    return undefined;
  }
}

// Get OS version in Browsers
function detectBrowserVersion(): string | undefined {
  if (typeof navigator !== "undefined" && "userAgentData" in navigator) {
    return navigator.userAgentData?.platformVersion || undefined;
  }

  if (typeof navigator !== "undefined" && navigator.userAgent) {
    const ua = navigator.userAgent;
    return extractVersionFromUserAgent(ua);
  }

  return undefined;
}

// Extract OS version from userAgent (legacy browsers)
function extractVersionFromUserAgent(ua: string): string | undefined {
  const versionMatch =
    ua.match(/Windows NT (\d+\.\d+)/) ||
    ua.match(/Mac OS X (\d+_\d+(_\d+)?)/) ||
    ua.match(/CPU iPhone OS (\d+_\d+(_\d+)?)/) ||
    ua.match(/Android (\d+(\.\d+)?)/) ||
    ua.match(/CrOS [\w ]+ (\d+\.\d+\.\d+)/) ||
    ua.match(/Linux (\d+\.\d+(\.\d+)?)/);

  if (versionMatch) {
    return versionMatch[1].replace(/_/g, ".");
  }

  return undefined;
}

export const DEFAULT_HEADERS = {
  'X-Client-Info': `supabase-js-${JS_ENV}/${version}`,
  'X-Supabase-Platform': getPlatformName(),
  'X-Supabase-Platform-Version': getPlatformVersion(),
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
