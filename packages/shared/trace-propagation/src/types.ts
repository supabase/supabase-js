/**
 * Trace context headers according to W3C Trace Context specification
 * @see https://www.w3.org/TR/trace-context/
 */
export interface TraceContext {
  /**
   * W3C traceparent header
   * Format: version-traceid-parentid-traceflags
   * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
   */
  traceparent?: string

  /**
   * W3C tracestate header (vendor-specific trace data)
   * Format: list of key=value pairs
   * Example: vendor1=value1,vendor2=value2
   */
  tracestate?: string

  /**
   * W3C baggage header (application-defined key-value pairs)
   * Format: list of key=value pairs with optional metadata
   * Example: key1=value1,key2=value2;metadata=foo
   */
  baggage?: string
}

/**
 * Parsed W3C traceparent header
 */
export interface ParsedTraceParent {
  /** Version field (2 hex digits, currently always "00") */
  version: string

  /** Trace ID (32 hex digits) */
  traceId: string

  /** Parent/span ID (16 hex digits) */
  parentId: string

  /** Trace flags (2 hex digits) */
  traceFlags: string

  /** True if the sampled flag (bit 0) is set */
  isSampled: boolean
}

/**
 * Target URL matcher for trace propagation
 */
export type TracePropagationTarget =
  /** Exact hostname match or wildcard domain (*.example.com) */
  | string
  /** Regex pattern matching hostname */
  | RegExp
  /** Custom function to determine if URL should receive trace context */
  | ((url: URL) => boolean)
