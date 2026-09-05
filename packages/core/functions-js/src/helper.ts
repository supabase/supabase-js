import { Fetch } from './types'

/**
 * Normalizes all header keys to lowercase with case-insensitive deduplication.
 * When duplicate keys exist (differing only in case), the last value wins.
 * Does not mutate the input object.
 *
 * Header names are case-insensitive (RFC 9110), but a plain object spread only
 * overrides on an exact key match, so unnormalized sources merge into two
 * entries that `fetch` then joins into one comma-separated value.
 *
 * @param headers - Headers object to normalize
 * @returns New headers object with all keys lowercased
 */
export const normalizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = value
  }
  return result
}

export const resolveFetch = (customFetch?: Fetch): Fetch => {
  if (customFetch) {
    return (...args) => customFetch(...args)
  }
  return (...args) => fetch(...args)
}
