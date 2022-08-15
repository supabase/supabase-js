import { AuthApiError, AuthUnknownError } from './errors'
import { expiresAt, resolveResponse } from './helpers'
import { AuthResponse, Session, User, UserResponse } from './types'

export type Fetch = typeof fetch

export interface FetchOptions {
  headers?: {
    [key: string]: string
  }
  noResolveJson?: boolean
}

export interface FetchParameters {
  signal?: AbortSignal
}

export type RequestMethodType = 'GET' | 'POST' | 'PUT' | 'DELETE'

const _getErrorMessage = (err: any): string =>
  err.msg || err.message || err.error_description || err.error || JSON.stringify(err)

const handleError = async (error: unknown, reject: (reason?: any) => void) => {
  const Res = await resolveResponse()

  if (error instanceof Res) {
    error.json().then((err) => {
      reject(new AuthApiError(_getErrorMessage(err), error.status || 500))
    })
  } else {
    reject(new AuthUnknownError(_getErrorMessage(error), error))
  }
}

const _getRequestParams = (
  method: RequestMethodType,
  options?: FetchOptions,
  parameters?: FetchParameters,
  body?: object
) => {
  const params: { [k: string]: any } = { method, headers: options?.headers || {} }

  if (method === 'GET') {
    return params
  }

  params.headers = { 'Content-Type': 'application/json', ...options?.headers }
  params.body = JSON.stringify(body)
  return { ...params, ...parameters }
}

interface GotrueRequestOptions extends FetchOptions {
  jwt?: string
  redirectTo?: string
  body?: object
  query?: { [key: string]: string }
  /**
   * Function that transforms api response from gotrue into a desirable / standardised format
   */
  xform?: (data: any) => any
}

export async function _request(
  fetcher: Fetch,
  method: RequestMethodType,
  url: string,
  options?: GotrueRequestOptions
) {
  const headers = options?.headers ?? {}
  if (options?.jwt) {
    headers['Authorization'] = `Bearer ${options.jwt}`
  }
  const qs = options?.query ?? {}
  if (options?.redirectTo) {
    qs['redirect_to'] = options.redirectTo
  }
  const queryString = Object.keys(qs).length ? '?' + new URLSearchParams(qs).toString() : ''
  const data = await _handleRequest(
    fetcher,
    method,
    url + queryString,
    { headers, noResolveJson: options?.noResolveJson },
    {},
    options?.body
  )
  return options?.xform ? options?.xform(data) : { data: { ...data }, error: null }
}

async function _handleRequest(
  fetcher: Fetch,
  method: RequestMethodType,
  url: string,
  options?: FetchOptions,
  parameters?: FetchParameters,
  body?: object
): Promise<any> {
  return new Promise((resolve, reject) => {
    fetcher(url, _getRequestParams(method, options, parameters, body))
      .then((result) => {
        if (!result.ok) throw result
        if (options?.noResolveJson) return result
        return result.json()
      })
      .then((data) => resolve(data))
      .catch((error) => handleError(error, reject))
  })
}

export function _sessionResponse(data: any): AuthResponse {
  let session = null
  if (hasSession(data)) {
    session = { ...data }
    session.expires_at = expiresAt(data.expires_in)
  }
  const user: User = data.user ?? (data as User)
  return { data: { session, user }, error: null }
}

export function _userResponse(data: any): UserResponse {
  const user: User = data.user ?? (data as User)
  return { data: { user }, error: null }
}

/**
 * hasSession checks if the response object contains a valid session
 * @param data A response object
 * @returns true if a session is in the response
 */
function hasSession(data: any): boolean {
  return data.access_token && data.refresh_token && data.expires_in
}
