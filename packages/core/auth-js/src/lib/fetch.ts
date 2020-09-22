import fetch from 'isomorphic-unfetch'

export interface FetchOptions {
  headers?: {
    [key: string]: string
  }
  noResolveJson?: boolean
}

export async function get(url: string, options?: FetchOptions) {
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: 'GET',
      headers: options?.headers || {},
    })
      .then((r) => r.json())
      .then((data) => resolve(data))
      .catch((error) => reject(error))
  })
}
export async function post(url: string, body: object, options?: FetchOptions) {
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: 'POST',
      headers: options?.headers || {},
      body: JSON.stringify(body),
    })
      .then((r) => (!options?.noResolveJson ? r.json() : null))
      .then((data) => resolve(data))
      .catch((error) => reject(error))
  })
}
export async function put(url: string, body: object, options?: FetchOptions) {
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: 'PUT',
      headers: options?.headers || {},
      body: JSON.stringify(body),
    })
      .then((r) => (!options?.noResolveJson ? r.json() : {}))
      .then((data) => resolve(data))
      .catch((error) => reject(error))
  })
}
