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
export function extractTraceContext(): TraceContext | null {
  // Try OpenTelemetry API (dynamic require, fails gracefully if not available)
  try {
    // Use dynamic require to avoid bundling @opentelemetry/api
    // This will only work if the user has installed it
    const otel = require('@opentelemetry/api')

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
