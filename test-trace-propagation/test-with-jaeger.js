import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { createClient } from '@supabase/supabase-js'
import { trace } from '@opentelemetry/api'

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'supabase-trace-test',
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
})

sdk.start()

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

const tracer = trace.getTracer('test')

await tracer.startActiveSpan('database-query', async (span) => {
  const { data, error } = await supabase.from('testtable').select('*').limit(10)

  console.log('Query completed:', data ? 'success' : 'error')
  span.end()
})

await sdk.shutdown()
