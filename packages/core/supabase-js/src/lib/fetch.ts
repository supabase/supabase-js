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
 * Legacy (JWT) keys predate this format (they don't start with `sb_`) and keep their
 * existing behavior. Any other `sb_`-prefixed key is an unrecognized future subtype;
 * see {@link assertSupportedApiKey}.
 */
const isNewApiKey = (key: string): boolean =>
  key.startsWith('sb_publishable_') || key.startsWith('sb_secret_')

/**
 * Fail fast on an `sb_`-family key whose subtype this SDK version does not recognize, so a
 * future key type can never be silently mistreated as a legacy JWT and sent as a Bearer
 * token. Recognized new-format keys and legacy JWT keys (no `sb_` prefix) pass through.
 * The key itself is never included in the message to avoid leaking secret keys.
 */
export const assertSupportedApiKey = (key: string): void => {
  if (key.startsWith('sb_') && !isNewApiKey(key)) {
    throw new Error(
      '@supabase/supabase-js: Unrecognized Supabase API key format. Expected a legacy JWT key ' +
        'or a new-format key (sb_publishable_… / sb_secret_…). This "sb_" key type is not ' +
        'supported by this version of the SDK — please upgrade @supabase/supabase-js.'
    )
  }
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
