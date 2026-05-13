#!/usr/bin/env node
/**
 * Live integration test for trace propagation against real Supabase projects.
 *
 * Prerequisites:
 *   1. Copy .env.example to .env and fill in credentials
 *   2. npm install
 *
 * Usage:
 *   node test-live.js staging    # test against staging (default)
 *   node test-live.js prod       # test against prod
 *   node test-live.js all        # test both sequentially
 */

import 'dotenv/config'
import { trace, context, propagation } from '@opentelemetry/api'
import otelSdk from '@opentelemetry/sdk-node'
import otelResources from '@opentelemetry/resources'
import otelSemconv from '@opentelemetry/semantic-conventions'
import otelTrace from '@opentelemetry/sdk-trace-node'
import { createClient } from '@supabase/supabase-js'

const { NodeSDK } = otelSdk
const { resourceFromAttributes } = otelResources
const { ATTR_SERVICE_NAME } = otelSemconv
const { ConsoleSpanExporter } = otelTrace

// --- Helpers ---
function printHeader(title) {
  console.log('\n' + '='.repeat(70))
  console.log(title)
  console.log('='.repeat(70))
}

// --- Capture trace headers for assertions ---
let capturedHeaders = []
const originalFetch = global.fetch

function startCapture() {
  capturedHeaders = []
  const prevFetch = global.fetch
  global.fetch = async (input, init) => {
    const headers = new Headers(init?.headers)
    capturedHeaders.push({
      traceparent: headers.get('traceparent'),
      tracestate: headers.get('tracestate'),
      baggage: headers.get('baggage'),
    })
    // Log trace headers
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const tp = headers.get('traceparent')
    if (tp) {
      console.log(`  [TRACE] ${url.substring(0, 70)}...`)
      console.log(`    traceparent: ${tp}`)
    } else {
      console.log(`  [NO TRACE] ${url.substring(0, 70)}...`)
    }
    return prevFetch(input, init)
  }
  return () => {
    global.fetch = prevFetch
  }
}

async function query(supabase, table, label) {
  console.log(`\n  Request: ${label}`)
  try {
    const { error } = await supabase.from(table).select('*').limit(1)
    if (error) console.log(`  (error: ${error.message})`)
  } catch (e) {
    console.log(`  (network error - ok)`)
  }
}

// --- Run scenarios against one environment ---
async function runScenarios(envName, supabaseUrl, supabaseKey, table) {
  const tracer = trace.getTracer('trace-propagation-live-test')
  const results = []

  function record(scenario, field, pass) {
    results.push({ scenario, field, pass })
  }

  printHeader(`SCENARIO 1 [${envName}]: Default config + active OTel span`)
  console.log('EXPECT: traceparent present')
  const client1 = createClient(supabaseUrl, supabaseKey)
  const restore1 = startCapture()
  await tracer.startActiveSpan('scenario-1', async (span) => {
    const carrier = {}
    propagation.inject(context.active(), carrier)
    console.log(`  Active span traceparent: ${carrier.traceparent}`)
    await query(client1, table, 'PostgREST select')
    span.end()
  })
  restore1()
  const s1 = capturedHeaders.some((h) => h.traceparent)
  record(1, 'traceparent present', s1)
  console.log(`\n  RESULT: ${s1 ? 'PASS' : 'FAIL'}`)

  printHeader(`SCENARIO 2 [${envName}]: No active span`)
  console.log('EXPECT: no trace headers')
  const client2 = createClient(supabaseUrl, supabaseKey)
  const restore2 = startCapture()
  await query(client2, table, 'PostgREST select (no span)')
  restore2()
  const s2 = capturedHeaders.every((h) => !h.traceparent)
  record(2, 'no traceparent', s2)
  console.log(`\n  RESULT: ${s2 ? 'PASS' : 'FAIL'}`)

  printHeader(`SCENARIO 3 [${envName}]: Trace propagation disabled`)
  console.log('EXPECT: no trace headers')
  const client3 = createClient(supabaseUrl, supabaseKey, {
    tracePropagation: { enabled: false },
  })
  const restore3 = startCapture()
  await tracer.startActiveSpan('scenario-3', async (span) => {
    await query(client3, table, 'PostgREST select (disabled)')
    span.end()
  })
  restore3()
  const s3 = capturedHeaders.every((h) => !h.traceparent)
  record(3, 'no traceparent when disabled', s3)
  console.log(`\n  RESULT: ${s3 ? 'PASS' : 'FAIL'}`)

  printHeader(`SCENARIO 4 [${envName}]: respectSamplingDecision: false`)
  console.log('EXPECT: traceparent present')
  const client4 = createClient(supabaseUrl, supabaseKey, {
    tracePropagation: { respectSamplingDecision: false },
  })
  const restore4 = startCapture()
  await tracer.startActiveSpan('scenario-4', async (span) => {
    await query(client4, table, 'PostgREST select (ignore sampling)')
    span.end()
  })
  restore4()
  const s4 = capturedHeaders.some((h) => h.traceparent)
  record(4, 'traceparent present (ignore sampling)', s4)
  console.log(`\n  RESULT: ${s4 ? 'PASS' : 'FAIL'}`)

  printHeader(`SCENARIO 5 [${envName}]: Multiple services, same span`)
  console.log('EXPECT: all requests carry same trace ID')
  const client5 = createClient(supabaseUrl, supabaseKey)
  const restore5 = startCapture()
  await tracer.startActiveSpan('scenario-5-multi', async (span) => {
    const carrier = {}
    propagation.inject(context.active(), carrier)
    console.log(`  Active span traceparent: ${carrier.traceparent}`)

    console.log('\n  --- PostgREST ---')
    await query(client5, table, 'from().select()')

    console.log('\n  --- Auth ---')
    try {
      await client5.auth.getSession()
    } catch (e) {
      console.log('  (auth error - ok)')
    }

    console.log('\n  --- Storage ---')
    try {
      await client5.storage.from('test-bucket').list()
    } catch (e) {
      console.log('  (storage error - ok)')
    }

    span.end()
  })
  restore5()

  const traceIds = capturedHeaders
    .filter((h) => h.traceparent)
    .map((h) => h.traceparent.split('-')[1])
  const uniqueTraceIds = [...new Set(traceIds)]
  const s5 = traceIds.length >= 2 && uniqueTraceIds.length === 1
  record(5, 'same trace ID across services', s5)
  if (uniqueTraceIds.length > 0) {
    console.log(`\n  Trace IDs seen: ${uniqueTraceIds.join(', ')}`)
  }
  console.log(`  RESULT: ${s5 ? 'PASS' : 'FAIL'}`)

  // Summary
  printHeader(`SUMMARY (${envName})`)
  console.log('')
  for (const r of results) {
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] Scenario ${r.scenario}: ${r.field}`)
  }

  const allPass = results.every((r) => r.pass)
  console.log(`\n  Overall: ${allPass ? 'ALL PASSED' : 'SOME FAILED'}`)

  if (allPass) {
    console.log('\n  Next steps:')
    console.log('  1. Check API gateway logs for matching trace_id values')
    console.log('  2. The trace ID is chars 4-35 of the traceparent header')
    console.log('  3. Verify all services in scenario 5 share the same trace ID in server logs')
  }

  return allPass
}

// --- Main ---
async function main() {
  const arg = process.argv[2] || 'staging'
  const envs = arg === 'all' ? ['staging', 'prod'] : [arg]

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'trace-propagation-live-test' }),
    traceExporter: new ConsoleSpanExporter(),
  })
  sdk.start()

  let allPassed = true

  for (const env of envs) {
    const isStaging = env === 'staging'
    const url = isStaging ? process.env.STAGING_URL : process.env.PROD_URL
    const key = isStaging ? process.env.STAGING_KEY : process.env.PROD_KEY
    const table = process.env.TABLE || 'test'

    if (!url || !key) {
      console.error(`\nMissing ${isStaging ? 'STAGING' : 'PROD'}_URL or _KEY in .env`)
      console.error('Copy .env.example to .env and fill in your values.')
      process.exit(1)
    }

    console.log(`\nRunning against: ${env.toUpperCase()}`)
    console.log(`URL: ${url}`)
    console.log(`Table: ${table}`)

    const passed = await runScenarios(env.toUpperCase(), url, key, table)
    if (!passed) allPassed = false
  }

  await sdk.shutdown()
  process.exit(allPassed ? 0 : 1)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
