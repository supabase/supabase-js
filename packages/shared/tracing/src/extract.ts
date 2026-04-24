import type { TraceContext } from './types'

/**
 * Extract trace context from OpenTelemetry API.
 *
 * This function attempts to extract trace context from the OpenTelemetry API
 * if available.
 *
 * @returns Trace context with traceparent, tracestate, and baggage headers, or null if unavailable
 *
 * @example
 * ```typescript
 * // Extract from OpenTelemetry API (if available)
 * const context = extractTraceContext()
 * ```
 */
export async function extractTraceContext(): Promise<TraceContext | null> {
  // Try OpenTelemetry API (dynamic import, fails gracefully if not available)
  try {
    // Use dynamic import to avoid bundling @opentelemetry/api and to prevent
    // bundlers from emitting a top-level createRequire(import.meta.url) shim,
    // which breaks in Deno when the module is loaded via an https:// URL.
    // @ts-ignore - @opentelemetry/api is an optional peer dependency
    const otel = await import('@opentelemetry/api')

    if (!otel || !otel.propagation || !otel.context) {
      return null
    }

    // Create a carrier object to receive propagated headers
    const carrier: Record<string, string> = {}

    // Inject current context into carrier
    otel.propagation.inject(otel.context.active(), carrier)

    // Extract W3C headers from carrier
    const traceparent = carrier['traceparent']
    const tracestate = carrier['tracestate']
    const baggage = carrier['baggage']

    // Return null if no traceparent (required header)
    if (!traceparent) {
      return null
    }

    return {
      traceparent,
      tracestate,
      baggage,
    }
  } catch (error) {
    // OpenTelemetry API not available or no active context
    return null
  }
}
