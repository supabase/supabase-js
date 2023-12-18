import { expiresAt, looksLikeFetchResponse } from './helpers'
import {
  AuthResponse,
  AuthResponsePassword,
  SSOResponse,
  GenerateLinkProperties,
  GenerateLinkResponse,
  User,
  UserResponse,
} from './types'
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthWeakPasswordError,
  AuthUnknownError,
} from './errors'

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

const NETWORK_ERROR_CODES = [502, 503, 504]

async function handleError(error: unknown) {
  if (!looksLikeFetchResponse(error)) {
    throw new AuthRetryableFetchError(_getErrorMessage(error), 0)
  }

  if (NETWORK_ERROR_CODES.includes(error.status)) {
    // status in 500...599 range - server had an error, request might be retryed.
    throw new AuthRetryableFetchError(_getErrorMessage(error), error.status)
  }

  let data: any
  try {
    data = await error.json()
  } catch (e: any) {
    throw new AuthUnknownError(_getErrorMessage(e), e)
  }

  if (
    typeof data === 'object' &&
    data &&
    typeof data.weak_password === 'object' &&
    data.weak_password &&
    Array.isArray(data.weak_password.reasons) &&
    data.weak_password.reasons.length &&
    data.weak_password.reasons.reduce((a: boolean, i: any) => a && typeof i === 'string', true)
  ) {
    throw new AuthWeakPasswordError(
      _getErrorMessage(data),
      error.status,
      data.weak_password.reasons
    )
  }

  throw new AuthApiError(_getErrorMessage(data), error.status || 500)
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
  const requestParams = _getRequestParams(method, options, parameters, body)

  let result: any

  try {
    result = await fetcher(url, requestParams)
  } catch (e) {
    console.error(e)

    // fetch failed, likely due to a network or CORS error
    throw new AuthRetryableFetchError(_getErrorMessage(e), 0)
  }

  if (!result.ok) {
    await handleError(result)
  }

  if (options?.noResolveJson) {
    return result
  }

  try {
    return await result.json()
  } catch (e: any) {
    await handleError(e)
  }
}

export function _sessionResponse(data: any): AuthResponse {
  let session = null
  if (hasSession(data)) {
    session = { ...data }

    if (!data.expires_at) {
      session.expires_at = expiresAt(data.expires_in)
    }
  }

  const user: User = data.user ?? (data as User)
  return { data: { session, user }, error: null }
}

export function _sessionResponsePassword(data: any): AuthResponsePassword {
  const response = _sessionResponse(data) as AuthResponsePassword

  if (
    !response.error &&
    data.weak_password &&
    typeof data.weak_password === 'object' &&
    Array.isArray(data.weak_password.reasons) &&
    data.weak_password.reasons.length &&
    data.weak_password.message &&
    typeof data.weak_password.message === 'string' &&
    data.weak_password.reasons.reduce((a: boolean, i: any) => a && typeof i === 'string', true)
  ) {
    response.data.weak_password = data.weak_password
  }

  return response
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
