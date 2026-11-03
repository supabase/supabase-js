/**
 * Opt-in OpenTelemetry runtime for `tracePropagation`.
 *
 * Importing this module registers the OpenTelemetry trace context extractor
 * used by every Supabase client in the process. It has no exports — the
 * import itself is the opt-in:
 *
 * ```ts
 * import '@supabase/supabase-js/tracing'
 * import { createClient } from '@supabase/supabase-js'
 *
 * const supabase = createClient(url, key, { tracePropagation: true })
 * ```
 *
 * Requires `@opentelemetry/api` to be installed — this module imports it
 * directly, so bundlers include it and resolution fails loudly when it is
 * missing. Without this import, enabling `tracePropagation` logs a one-time
 * warning and requests are sent without trace headers.
 *
 * @module tracing
 */
import { propagation, context } from '@opentelemetry/api'
import { createTraceContextExtractor } from '@supabase/tracing'
import { registerTraceContextExtractor } from './lib/tracingRegistry'

registerTraceContextExtractor(createTraceContextExtractor({ propagation, context }))
