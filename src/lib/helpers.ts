// helpers.ts

import { Jwt } from './types'

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, '')
}

export function decodeJwt(jwt: string): Jwt {
  let base64Url = jwt.split('.')[1]

  let pad = base64Url.length % 4
  if (pad) {
    if (pad === 1) {
      throw new Error('Invalid JWT - base64Url is an invalid length to determine padding')
    }

    base64Url += new Array(5 - pad).join('=')
  }

  const base64 = base64Url.replace('-', '+').replace('_', '/')

  return JSON.parse(atob(base64))
}

export function validateJwtExpiry(jwt: Jwt | string) {
  if (typeof jwt === 'string') {
    jwt = decodeJwt(jwt)
  }
  return jwt.exp > Date.now() / 1000
}

export function atob(data: string) {
  if (typeof window !== 'undefined') {
    return window.atob(data)
  }

  return Buffer.from(data, 'base64').toString('utf8')
}
