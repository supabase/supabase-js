/**
 * End-to-end tracing test against the REAL OpenTelemetry SDK — no mocked or
 * hand-rolled propagator. Exercises the actual subpath registration
 * (src/tracing.ts) with a real NodeTracerProvider, async-hooks context
 * manager, and W3C propagator, verifying the headers a client attaches for
 * an active span.
 */
import { context, propagation, trace } from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { fetchWithAuth, _resetTracingRuntimeWarning } from '../../src/lib/fetch'
import { _unregisterTraceContextExtractor } from '../../src/lib/tracingRegistry'

describe('tracing with the real OpenTelemetry SDK', () => {
  const contextManager = new AsyncHooksContextManager()
  const provider = new NodeTracerProvider()

  beforeAll(async () => {
    contextManager.enable()
    provider.register({
      contextManager,
      propagator: new W3CTraceContextPropagator(),
    })
    // The public opt-in: registers the extractor from the real OTel API.
    await import('../../src/tracing')
  })

  afterAll(async () => {
    _unregisterTraceContextExtractor()
    _resetTracingRuntimeWarning()
    await provider.shutdown()
    contextManager.disable()
    trace.disable()
    context.disable()
    propagation.disable()
  })

  const captureFetch = () => {
    const captured: Headers[] = []
    const fetchImpl = jest.fn(async (_input: any, init: any) => {
      captured.push(new Headers(init?.headers))
      return { ok: true } as Response
    })
    return { captured, fetchImpl }
  }

  test('attaches the active span trace context to Supabase requests', async () => {
    const { captured, fetchImpl } = captureFetch()
    const authFetch = fetchWithAuth(
      'test-key',
      'https://myproject.supabase.co',
      async () => 'test-token',
      fetchImpl as any,
      { enabled: true }
    )

    const tracer = trace.getTracer('test')
    let spanTraceId = ''
    let spanId = ''
    await tracer.startActiveSpan('e2e-span', async (span) => {
      spanTraceId = span.spanContext().traceId
      spanId = span.spanContext().spanId
      await authFetch('https://myproject.supabase.co/rest/v1/table')
      span.end()
    })

    const traceparent = captured[0].get('traceparent')
    // Sampled span from the default AlwaysOn sampler → flags 01.
    expect(traceparent).toBe(`00-${spanTraceId}-${spanId}-01`)
  })

  test('two requests in one span share the trace ID; separate spans do not', async () => {
    const { captured, fetchImpl } = captureFetch()
    const authFetch = fetchWithAuth(
      'test-key',
      'https://myproject.supabase.co',
      async () => 'test-token',
      fetchImpl as any,
      { enabled: true }
    )

    const tracer = trace.getTracer('test')
    await tracer.startActiveSpan('span-a', async (span) => {
      await authFetch('https://myproject.supabase.co/rest/v1/one')
      await authFetch('https://myproject.supabase.co/rest/v1/two')
      span.end()
    })
    await tracer.startActiveSpan('span-b', async (span) => {
      await authFetch('https://myproject.supabase.co/rest/v1/three')
      span.end()
    })

    const traceIds = captured.map((h) => h.get('traceparent')?.split('-')[1])
    expect(traceIds[0]).toBe(traceIds[1])
    expect(traceIds[2]).not.toBe(traceIds[0])
  })

  test('no active span → no trace headers, request unaffected', async () => {
    const { captured, fetchImpl } = captureFetch()
    const authFetch = fetchWithAuth(
      'test-key',
      'https://myproject.supabase.co',
      async () => 'test-token',
      fetchImpl as any,
      { enabled: true }
    )

    await authFetch('https://myproject.supabase.co/rest/v1/table')

    expect(captured[0].get('traceparent')).toBeNull()
    expect(captured[0].get('Authorization')).toBe('Bearer test-token')
  })

  test('non-Supabase targets never receive trace headers, even mid-span', async () => {
    const { captured, fetchImpl } = captureFetch()
    const authFetch = fetchWithAuth(
      'test-key',
      'https://myproject.supabase.co',
      async () => 'test-token',
      fetchImpl as any,
      { enabled: true }
    )

    const tracer = trace.getTracer('test')
    await tracer.startActiveSpan('span', async (span) => {
      await authFetch('https://evil.example.com/api')
      span.end()
    })

    expect(captured[0].get('traceparent')).toBeNull()
  })
})
