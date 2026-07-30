import type { TraceContextExtractor } from '@supabase/tracing'

export type { TraceContextExtractor }

// The extractor lives in a `Symbol.for()`-keyed slot on `globalThis` rather
// than a module-level variable. Bundlers and the ESM/CJS dual build can load
// this module more than once in a single application (e.g. the tracing
// subpath resolved to `dist/tracing.mjs` while the main entry resolves to
// `dist/index.cjs`) — separate module instances would each get their own
// variable, but they all share the global symbol registry.
//
// The symbol string is a de-facto stable contract: module-resolution tests
// read the slot directly, and changing it orphans registrations from other
// copies of this package in the same process.
const EXTRACTOR_KEY = Symbol.for('@supabase/supabase-js.traceContextExtractor')

type ExtractorSlot = { [EXTRACTOR_KEY]?: TraceContextExtractor }

/**
 * Register the trace context extractor used by all Supabase clients in this
 * process. Called by the `@supabase/supabase-js/tracing` subpath as an import
 * side effect; the last registration wins.
 */
export function registerTraceContextExtractor(extractor: TraceContextExtractor): void {
  ;(globalThis as ExtractorSlot)[EXTRACTOR_KEY] = extractor
}

/**
 * The currently registered trace context extractor, if any.
 */
export function getTraceContextExtractor(): TraceContextExtractor | undefined {
  return (globalThis as ExtractorSlot)[EXTRACTOR_KEY]
}

/**
 * For tests only. Removes the registered extractor.
 *
 * @internal
 */
export function _unregisterTraceContextExtractor(): void {
  delete (globalThis as ExtractorSlot)[EXTRACTOR_KEY]
}
