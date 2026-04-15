/**
 * Sets a header with case-insensitive deduplication.
 * Removes any existing headers whose name matches (case-insensitive),
 * then sets the new key/value. Does not mutate the input object.
 *
 * @param headers - Existing headers object
 * @param name - Header name to set
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

  result[name] = value
  return result
}
