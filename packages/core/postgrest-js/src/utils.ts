/**
 * Non-destructively merges an optional {@link HeadersInit} into a {@link Headers} object, where {@link right} takes precedence over {@link left} if it exists.
 * @param {Headers} left Base {@link Headers} object
 * @param {HeadersInit?} right Optional {@link HeadersInit} to merge into {@link left}
 * @returns The resulting merged {@link HeadersInit} object.
 */

export function mergeHeaders(left: Headers, right?: HeadersInit): HeadersInit {
  if (!right) return new Headers(left)

  const merged = new Headers(left)
  const rightEntries =
    right instanceof Headers
      ? right.entries()
      : Array.isArray(right)
      ? right
      : Object.entries(right)
  for (const [key, value] of rightEntries) {
    merged.set(key, value)
  }

  return merged
}