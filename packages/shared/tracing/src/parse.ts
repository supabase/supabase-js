import type { ParsedTraceParent } from './types'

/**
 * Parse W3C traceparent header according to the specification.
 *
 * The traceparent header format is: version-traceid-parentid-traceflags
 * - version: 2 hex digits (currently always "00")
 * - traceid: 32 hex digits (128-bit trace identifier)
 * - parentid: 16 hex digits (64-bit span/parent identifier)
 * - traceflags: 2 hex digits (8-bit flags, bit 0 is sampled flag)
 *
 * @param traceparent - The traceparent header value
 * @returns Parsed traceparent object, or null if invalid format
 *
 * @see https://www.w3.org/TR/trace-context/#traceparent-header
 *
 * @example
 * ```typescript
 * const parsed = parseTraceParent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01')
 *
 * console.log(parsed)
 * // {
 * //   version: '00',
 * //   traceId: '0af7651916cd43dd8448eb211c80319c',
 * //   parentId: 'b7ad6b7169203331',
 * //   traceFlags: '01',
 * //   isSampled: true
 * // }
 * ```
 */
export function parseTraceParent(traceparent: string): ParsedTraceParent | null {
  if (!traceparent || typeof traceparent !== 'string') {
    return null
  }

  // Split by hyphen
  const parts = traceparent.split('-')

  // Must have exactly 4 parts
  if (parts.length !== 4) {
    return null
  }

  const [version, traceId, parentId, traceFlags] = parts

  // Validate field lengths according to W3C spec
  if (
    version.length !== 2 ||
    traceId.length !== 32 ||
    parentId.length !== 16 ||
    traceFlags.length !== 2
  ) {
    return null
  }

  // Validate that all fields are valid hexadecimal
  const hexRegex = /^[0-9a-f]+$/i
  if (
    !hexRegex.test(version) ||
    !hexRegex.test(traceId) ||
    !hexRegex.test(parentId) ||
    !hexRegex.test(traceFlags)
  ) {
    return null
  }

  // Validate that trace-id and parent-id are not all zeros (invalid per spec)
  if (traceId === '00000000000000000000000000000000' || parentId === '0000000000000000') {
    return null
  }

  // Parse sampling decision from trace-flags (bit 0)
  const flags = parseInt(traceFlags, 16)
  const isSampled = (flags & 0x01) === 0x01

  return {
    version,
    traceId,
    parentId,
    traceFlags,
    isSampled,
  }
}
