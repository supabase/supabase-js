import fetch from 'cross-fetch'

export interface FetchOptions {
  headers?: {
    [key: string]: string
  }
  noResolveJson?: boolean
}

const handleError = (error: any, reject: any) => {
  if (typeof error.json === 'function') {
    error.json().then((msg: any) => {
      let errorMessage =
        msg.msg || msg.message || msg.error_description || msg.error || JSON.stringify(msg)
      return reject(new Error(errorMessage))
    })
  } else {
    return reject(error)
  }
}

export async function get(url: string, options?: FetchOptions) {
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: 'GET',
      headers: options?.headers || {},
    })
      .then((result) => {
        if (!result.ok) throw result
        else if (options?.noResolveJson) return resolve
        else return result.json()
      })
      .then((data) => resolve(data))
      .catch((error) => handleError(error, reject))
  })
}
export async function post(url: string, body: object, options?: FetchOptions) {
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: 'POST',
      headers: options?.headers || {},
      body: JSON.stringify(body),
    })
      .then((result) => {
        if (!result.ok) throw result
        else if (options?.noResolveJson) return resolve
        else return result.json()
      })
      .then((data) => resolve(data))
      .catch((error) => handleError(error, reject))
  })
}
export async function put(url: string, body: object, options?: FetchOptions) {
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: 'PUT',
      headers: options?.headers || {},
      body: JSON.stringify(body),
    })
      .then((result) => {
        if (!result.ok) throw result
        else if (options?.noResolveJson) return resolve
        else return result.json()
      })
      .then((data) => resolve(data))
      .catch((error) => handleError(error, reject))
  })
}
