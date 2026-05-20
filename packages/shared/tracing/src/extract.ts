import type { TraceContext } from './types'

let otelModulePromise: Promise<any | null> | null = null

// Variable specifier + single magic-comment block: required to keep this
// import optional through webpack / turbopack / vite / rolldown. See PR #2381.
const OTEL_PKG = '@opentelemetry/api'

function loadOtel(): Promise<any | null> {
  if (otelModulePromise === null) {
    otelModulePromise = (
      import(/* @vite-ignore webpackIgnore: true turbopackIgnore: true */ OTEL_PKG) as Promise<any>
    ).catch(() => null)
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
