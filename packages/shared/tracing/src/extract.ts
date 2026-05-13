import type { TraceContext } from './types'

// Cache the dynamic import across all calls. Resolved (or failed) once per
// process; subsequent calls hit the resolved promise as a synchronous microtask
// instead of re-entering the module resolver.
//
// `any` here intentionally avoids referencing @opentelemetry/api types at
// compile time, since it's an optional peer dep that may not be installed.
let otelModulePromise: Promise<any | null> | null = null

function loadOtel(): Promise<any | null> {
  if (otelModulePromise === null) {
    // Dynamic import avoids bundling @opentelemetry/api and prevents bundlers
    // from emitting a top-level createRequire(import.meta.url) shim that
    // breaks Deno when the module is loaded via an https:// URL.
    // @ts-ignore - @opentelemetry/api is an optional peer dependency
    otelModulePromise = import('@opentelemetry/api').catch(() => null)
  }
  return otelModulePromise
}

/**
 * For tests only. Resets the cached OpenTelemetry import.
 *
 * @internal
 */
export function _resetOtelCache(): void {
  otelModulePromise = null
}

/**
 * Extract trace context from the OpenTelemetry API.
 *
 * Returns null if `@opentelemetry/api` is not installed or there is no active
 * trace context. The dynamic import is cached after the first call.
 *
 * @returns Trace context with traceparent, tracestate, and baggage headers, or null if unavailable
 */
export async function extractTraceContext(): Promise<TraceContext | null> {
  try {
    const otel = await loadOtel()

    if (!otel || !otel.propagation || !otel.context) {
      return null
    }

    const carrier: Record<string, string> = {}
    otel.propagation.inject(otel.context.active(), carrier)

    const traceparent = carrier['traceparent']
    if (!traceparent) {
      return null
    }

    return {
      traceparent,
      tracestate: carrier['tracestate'],
      baggage: carrier['baggage'],
    }
  } catch {
    return null
  }
}
