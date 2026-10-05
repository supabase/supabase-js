-- Test-only helper: echoes back the W3C trace context headers PostgREST
-- received on the current request, so integration tests can verify that
-- trace propagation survives the full client -> Kong -> PostgREST path.
-- Deliberately returns ONLY the trace headers, never the full header map
-- (which would include authorization material).
CREATE OR REPLACE FUNCTION public.get_req_trace_headers()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'traceparent', (current_setting('request.headers', true))::json ->> 'traceparent',
    'tracestate',  (current_setting('request.headers', true))::json ->> 'tracestate',
    'baggage',     (current_setting('request.headers', true))::json ->> 'baggage'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_req_trace_headers() TO anon;
