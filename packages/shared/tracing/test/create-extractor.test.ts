import { createTraceContextExtractor, type OtelApiLike } from '../src/create-extractor'

const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'

function fakeOtel(inject: OtelApiLike['propagation']['inject']): OtelApiLike {
  return {
    propagation: { inject },
    context: { active: () => ({ marker: 'active-context' }) },
  }
}

describe('createTraceContextExtractor', () => {
  it('returns the injected W3C headers', () => {
    const extract = createTraceContextExtractor(
      fakeOtel((_context, carrier) => {
        carrier['traceparent'] = TRACEPARENT
        carrier['tracestate'] = 'vendor1=value1'
        carrier['baggage'] = 'key1=value1'
      })
    )

    expect(extract()).toEqual({
      traceparent: TRACEPARENT,
      tracestate: 'vendor1=value1',
      baggage: 'key1=value1',
    })
  })

  it('passes the active context to inject', () => {
    const seen: unknown[] = []
    const extract = createTraceContextExtractor(
      fakeOtel((context, carrier) => {
        seen.push(context)
        carrier['traceparent'] = TRACEPARENT
      })
    )

    extract()

    expect(seen).toEqual([{ marker: 'active-context' }])
  })

  it('returns null when the carrier is empty (no active trace)', () => {
    const extract = createTraceContextExtractor(fakeOtel(() => {}))

    expect(extract()).toBeNull()
  })

  it('returns the carrier key names when headers are injected without a traceparent', () => {
    const extract = createTraceContextExtractor(
      fakeOtel((_context, carrier) => {
        // A Sentry-like propagator: vendor headers, no W3C traceparent.
        carrier['sentry-trace'] = '0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331'
        carrier['baggage'] = 'sentry-public_key=abc'
      })
    )

    // Key names only — header values must never leak into the result.
    expect(extract()).toEqual({ carrierKeys: ['sentry-trace', 'baggage'] })
  })

  it('returns null when inject throws', () => {
    const extract = createTraceContextExtractor(
      fakeOtel(() => {
        throw new Error('no global propagator')
      })
    )

    expect(extract()).toBeNull()
  })

  it('uses a fresh carrier on every call', () => {
    const carriers: Record<string, string>[] = []
    let call = 0
    const extract = createTraceContextExtractor(
      fakeOtel((_context, carrier) => {
        carriers.push(carrier)
        // Only the first call has an active trace.
        if (call++ === 0) {
          carrier['traceparent'] = TRACEPARENT
        }
      })
    )

    expect(extract()).not.toBeNull()
    expect(extract()).toBeNull()
    expect(carriers).toHaveLength(2)
    expect(carriers[0]).not.toBe(carriers[1])
    expect(carriers[1]).toEqual({})
  })
})
