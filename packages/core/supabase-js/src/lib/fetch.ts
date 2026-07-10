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
 * Legacy (JWT) keys predate this format and keep their existing behavior.
 */
const isNewApiKey = (key: string): boolean =>
  key.startsWith('sb_publishable_') || key.startsWith('sb_secret_')

export const fetchWithAuth = (
  supabaseKey: string,
  supabaseUrl: string,
  getAccessToken: () => Promise<string | null>,
  customFetch?: Fetch,
  tracePropagationOptions?: TracePropagationOptions,
  options?: { isFunctionsClient?: boolean }
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

  return async (input, init) => {
    const accessToken = (await getAccessToken()) ?? supabaseKey
    let headers = new HeadersConstructor(init?.headers)

    if (!headers.has('apikey')) {
      headers.set('apikey', supabaseKey)
    }

    if (!headers.has('Authorization')) {
      // Edge Functions: a new-format API key must never be sent as a Bearer token —
      // it belongs only in the `apikey` header. Reserve Authorization for a real user
      // or custom session token. `accessToken === supabaseKey` means there is no such
      // token (getAccessToken falls back to the key). Legacy JWT keys are unchanged.
      const omitKeyInAuth =
        options?.isFunctionsClient && accessToken === supabaseKey && isNewApiKey(supabaseKey)
      if (!omitKeyInAuth) {
        headers.set('Authorization', `Bearer ${accessToken}`)
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
