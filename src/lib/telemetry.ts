import { context, Context, Span, SpanStatusCode, trace } from '@opentelemetry/api'
import { version } from './version'

export const tracer = trace.getTracer('supabase-js', version)

export function withSpan<T>(
  name: string,
  fn: (ctx: Context, span: Span) => T | Promise<T>,
  ctx: Context = context.active()
): T | Promise<T> {
  const span = tracer.startSpan(name, undefined, ctx)
  const spanCtx = trace.setSpan(ctx, span)

  try {
    const result = fn(spanCtx, span)

    if (result instanceof Promise) {
      return result
        .catch((err) => {
          span.recordException(err)
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
          throw err
        })
        .finally(() => {
          span.end()
        })
    } else {
      span.end()
      return result
    }
  } catch (err: any) {
    span.recordException(err)
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
    span.end()
    throw err
  }
}
