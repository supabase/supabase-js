/**
 * Non-destructively merges an optional {@link HeadersInit} into a base
 * {@link Headers} object. Right-side entries take precedence over left.
 */
export function mergeHeaders(left: Headers, right?: HeadersInit): Headers {
  const merged = new Headers(left)

  if (!right) return merged

  new Headers(right).forEach((value, key) => {
    merged.set(key, value)
  })

  return merged
}
