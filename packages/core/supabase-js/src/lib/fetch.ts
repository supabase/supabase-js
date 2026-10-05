import {
  parseTraceParent,
  shouldPropagateToTarget,
  getDefaultPropagationTargets,
  type TraceContext,
  type TracePropagationTarget,
} from '@supabase/tracing'
import { getTraceContextExtractor } from './tracingRegistry'
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
      const traceHeaders = getTraceHeaders(input, traceTargets, respectSampling)

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

let warnedMissingTracingRuntime = false
let warnedNonW3CPropagator = false

/**
 * For tests only. Resets the one-time missing-tracing-runtime warning.
 *
 * @internal
 */
export function _resetTracingRuntimeWarning(): void {
  warnedMissingTracingRuntime = false
}

/**
 * For tests only. Resets the one-time non-W3C-propagator warning.
 *
 * @internal
 */
export function _resetNonW3CPropagatorWarning(): void {
  warnedNonW3CPropagator = false
}

function getTraceHeaders(
  input: RequestInfo | URL,
  targets: TracePropagationTarget[],
  respectSampling: boolean
): TraceContext | null {
  // Read the registry before the target check so the warning fires on the
  // first request with tracing enabled, not only on Supabase-target ones.
  // Reading per request (one globalThis property access) deliberately
  // supports late registration: with ESM evaluation order, `createClient`
  // can run in a module evaluated before the application entry point's
  // `import '@supabase/supabase-js/tracing'`.
  const extractTraceContext = getTraceContextExtractor()

  if (!extractTraceContext) {
    if (!warnedMissingTracingRuntime) {
      warnedMissingTracingRuntime = true
      console.warn(
        '@supabase/supabase-js: tracePropagation is enabled but the tracing runtime is not loaded, ' +
          "so trace headers will not be attached. Add `import '@supabase/supabase-js/tracing'` at " +
          'your application entry point (requires the OpenTelemetry API package to be installed). ' +
          'The CDN/UMD build does not support trace propagation.'
      )
    }
    return null
  }

  const targetUrl: string | URL =
    typeof input === 'string' ? input : input instanceof URL ? input : input.url

  if (!shouldPropagateToTarget(targetUrl, targets)) {
    return null
  }

  const traceContext = extractTraceContext()

  if (!traceContext || !traceContext.traceparent) {
    // An active propagator that writes vendor headers but no W3C
    // `traceparent` (e.g. Sentry without `propagateTraceparent: true`) is
    // otherwise indistinguishable from "no active trace" — warn once so the
    // user learns why no trace headers are attached. An empty carrier means
    // no active trace: normal, stay silent.
    if (traceContext?.carrierKeys?.length && !warnedNonW3CPropagator) {
      warnedNonW3CPropagator = true
      const sentryHint = traceContext.carrierKeys.includes('sentry-trace')
        ? ' Sentry detected: set `propagateTraceparent: true` in Sentry.init() to emit it.'
        : ' Configure your tracing SDK to emit W3C trace context on outgoing requests.'
      console.warn(
        '@supabase/supabase-js: tracePropagation is enabled and a tracing SDK is active, but its ' +
          `propagator wrote [${traceContext.carrierKeys.join(', ')}] and no W3C traceparent header, ` +
          'so trace headers will not be attached.' +
          sentryHint
      )
    }
    return null
  }

  if (respectSampling) {
    const parsed = parseTraceParent(traceContext.traceparent)
    if (parsed && !parsed.isSampled) {
      // Unsampled traces still carry `traceparent` so Supabase logs get a
      // trace_id to correlate on; the flag stays `00`, so downstream tracing
      // never records it as sampled. `tracestate` and `baggage` (the
      // vendor/application data channels) are withheld on these requests.
      return { traceparent: traceContext.traceparent }
    }
  }

  return traceContext
}
