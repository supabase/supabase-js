import type { TraceContext } from './types'

// Cache the dynamic import across all calls. Resolved (or failed) once per
// process; subsequent calls hit the resolved promise as a synchronous microtask
// instead of re-entering the module resolver.
//
// `any` here intentionally avoids referencing @opentelemetry/api types at
// compile time, since it's an optional peer dep that may not be installed.
let otelModulePromise: Promise<any | null> | null = null

// Indirect the specifier through a variable so static bundlers
// (webpack, turbopack, rollup, vite, esbuild) do not attempt to resolve
// @opentelemetry/api at build time. It's an optional peer dep that may not
// be installed in the consumer app; we look it up purely at runtime.
const OTEL_PKG = '@opentelemetry/api'

// Wrap import() in a Function constructor so the import() expression is
// never present as syntax in the bundled output. hermesc (the Hermes bytecode
// compiler used by React Native release builds) rejects import() at parse
// time — before any dead-code elimination — so the syntax must be physically
// absent from the bundle. new Function() bodies are opaque strings to all
// static parsers, including hermesc.
// eslint-disable-next-line no-new-func
const _dynamicImport = new Function('p', 'return import(p)') as (
  pkg: string
) => Promise<any>

function loadOtel(): Promise<any | null> {
  if (otelModulePromise === null) {
    otelModulePromise = _dynamicImport(OTEL_PKG).catch(() => null)
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
