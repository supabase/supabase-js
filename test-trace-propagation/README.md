# Trace Propagation Test Application

This directory contains test scripts to verify that W3C/OpenTelemetry trace context propagation works correctly with the Supabase JS SDK.

## Prerequisites

1. Node.js 20+ installed
2. Built supabase-js package (run from repo root):
   ```bash
   npx nx build supabase-js
   ```

## Installation

```bash
cd test-trace-propagation
npm install
```

## Running Tests

### Option 1: Simple JavaScript Test (Recommended)

Run the simplified test that clearly shows trace headers in requests:

```bash
node test-trace-simple.js
```

### Option 2: Full TypeScript Test

Run the comprehensive test with detailed span information:

```bash
npm test
```

### Option 3: With Real Supabase Project

To test with a real Supabase project (optional):

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_KEY="your-anon-key"
node test-trace-simple.js
```

## What the Tests Do

### Test 1: Auto Mode (Default)

- Creates a Supabase client with default settings (auto trace propagation)
- Creates an OpenTelemetry span
- Makes a request to Supabase
- **Expected**: Request should include `traceparent`, `tracestate`, and `baggage` headers
- **Look for**: ✅ markers next to trace headers in the output

### Test 2: Off Mode

- Creates a Supabase client with `tracePropagation: { mode: 'off' }`
- Creates an OpenTelemetry span
- Makes a request to Supabase
- **Expected**: Request should NOT include any trace headers
- **Look for**: No trace headers should be present

### Test 3: Custom Extractor

- Creates a Supabase client with a custom trace context extractor
- Makes a request to Supabase
- **Expected**: Request should include the custom `traceparent` and `tracestate`
- **Look for**: Custom trace values in the headers

## Understanding the Output

### Successful Trace Propagation

When trace propagation works correctly, you'll see output like:

```
📤 HTTP Request: https://example.supabase.co/rest/v1/test...
📋 Headers:
   ✅ traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
   ✅ tracestate: vendor=value
   🔑 authorization: [REDACTED]
   🔑 apikey: [REDACTED]
```

The ✅ markers indicate trace headers are present.

### Failed Trace Propagation

If trace propagation is not working, you'll only see:

```
📤 HTTP Request: https://example.supabase.co/rest/v1/test...
📋 Headers:
   🔑 authorization: [REDACTED]
   🔑 apikey: [REDACTED]
```

No ✅ markers means no trace headers.

## Verifying with a Real OpenTelemetry Backend

To see traces in a real observability backend:

### Using Jaeger (Recommended for testing)

1. Start Jaeger with Docker:

   ```bash
   docker run -d --name jaeger \
     -e COLLECTOR_OTLP_ENABLED=true \
     -p 16686:16686 \
     -p 4318:4318 \
     jaegertracing/all-in-one:latest
   ```

2. Create `test-with-jaeger.js`:

   ```javascript
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
     const { data, error } = await supabase.from('your_table').select('*').limit(10)

     console.log('Query completed:', data ? 'success' : 'error')
     span.end()
   })

   await sdk.shutdown()
   ```

3. Run the test:

   ```bash
   SUPABASE_URL="your-url" SUPABASE_KEY="your-key" node test-with-jaeger.js
   ```

4. Open Jaeger UI:

   ```
   http://localhost:16686
   ```

5. Look for traces from the `supabase-trace-test` service

## Troubleshooting

### "Module not found" errors

Make sure you've installed dependencies:

```bash
npm install
```

### "Cannot find module '@supabase/supabase-js'"

Build the supabase-js package first:

```bash
cd ..
npx nx build supabase-js
cd test-trace-propagation
```

### No trace headers in output

1. Verify OpenTelemetry is initialized before creating the client
2. Check that the request is made within an active span
3. Ensure `tracePropagation.mode` is not set to `'off'`

### Requests fail with authentication errors

This is expected when using placeholder credentials. The test is checking for trace headers in the request, not the response. Authentication errors don't affect trace propagation testing.

## Expected Behavior

✅ **Test 1 (Auto)**: Should see traceparent header with trace ID matching the active span
❌ **Test 2 (Off)**: Should NOT see any trace headers
🔧 **Test 3 (Custom)**: Should see custom traceparent value

## Integration with OpenTelemetry Collectors

The trace context propagated by Supabase JS SDK is compatible with:

- OpenTelemetry Collector
- Jaeger
- Zipkin
- Datadog APM
- New Relic
- Honeycomb
- Any W3C Trace Context compliant system

## Additional Resources

- [W3C Trace Context Spec](https://www.w3.org/TR/trace-context/)
- [OpenTelemetry JS Docs](https://opentelemetry.io/docs/languages/js/)
- [Supabase JS SDK Docs](https://supabase.com/docs/reference/javascript/start)
