# @supabase/trace-propagation

W3C/OpenTelemetry trace context propagation utilities for the Supabase JS SDK.

This package provides utilities for extracting, parsing, validating, and propagating trace context headers according to the [W3C Trace Context](https://www.w3.org/TR/trace-context/) specification.

## Features

- Extract trace context from OpenTelemetry API or custom extractors
- Parse and validate W3C `traceparent` headers
- Validate target URLs for trace propagation
- Default Supabase domain allowlist
- TypeScript type definitions
- Zero dependencies (optional peer dependency on `@opentelemetry/api`)

## Installation

This package is typically used internally by `@supabase/supabase-js` and does not need to be installed directly.

## Usage

### Extract Trace Context

```typescript
import { extractTraceContext } from '@supabase/trace-propagation'

// Extract from OpenTelemetry API (if available)
const context = extractTraceContext()

// Use custom extractor
const context = extractTraceContext({
  customExtractor: () => ({
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    tracestate: 'vendor1=value1',
    baggage: 'key1=value1',
  }),
})
```

### Parse Traceparent Header

```typescript
import { parseTraceParent } from '@supabase/trace-propagation'

const parsed = parseTraceParent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01')

console.log(parsed)
// {
//   version: '00',
//   traceId: '0af7651916cd43dd8448eb211c80319c',
//   parentId: 'b7ad6b7169203331',
//   traceFlags: '01',
//   isSampled: true
// }
```

### Validate Target URLs

```typescript
import { shouldPropagateToTarget } from '@supabase/trace-propagation'

const targets = [
  'myproject.supabase.co',
  /.*\.supabase\.co$/,
  (url) => url.hostname === 'localhost',
]

const shouldPropagate = shouldPropagateToTarget(
  'https://myproject.supabase.co/rest/v1/table',
  targets
)
// true
```

### Get Default Targets

```typescript
import { getDefaultPropagationTargets } from '@supabase/trace-propagation'

const targets = getDefaultPropagationTargets('https://myproject.supabase.co')
// Returns array of default Supabase domains
```

## Type Definitions

```typescript
interface TraceContext {
  traceparent?: string
  tracestate?: string
  baggage?: string
}

interface ParsedTraceParent {
  version: string
  traceId: string
  parentId: string
  traceFlags: string
  isSampled: boolean
}

type TracePropagationTarget = string | RegExp | ((url: URL) => boolean)
```

## License

MIT
