/**
 * Sets a header with case-insensitive deduplication.
 * Removes any existing headers whose name matches (case-insensitive),
 * then sets the value under the lowercase key. Does not mutate the input object.
 *
 * @param headers - Existing headers object
 * @param name - Header name to set (stored as lowercase)
 * @param value - Header value
 * @returns New headers object with the header set
 */
export function setHeader(
  headers: Record<string, string>,
  name: string,
  value: string
): Record<string, string> {
  const result = { ...headers }
  const nameLower = name.toLowerCase()

  for (const key of Object.keys(result)) {
    if (key.toLowerCase() === nameLower) {
      delete result[key]
    }
  }

  result[nameLower] = value
  return result
}

/**
 * Normalizes all header keys to lowercase with case-insensitive deduplication.
 * When duplicate keys exist (differing only in case), the last value wins.
 * Does not mutate the input object.
 *
 * @param headers - Headers object to normalize
 * @returns New headers object with all keys lowercased
 */
export function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = value
  }
  return result
}
