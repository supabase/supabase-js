import type { TraceContext } from './types'

/**
 * Structural subset of the OpenTelemetry API used to extract trace context.
 *
 * Declared structurally so this package never imports `@opentelemetry/api` —
 * callers (e.g. the `@supabase/supabase-js/tracing` subpath) pass the real
 * API object in, which keeps every module here free of OTel references and
 * safe to bundle anywhere.
 */
export interface OtelApiLike {
  propagation: {
    inject(context: unknown, carrier: Record<string, string>): void
  }
  context: {
    active(): unknown
  }
}

/**
 * Result of a trace context extraction attempt.
 *
 * Extends the W3C headers with diagnostic metadata: when a propagator is
 * registered and wrote headers to the carrier but none of them is a W3C
 * `traceparent`, `carrierKeys` lists the header *names* it wrote (never the
 * values), so callers can explain why no trace headers will be attached —
 * e.g. Sentry's propagator writes `sentry-trace` but omits `traceparent`
 * unless `propagateTraceparent: true` is set.
 */
export interface TraceExtractionResult extends TraceContext {
  carrierKeys?: string[]
}

/**
 * Reads the active trace context, or null when there is none.
 */
export type TraceContextExtractor = () => TraceExtractionResult | null

/**
 * Build a {@link TraceContextExtractor} from an OpenTelemetry API object.
 *
 * The extractor injects the active context into a fresh carrier on every
 * call and returns the W3C trace headers found there. When there is no
 * `traceparent`, it returns null for an empty carrier (no active trace) or
 * a headerless result carrying only {@link TraceExtractionResult.carrierKeys}
 * when the propagator wrote non-W3C headers. Returns null when the API
 * throws.
 */
export function createTraceContextExtractor(otel: OtelApiLike): TraceContextExtractor {
  return () => {
    try {
      const carrier: Record<string, string> = {}
      otel.propagation.inject(otel.context.active(), carrier)

      const traceparent = carrier['traceparent']
      if (!traceparent) {
        const carrierKeys = Object.keys(carrier)
        if (carrierKeys.length === 0) {
          return null
        }
        return { carrierKeys }
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
}
