import { Fetch } from './types'

export const resolveFetch = (customFetch?: Fetch): Fetch => {
  if (customFetch) {
    return (...args) => customFetch(...args)
  }
  return (...args) => fetch(...args)
}

/**
 * Media types carrying JSON either are `application/json` or use the `+json`
 * structured syntax suffix defined in RFC 6839, for example
 * `application/problem+json` (RFC 9457) or `application/vnd.api+json`.
 *
 * `application/json-seq` is deliberately excluded: it is a sequence of JSON
 * texts, not a single JSON document, so `Response.json()` cannot parse it.
 *
 * @param mediaType a media type already lowercased and stripped of parameters
 */
export const isJsonMediaType = (mediaType: string): boolean =>
  mediaType === 'application/json' || /^application\/.+\+json$/.test(mediaType)
