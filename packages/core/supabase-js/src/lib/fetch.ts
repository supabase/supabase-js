import {
  extractTraceContext,
  parseTraceParent,
  shouldPropagateToTarget,
  getDefaultPropagationTargets,
  type TraceContext,
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

export const fetchWithAuth = (
  supabaseKey: string,
  supabaseUrl: string,
  getAccessToken: () => Promise<string | null>,
  customFetch?: Fetch,
  tracePropagationOptions?: TracePropagationOptions
): Fetch => {
  const fetch = resolveFetch(customFetch)
  const HeadersConstructor = resolveHeadersConstructor()

  return async (input, init) => {
    const accessToken = (await getAccessToken()) ?? supabaseKey
    let headers = new HeadersConstructor(init?.headers)

    // Inject auth headers
    if (!headers.has('apikey')) {
      headers.set('apikey', supabaseKey)
    }

    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    // Inject trace headers
    const traceHeaders = getTraceHeaders(input, supabaseUrl, tracePropagationOptions)

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

    return fetch(input, { ...init, headers })
  }
}

/**
 * Get trace headers to inject into outgoing requests.
 *
 * @param input - The request URL
 * @param supabaseUrl - The Supabase project URL
 * @param options - Trace propagation options
 * @returns Trace context headers, or null if trace propagation is disabled or unavailable
 */
function getTraceHeaders(
  input: RequestInfo | URL,
  supabaseUrl: string,
  options?: TracePropagationOptions
): TraceContext | null {
  // Check if trace propagation is enabled
  if (options?.enabled === false) {
    return null
  }

  // Get target URL
  const targetUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  // Get propagation targets (use defaults if not specified)
  const targets = options?.targets ?? getDefaultPropagationTargets(supabaseUrl)

  // Check if we should propagate to this target
  if (!shouldPropagateToTarget(targetUrl, targets)) {
    return null
  }

  // Extract trace context
  const traceContext = extractTraceContext()

  if (!traceContext || !traceContext.traceparent) {
    return null
  }

  // Check sampling decision if respectSamplingDecision is enabled
  if (options?.respectSamplingDecision !== false) {
    const parsed = parseTraceParent(traceContext.traceparent)
    if (parsed && !parsed.isSampled) {
      return null
    }
  }

  return traceContext
}
