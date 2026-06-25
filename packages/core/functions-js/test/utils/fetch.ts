/**
 * It returns a crossFetch function that uses overridden input: RequestInfo and init?: RequestInit for
 * testing purpose
 * @param {RequestInfo} reqInfo - RequestInfo or url of request
 * @param {RequestInit | undefined} [reqInit] - The RequestInit object.
 * @returns A new crossFetch function that ignores args and returns a response promise.
 */
export function getCustomFetch(
  reqInfo: RequestInfo | URL,
  reqInit?: RequestInit | undefined
): (input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<Response> {
  return (input, init) => fetch(reqInfo, reqInit)
}
