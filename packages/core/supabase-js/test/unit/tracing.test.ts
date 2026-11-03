import {
  getTraceContextExtractor,
  _unregisterTraceContextExtractor,
} from '../../src/lib/tracingRegistry'

const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'

// The subpath imports @opentelemetry/api statically; mock it so the test
// exercises the registration side effect without a real OTel setup.
jest.mock('@opentelemetry/api', () => ({
  propagation: {
    inject: jest.fn((_context: unknown, carrier: Record<string, string>) => {
      carrier['traceparent'] = TRACEPARENT
      carrier['tracestate'] = 'vendor1=value1'
    }),
  },
  context: {
    active: jest.fn(() => ({})),
  },
}))

describe('@supabase/supabase-js/tracing subpath', () => {
  afterEach(() => {
    _unregisterTraceContextExtractor()
  })

  test('importing the module registers a working extractor', async () => {
    expect(getTraceContextExtractor()).toBeUndefined()

    await import('../../src/tracing')

    const extractor = getTraceContextExtractor()
    expect(typeof extractor).toBe('function')
    expect(extractor!()).toEqual({
      traceparent: TRACEPARENT,
      tracestate: 'vendor1=value1',
      baggage: undefined,
    })
  })
})
