/**
 * Type tests for the /tracing subpath export.
 *
 * The subpath is side-effect-only (no exports), so the main assertion is
 * that it compiles as a bare import. The registry types are checked through
 * the internal module the subpath registers into.
 */

import { expectType } from 'tsd'
import '../../src/tracing'
import {
  getTraceContextExtractor,
  registerTraceContextExtractor,
  type TraceContextExtractor,
} from '../../src/lib/tracingRegistry'

// Test: the registry exposes the extractor as optional
expectType<TraceContextExtractor | undefined>(getTraceContextExtractor())

// Test: an extractor returning null is a valid registration
expectType<void>(registerTraceContextExtractor(() => null))

// Test: an extractor returning W3C headers is a valid registration
expectType<void>(
  registerTraceContextExtractor(() => ({
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    tracestate: 'vendor1=value1',
    baggage: 'key1=value1',
  }))
)
