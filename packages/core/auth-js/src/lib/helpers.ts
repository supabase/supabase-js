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

export const isBrowser = () => typeof document !== 'undefined'

const localStorageWriteTests = {
  tested: false,
  writable: false,
}

/**
 * Checks whether localStorage is supported on this browser.
 */
export const supportsLocalStorage = () => {
  if (!isBrowser()) {
    return false
  }

  try {
    if (typeof globalThis.localStorage !== 'object') {
      return false
    }
  } catch (e) {
    // DOM exception when accessing `localStorage`
    return false
  }

  if (localStorageWriteTests.tested) {
    return localStorageWriteTests.writable
  }

  const randomKey = `lswt-${Math.random()}${Math.random()}`

  try {
    globalThis.localStorage.setItem(randomKey, randomKey)
    globalThis.localStorage.removeItem(randomKey)

    localStorageWriteTests.tested = true
    localStorageWriteTests.writable = true
  } catch (e) {
    // localStorage can't be written to
    // https://www.chromium.org/for-testers/bug-reporting-guidelines/uncaught-securityerror-failed-to-read-the-localstorage-property-from-window-access-is-denied-for-this-document

    localStorageWriteTests.tested = true
    localStorageWriteTests.writable = false
  }

  return localStorageWriteTests.writable
}

/**
 * Extracts parameters encoded in the URL both in the query and fragment.
 */
export function parseParametersFromURL(href: string) {
  const result: { [parameter: string]: string } = {}

  const url = new URL(href)

  if (url.hash && url.hash[0] === '#') {
    try {
      const hashSearchParams = new URLSearchParams(url.hash.substring(1))
      hashSearchParams.forEach((value, key) => {
        result[key] = value
      })
    } catch (e: any) {
      // hash is not a query string
    }
  }

  // search parameters take precedence over hash parameters
  url.searchParams.forEach((value, key) => {
    result[key] = value
  })

  return result
}

type Fetch = typeof fetch

export const resolveFetch = (customFetch?: Fetch): Fetch => {
  let _fetch: Fetch
  if (customFetch) {
    _fetch = customFetch
  } else if (typeof fetch === 'undefined') {
    _fetch = async (...args) => await (await import('cross-fetch')).fetch(...args)
  } else {
    _fetch = fetch
  }
  return (...args) => _fetch(...args)
}

export const looksLikeFetchResponse = (maybeResponse: unknown): maybeResponse is Response => {
  return (
    typeof maybeResponse === 'object' &&
    maybeResponse !== null &&
    'status' in maybeResponse &&
    'ok' in maybeResponse &&
    'json' in maybeResponse &&
    typeof (maybeResponse as any).json === 'function'
  )
}

// Storage helpers
export const setItemAsync = async (
  storage: SupportedStorage,
  key: string,
  data: any
): Promise<void> => {
  await storage.setItem(key, JSON.stringify(data))
}

export const getItemAsync = async (storage: SupportedStorage, key: string): Promise<unknown> => {
  const value = await storage.getItem(key)

  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export const removeItemAsync = async (storage: SupportedStorage, key: string): Promise<void> => {
  await storage.removeItem(key)
}

export function decodeBase64URL(value: string): string {
  const key = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  let base64 = ''
  let chr1, chr2, chr3
  let enc1, enc2, enc3, enc4
  let i = 0
  value = value.replace('-', '+').replace('_', '/')

  while (i < value.length) {
    enc1 = key.indexOf(value.charAt(i++))
    enc2 = key.indexOf(value.charAt(i++))
    enc3 = key.indexOf(value.charAt(i++))
    enc4 = key.indexOf(value.charAt(i++))
    chr1 = (enc1 << 2) | (enc2 >> 4)
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
    chr3 = ((enc3 & 3) << 6) | enc4
    base64 = base64 + String.fromCharCode(chr1)

    if (enc3 != 64 && chr2 != 0) {
      base64 = base64 + String.fromCharCode(chr2)
    }
    if (enc4 != 64 && chr3 != 0) {
      base64 = base64 + String.fromCharCode(chr3)
    }
  }
  return base64
}

/**
 * A deferred represents some asynchronous work that is not yet finished, which
 * may or may not culminate in a value.
 * Taken from: https://github.com/mike-north/types/blob/master/src/async.ts
 */
export class Deferred<T = any> {
  public static promiseConstructor: PromiseConstructor = Promise

  public readonly promise!: PromiseLike<T>

  public readonly resolve!: (value?: T | PromiseLike<T>) => void

  public readonly reject!: (reason?: any) => any

  public constructor() {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;(this as any).promise = new Deferred.promiseConstructor((res, rej) => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;(this as any).resolve = res
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;(this as any).reject = rej
    })
  }
}

// Taken from: https://stackoverflow.com/questions/38552003/how-to-decode-jwt-token-in-javascript-without-using-a-library
export function decodeJWTPayload(token: string) {
  // Regex checks for base64url format
  const base64UrlRegex = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}=?$|[a-z0-9_-]{2}(==)?$)$/i

  const parts = token.split('.')

  if (parts.length !== 3) {
    throw new Error('JWT is not valid: not a JWT structure')
  }

  if (!base64UrlRegex.test(parts[1])) {
    throw new Error('JWT is not valid: payload is not in base64url format')
  }

  const base64Url = parts[1]
  return JSON.parse(decodeBase64URL(base64Url))
}

/**
 * Creates a promise that resolves to null after some time.
 */
export async function sleep(time: number): Promise<null> {
  return await new Promise((accept) => {
    setTimeout(() => accept(null), time)
  })
}

/**
 * Converts the provided async function into a retryable function. Each result
 * or thrown error is sent to the isRetryable function which should return true
 * if the function should run again.
 */
export function retryable<T>(
  fn: (attempt: number) => Promise<T>,
  isRetryable: (attempt: number, error: any | null, result?: T) => boolean
): Promise<T> {
  const promise = new Promise<T>((accept, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;(async () => {
      for (let attempt = 0; attempt < Infinity; attempt++) {
        try {
          const result = await fn(attempt)

          if (!isRetryable(attempt, null, result)) {
            accept(result)
            return
          }
        } catch (e: any) {
          if (!isRetryable(attempt, e)) {
            reject(e)
            return
          }
        }
      }
    })()
  })

  return promise
}

function dec2hex(dec: number) {
  return ('0' + dec.toString(16)).substr(-2)
}

// Functions below taken from: https://stackoverflow.com/questions/63309409/creating-a-code-verifier-and-challenge-for-pkce-auth-on-spotify-api-in-reactjs
export function generatePKCEVerifier() {
  const verifierLength = 56
  const array = new Uint32Array(verifierLength)
  if (typeof crypto === 'undefined') {
    const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    const charSetLen = charSet.length
    let verifier = ''
    for (let i = 0; i < verifierLength; i++) {
      verifier += charSet.charAt(Math.floor(Math.random() * charSetLen))
    }
    return verifier
  }
  crypto.getRandomValues(array)
  return Array.from(array, dec2hex).join('')
}

async function sha256(randomString: string) {
  const encoder = new TextEncoder()
  const encodedData = encoder.encode(randomString)
  const hash = await crypto.subtle.digest('SHA-256', encodedData)
  const bytes = new Uint8Array(hash)

  return Array.from(bytes)
    .map((c) => String.fromCharCode(c))
    .join('')
}

function base64urlencode(str: string) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function generatePKCEChallenge(verifier: string) {
  if (typeof crypto === 'undefined') {
    console.warn(
      'WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.'
    )
    return verifier
  }
  const hashed = await sha256(verifier)
  return base64urlencode(hashed)
}

const STACK_GUARD_PREFIX = `__stack_guard__`
const STACK_GUARD_SUFFIX = `__`

// Firefox and WebKit based browsers encode the stack entry differently, but
// they all include the function name. So instead of trying to parse the entry,
// we're only looking for the special string `__stack_guard__${guardName}__`.
// Guard names can only be letters with dashes or underscores.
//
// Example Firefox stack trace:
// ```
// __stack_guard__EXAMPLE__@debugger eval code:1:55
// @debugger eval code:1:3
// ```
//
// Example WebKit/Chrome stack trace:
// ```
// Error
//  at Object.__stack_guard__EXAMPLE__ (<anonymous>:1:55)
//  at <anonymous>:1:13
// ```
//
const STACK_ENTRY_REGEX = /__stack_guard__([a-zA-Z0-9_-]+)__/

let STACK_GUARD_CHECKED = false
let STACK_GUARD_CHECK_FN: () => Promise<void> // eslint-disable-line prefer-const

let STACK_GUARDS_SUPPORTED = false

/**
 * Checks if the current caller of the function is in a {@link
 * #stackGuard} of the provided `name`. Works by looking through
 * the stack trace of an `Error` object for a special function
 * name (generated by {@link #stackGuard}).
 *
 * @param name The name of the stack guard to check for. Must be `[a-zA-Z0-9_-]` only.
 */
export function isInStackGuard(name: string): boolean {
  STACK_GUARD_CHECK_FN()

  let error: Error

  try {
    throw new Error()
  } catch (e: any) {
    error = e
  }

  const stack = error.stack?.split('\n') ?? []

  for (let i = 0; i < stack.length; i += 1) {
    const entry = stack[i]
    const match = entry.match(STACK_ENTRY_REGEX)

    if (match && match[1] === name) {
      return true
    }
  }

  return false
}

/**
 * Creates a minification resistant stack guard, i.e. if you
 * call {@link #isInStackGuard} from within the `fn` parameter
 * function, you will always get `true` otherwise it will be
 * `false`.
 *
 * Works by dynamically defining a function name before calling
 * into `fn`, which is then parsed from the stack trace on an
 * `Error` object within {@link #isInStackGuard}.
 *
 * @param name The name of the stack guard. Must be `[a-zA-Z0-9_-]` only.
 * @param fn The async/await function to be run within the stack guard.
 */
export async function stackGuard<R>(name: string, fn: () => Promise<R>): Promise<R> {
  await STACK_GUARD_CHECK_FN()

  const guardName = `${STACK_GUARD_PREFIX}${name}${STACK_GUARD_SUFFIX}`

  const guardFunc: {
    [funcName: string]: () => Promise<R>
  } = {
    // per ECMAScript rules, this defines a new function with the dynamic name
    // contained in the `guardName` variable
    // this function name shows up in stack traces and is resistant to mangling
    // from minification processes as it is determined at runtime
    [guardName]: async () => await fn(),
  }

  // Safari does not log the name of a dynamically named function unless you
  // explicitly set the displayName
  Object.assign(guardFunc[guardName], { displayName: guardName })

  return await guardFunc[guardName]()
}

/**
 * Returns if the JavaScript engine supports stack guards. If it doesn't
 * certain features that depend on detecting recursive calls should be disabled
 * to prevent deadlocks.
 */
export async function stackGuardsSupported(): Promise<boolean> {
  if (STACK_GUARD_CHECKED) {
    return STACK_GUARDS_SUPPORTED
  }

  await STACK_GUARD_CHECK_FN()

  return STACK_GUARDS_SUPPORTED
}

let STACK_GUARD_WARNING_LOGGED = false

// In certain cases, if this file is transpiled using an ES2015 target, or is
// running in a JS engine that does not support async/await stack traces, this
// function will log a single warning message.
STACK_GUARD_CHECK_FN = async () => {
  if (!STACK_GUARD_CHECKED) {
    STACK_GUARD_CHECKED = true

    await stackGuard('ENV_CHECK', async () => {
      // sleeping for the next tick as Safari loses track of the async/await
      // trace beyond this point
      await sleep(0)

      const result = isInStackGuard('ENV_CHECK')
      STACK_GUARDS_SUPPORTED = result

      if (!result && !STACK_GUARD_WARNING_LOGGED) {
        STACK_GUARD_WARNING_LOGGED = true
        console.warn(
          '@supabase/gotrue-js: Stack guards not supported in this environment. Generally not an issue but may point to a very conservative transpilation environment (use ES2017 or above) that implements async/await with generators, or this is a JavaScript engine that does not support async/await stack traces. Safari is known to not support stack guards.'
        )
      }

      return result
    })
  }
}
