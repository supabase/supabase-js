import { expiresAt, looksLikeFetchResponse } from './helpers'
import {
  AuthResponse,
  SSOResponse,
  GenerateLinkProperties,
  GenerateLinkResponse,
  User,
  UserResponse,
} from './types'
import { AuthApiError, AuthRetryableFetchError, AuthUnknownError } from './errors'

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
  const NETWORK_ERROR_CODES = [502, 503, 504]
  if (!looksLikeFetchResponse(error)) {
    reject(new AuthRetryableFetchError(_getErrorMessage(error), 0))
  } else if (NETWORK_ERROR_CODES.includes(error.status)) {
    // status in 500...599 range - server had an error, request might be retryed.
    reject(new AuthRetryableFetchError(_getErrorMessage(error), error.status))
  } else {
    // got a response from server that is not in the 500...599 range - should not retry
    error
      .json()
      .then((err) => {
        reject(new AuthApiError(_getErrorMessage(err), error.status || 500))
      })
      .catch((e) => {
        // not a valid json response
        reject(new AuthUnknownError(_getErrorMessage(e), e))
      })
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

  params.headers = { 'Content-Type': 'application/json;charset=UTF-8', ...options?.headers }
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
  const headers = { ...options?.headers }
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

export function _ssoResponse(data: any): SSOResponse {
  return { data, error: null }
}

export function _generateLinkResponse(data: any): GenerateLinkResponse {
  const { action_link, email_otp, hashed_token, redirect_to, verification_type, ...rest } = data

  const properties: GenerateLinkProperties = {
    action_link,
    email_otp,
    hashed_token,
    redirect_to,
    verification_type,
  }

  const user: User = { ...rest }
  return {
    data: {
      properties,
      user,
    },
    error: null,
  }
}

export function _noResolveJsonResponse(data: any): Response {
  return data
}

/**
 * hasSession checks if the response object contains a valid session
 * @param data A response object
 * @returns true if a session is in the response
 */
function hasSession(data: any): boolean {
  return data.access_token && data.refresh_token && data.expires_in
}
