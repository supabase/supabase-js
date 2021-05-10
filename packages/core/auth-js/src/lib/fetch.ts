import fetch from 'cross-fetch'

export interface FetchOptions {
  headers?: {
    [key: string]: string
  }
  noResolveJson?: boolean
}

export type RequestMethodType = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const _getErrorMessage = (err: any): string =>
  err.msg || err.message || err.error_description || err.error || JSON.stringify(err)

const handleError = (error: any, reject: any) => {
  if (typeof error.json !== 'function') {
    return reject(error)
  }
  error.json().then((err: any) => {
    return reject({
      message: _getErrorMessage(err),
      status: error?.status || 500,
    })
  })
}

const _getRequestParams = (method: RequestMethodType, options?: FetchOptions, body?: object) => {
  const params: { [k: string]: any } = { method, headers: options?.headers || {} }

  if (method === 'GET') {
    return params
  }

  params.headers = { 'Content-Type': 'text/plain;charset=UTF-8', ...options?.headers }
  params.body = JSON.stringify(body)

  return params
}

async function _handleRequest(
  method: RequestMethodType,
  url: string,
  options?: FetchOptions,
  body?: object
): Promise<any> {
  return new Promise((resolve, reject) => {
    fetch(url, _getRequestParams(method, options, body))
      .then((result) => {
        if (!result.ok) throw result
        if (options?.noResolveJson) return resolve
        return result.json()
      })
      .then((data) => resolve(data))
      .catch((error) => handleError(error, reject))
  })
}

export async function get(url: string, options?: FetchOptions): Promise<any> {
  return _handleRequest('GET', url, options)
}

export async function post(url: string, body: object, options?: FetchOptions): Promise<any> {
  return _handleRequest('POST', url, options, body)
}

export async function put(url: string, body: object, options?: FetchOptions): Promise<any> {
  return _handleRequest('PUT', url, options, body)
}

export async function remove(url: string, body: object, options?: FetchOptions): Promise<any> {
  return _handleRequest('DELETE', url, options, body)
}
