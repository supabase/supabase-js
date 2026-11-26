// constants.ts
import { RealtimeClientOptions } from '@supabase/realtime-js'
import { SupabaseAuthClientOptions, TracePropagationOptions } from './types'
import { version } from './version'

type ClientEnvironment = {
  platform?: string
  platformVersion?: string
  runtime?: string
  runtimeVersion?: string
  framework?: string
  frameworkVersion?: string
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function detectDenoPlatform(globals: any): Pick<ClientEnvironment, 'platform' | 'platformVersion'> {
  if (typeof globals.EdgeRuntime === 'object' && globals.EdgeRuntime !== null) {
    return { platform: 'edge-runtime', platformVersion: asString(globals.SUPABASE_VERSION) }
  }
  if (typeof globals.Netlify !== 'undefined') {
    return { platform: 'netlify-edge' }
  }
  return {}
}

function detectElectronFromUserAgent(userAgent: string | undefined): ClientEnvironment {
  const electronVersion = userAgent?.match(/\bElectron\/([\w.-]+)/)?.[1]
  return electronVersion ? { framework: 'electron', frameworkVersion: electronVersion } : {}
}

export function detectClientEnvironment(globals: any = globalThis): ClientEnvironment {
  const userAgent = asString(globals.navigator?.userAgent)

  if (userAgent === 'Cloudflare-Workers') {
    return { platform: 'cloudflare-workers' }
  }
  if (typeof globals.Deno !== 'undefined') {
    return {
      ...detectDenoPlatform(globals),
      runtime: 'deno',
      runtimeVersion: asString(globals.Deno.version?.deno),
    }
  }
  if (typeof globals.Bun !== 'undefined') {
    return { runtime: 'bun', runtimeVersion: asString(globals.Bun.version) }
  }
  if (typeof globals.EdgeRuntime === 'string') {
    return { platform: 'vercel-edge-runtime' }
  }
  if (globals.navigator?.product === 'ReactNative') {
    return { framework: 'react-native' }
  }
  if (typeof globals.document !== 'undefined' || typeof globals.WorkerGlobalScope !== 'undefined') {
    return { platform: 'browser', ...detectElectronFromUserAgent(userAgent) }
  }

  const processVersions = globals.process?.['versions']
  const electronVersion = asString(processVersions?.['electron'])
  return {
    runtime: 'node',
    runtimeVersion: asString(globals.process?.['version'])?.replace(/^v/, ''),
    ...(electronVersion ? { framework: 'electron', frameworkVersion: electronVersion } : {}),
  }
}

export function formatClientEnvironment(environment: ClientEnvironment): string[] {
  const parameters: [string, string | undefined][] = [
    ['platform', environment.platform],
    ['platform-version', environment.platformVersion],
    ['runtime', environment.runtime],
    ['runtime-version', environment.runtimeVersion],
    ['framework', environment.framework],
    ['framework-version', environment.frameworkVersion],
  ]
  return parameters.filter(([, value]) => value).map(([key, value]) => `${key}=${value}`)
}

export const DEFAULT_HEADERS = {
  'X-Client-Info': [
    `supabase-js/${version}`,
    ...formatClientEnvironment(detectClientEnvironment()),
  ].join('; '),
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
