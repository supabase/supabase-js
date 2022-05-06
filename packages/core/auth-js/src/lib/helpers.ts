import crossFetch from 'cross-fetch'
import { SupportedStorage } from './types'

export function expiresAt(expiresIn: number) {
  const timeNow = Math.round(Date.now() / 1000)
  return timeNow + expiresIn
}

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const isBrowser = () => typeof window !== 'undefined'

export function getParameterByName(name: string, url?: string) {
  if (!url) url = window?.location?.href || ''
  // eslint-disable-next-line no-useless-escape
  name = name.replace(/[\[\]]/g, '\\$&')
  const regex = new RegExp('[?&#]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

type Fetch = typeof fetch

export const resolveFetch = (customFetch?: Fetch): Fetch => {
  let _fetch: Fetch
  if (customFetch) {
    _fetch = customFetch
  } else if (typeof fetch === 'undefined') {
    _fetch = crossFetch as unknown as Fetch
  } else {
    _fetch = fetch
  }
  return (...args) => _fetch(...args)
}

// LocalStorage helpers
export const setItemAsync = async (
  storage: SupportedStorage,
  key: string,
  data: any
): Promise<void> => {
  isBrowser() && (await storage?.setItem(key, JSON.stringify(data)))
}

export const getItemAsync = async (storage: SupportedStorage, key: string): Promise<any | null> => {
  const value = isBrowser() && (await storage?.getItem(key))
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export const getItemSynchronously = (storage: SupportedStorage, key: string): any | null => {
  const value = isBrowser() && storage?.getItem(key)
  if (!value || typeof value !== 'string') {
    return null
  }
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export const removeItemAsync = async (storage: SupportedStorage, key: string): Promise<void> => {
  isBrowser() && (await storage?.removeItem(key))
}
