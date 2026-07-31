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
 * Reads the active trace context, or null when there is none.
 */
export type TraceContextExtractor = () => TraceContext | null

/**
 * Build a {@link TraceContextExtractor} from an OpenTelemetry API object.
 *
 * The extractor injects the active context into a fresh carrier on every
 * call and returns the W3C trace headers found there, or null when there is
 * no active trace (no `traceparent`) or the API throws.
 */
export function createTraceContextExtractor(otel: OtelApiLike): TraceContextExtractor {
  return () => {
    try {
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
}
