/**
 * Non-destructively merges an optional {@link HeadersInit} into a base
 * {@link Headers} object. Right-side entries take precedence over left.
 */
export function mergeHeaders(left: Headers, right?: HeadersInit): Headers {
  const merged = new Headers(left)

  if (!right) return merged

  const entries =
    right instanceof Headers
      ? right.entries()
      : Array.isArray(right)
        ? right
        : Object.entries(right)

  for (const [key, value] of entries) {
    merged.set(key, value)
  }

  return merged
}
