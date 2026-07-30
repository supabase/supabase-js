import {
  extractTraceContext,
  parseTraceParent,
  shouldPropagateToTarget,
  getDefaultPropagationTargets,
  type TraceContext,
  type TracePropagationTarget,
} from '@supabase/tracing'
import type { TracePropagationOptions } from './types'

type Fetch = typeof fetch

export const resolveFetch = (customFetch?: Fetch): Fetch => {
  if (customFetch) {
    return (...args: Parameters<Fetch>) => customFetch(...args)
  }
  return (...args: Parameters<Fetch>) => fetch(...args)
}

export const resolveHeadersConstructor = () => {
  return Headers
}

/**
 * New-format Supabase API keys (`sb_publishable_…` / `sb_secret_…`) are not JWTs and
 * must never be sent as a Bearer token — they belong only in the `apikey` header.
 * All other keys (legacy JWT keys, `sb_temp_…` temporary keys, unrecognized `sb_`
 * subtypes) keep the Bearer fallback.
 */
const isNewApiKey = (key: string): boolean =>
  key.startsWith('sb_publishable_') || key.startsWith('sb_secret_')

const TEMP_KEY_PREFIX = 'sb_temp_'

const warnedKeySubtypes = new Set<string>()

/**
 * Warn (once per subtype) when an `sb_` key isn't a subtype this SDK version recognizes.
 * Never throws — the server, not the SDK, decides key validity. The key value is never
 * included in the message.
 */
export const checkApiKeyFormat = (key: string): void => {
  if (!key.startsWith('sb_') || isNewApiKey(key) || key.startsWith(TEMP_KEY_PREFIX)) {
    return
  }
  const subtype = key.match(/^sb_[a-zA-Z0-9]+_/)?.[0] ?? 'unknown'
  if (warnedKeySubtypes.has(subtype)) {
    return
  }
  warnedKeySubtypes.add(subtype)
  console.warn(
    '@supabase/supabase-js: Unrecognized Supabase API key format. The client will proceed ' +
      'and send this key as-is; if you see authentication errors you may need to upgrade ' +
      '@supabase/supabase-js to a version that recognizes this key type.'
  )
}

export const fetchWithAuth = (
  supabaseKey: string,
  supabaseUrl: string,
  getAccessToken: () => Promise<string | null>,
  customFetch?: Fetch,
  tracePropagationOptions?: TracePropagationOptions,
  options?: { omitApiKeyAsBearer?: boolean }
): Fetch => {
  const fetch = resolveFetch(customFetch)
  const HeadersConstructor = resolveHeadersConstructor()

  // Pre-compute trace propagation state once. When disabled, the per-request
  // path skips all tracing work with a single truthy check.
  const traceEnabled = tracePropagationOptions?.enabled === true
  const respectSampling = tracePropagationOptions?.respectSamplingDecision !== false
  const traceTargets: TracePropagationTarget[] | null = traceEnabled
    ? getDefaultPropagationTargets(supabaseUrl)
    : null

  // Whether the API key may be used as the `Authorization` Bearer fallback when there is no
  // session token. Disabled for Edge Functions with a new-format key (see `isNewApiKey`).
  // Static per instance, so it is computed once here rather than on every request.
  const allowKeyAsBearer = !(options?.omitApiKeyAsBearer && isNewApiKey(supabaseKey))

  return async (input, init) => {
    const realToken = await getAccessToken()
    let headers = new HeadersConstructor(init?.headers)

    if (!headers.has('apikey')) {
      headers.set('apikey', supabaseKey)
    }

    if (!headers.has('Authorization')) {
      const bearer = realToken ?? (allowKeyAsBearer ? supabaseKey : null)
      if (bearer) {
        headers.set('Authorization', `Bearer ${bearer}`)
      }
    }

    if (traceTargets) {
      const traceHeaders = await getTraceHeaders(input, traceTargets, respectSampling)

      if (traceHeaders) {
        if (traceHeaders.traceparent && !headers.has('traceparent')) {
          headers.set('traceparent', traceHeaders.traceparent)
        }
        if (traceHeaders.tracestate && !headers.has('tracestate')) {
          headers.set('tracestate', traceHeaders.tracestate)
        }
        if (traceHeaders.baggage && !headers.has('baggage')) {
          headers.set('baggage', traceHeaders.baggage)
        }
      }
    }

    return fetch(input, { ...init, headers })
  }
}

async function getTraceHeaders(
  input: RequestInfo | URL,
  targets: TracePropagationTarget[],
  respectSampling: boolean
): Promise<TraceContext | null> {
  const targetUrl: string | URL =
    typeof input === 'string' ? input : input instanceof URL ? input : input.url

  if (!shouldPropagateToTarget(targetUrl, targets)) {
    return null
  }

  const traceContext = await extractTraceContext()

  if (!traceContext || !traceContext.traceparent) {
    return null
  }

  if (respectSampling) {
    const parsed = parseTraceParent(traceContext.traceparent)
    if (parsed && !parsed.isSampled) {
      return null
    }
  }

  return traceContext
}
