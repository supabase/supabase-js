import type { TraceContext } from './types'

/**
 * Options for extracting trace context
 */
export interface ExtractOptions {
  /**
   * Custom function to extract trace context.
   * Useful when OpenTelemetry API is not available but trace context exists elsewhere.
   */
  customExtractor?: () => TraceContext | null
}

/**
 * Extract trace context from OpenTelemetry API or custom extractor.
 *
 * This function attempts to extract trace context in the following order:
 * 1. Custom extractor (if provided)
 * 2. OpenTelemetry API (if available)
 *
 * @param options - Extraction options
 * @returns Trace context with traceparent, tracestate, and baggage headers, or null if unavailable
 *
 * @example
 * ```typescript
 * // Extract from OpenTelemetry API (if available)
 * const context = extractTraceContext()
 *
 * // Use custom extractor
 * const context = extractTraceContext({
 *   customExtractor: () => ({
 *     traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
 *   })
 * })
 * ```
 */
export function extractTraceContext(options?: ExtractOptions): TraceContext | null {
  // Try custom extractor first
  if (options?.customExtractor) {
    try {
      const result = options.customExtractor()
      if (result && result.traceparent) {
        return result
      }
    } catch (error) {
      // Custom extractor failed, continue to OTel API
    }
  }

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
