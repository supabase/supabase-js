import {
  DEFAULT_MAX_RETRIES,
  Fetch,
  getRetryDelay,
  RETRYABLE_METHODS,
  RETRYABLE_STATUS_CODES,
} from './types/common/common'

/**
 * Sleep for a given number of milliseconds.
 * If an AbortSignal is provided, the sleep resolves early when the signal is aborted.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(id)
      resolve()
    }
    signal?.addEventListener('abort', onAbort)
  })
}

/**
 * Check if a request should be retried based on method and status code.
 */
function shouldRetry(
  method: string,
  status: number,
  attemptCount: number,
  retryEnabled: boolean
): boolean {
  // Don't retry if retries are disabled or we've exhausted attempts
  if (!retryEnabled || attemptCount >= DEFAULT_MAX_RETRIES) {
    return false
  }

  // Only retry idempotent methods (GET, HEAD, OPTIONS)
  if (!RETRYABLE_METHODS.includes(method as (typeof RETRYABLE_METHODS)[number])) {
    return false
  }

  // Only retry on specific status codes (520 - Cloudflare errors)
  if (!RETRYABLE_STATUS_CODES.includes(status as (typeof RETRYABLE_STATUS_CODES)[number])) {
    return false
  }

  return true
}

export interface RetryableRequest {
  method: string
  /** Plain object, never a Headers instance: React Native's XHR-based fetch drops the latter. */
  headers: Record<string, string>
  body?: string
  signal?: AbortSignal
}

/**
 * Perform a request with the retry policy shared by every PostgREST call.
 *
 * Idempotent methods (GET, HEAD, OPTIONS) are retried up to
 * `DEFAULT_MAX_RETRIES` times when the fetch rejects or the server answers
 * with a retryable status (503, 520). The wait honours the `Retry-After`
 * header when present and backs off exponentially otherwise. Retried
 * attempts carry an `X-Retry-Count` header. Aborted requests and
 * non-idempotent methods are never retried: their rejection propagates
 * unchanged. A response body is drained before its request is retried.
 */
export async function fetchWithRetry(
  fetchImpl: Fetch,
  url: string,
  request: RetryableRequest,
  retryEnabled: boolean
): Promise<Response> {
  let attemptCount = 0

  while (true) {
    const headers: Record<string, string> = { ...request.headers }
    if (attemptCount > 0) {
      headers['X-Retry-Count'] = String(attemptCount)
    }

    let res: Response
    try {
      res = await fetchImpl(url, {
        method: request.method,
        headers,
        body: request.body,
        signal: request.signal,
      })
      // JS allows throwing any value, and serverless or realm-crossing fetch
      // implementations can reject with non-Error objects. `instanceof Error`
      // is too narrow here; narrow at the use site with optional chaining.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (fetchError: any) {
      // Never retry aborted requests
      if (fetchError?.name === 'AbortError' || fetchError?.code === 'ABORT_ERR') {
        throw fetchError
      }

      // Don't retry network errors for non-idempotent methods
      if (!RETRYABLE_METHODS.includes(request.method as (typeof RETRYABLE_METHODS)[number])) {
        throw fetchError
      }

      // Check if we should retry network errors
      if (retryEnabled && attemptCount < DEFAULT_MAX_RETRIES) {
        const delay = getRetryDelay(attemptCount)
        attemptCount++
        await sleep(delay, request.signal)
        continue
      }

      // Exhausted retries or retries disabled, throw the last error
      throw fetchError
    }

    // Check if we should retry this HTTP response
    if (shouldRetry(request.method, res.status, attemptCount, retryEnabled)) {
      const retryAfterHeader = res.headers?.get('Retry-After') ?? null
      const delay =
        retryAfterHeader !== null
          ? Math.max(0, parseInt(retryAfterHeader, 10) || 0) * 1000
          : getRetryDelay(attemptCount)
      await res.text()
      attemptCount++
      await sleep(delay, request.signal)
      continue
    }

    return res
  }
}
