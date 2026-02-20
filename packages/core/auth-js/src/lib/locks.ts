import { supportsLocalStorage } from './helpers'

/**
 * @experimental
 */
export const internals = {
  /**
   * @experimental
   */
  debug: !!(
    globalThis &&
    supportsLocalStorage() &&
    globalThis.localStorage &&
    globalThis.localStorage.getItem('supabase.gotrue-js.locks.debug') === 'true'
  ),
}

/**
 * An error thrown when a lock cannot be acquired after some amount of time.
 *
 * Use the {@link #isAcquireTimeout} property instead of checking with `instanceof`.
 *
 * @example
 * ```ts
 * import { LockAcquireTimeoutError } from '@supabase/auth-js'
 *
 * class CustomLockError extends LockAcquireTimeoutError {
 *   constructor() {
 *     super('Lock timed out')
 *   }
 * }
 * ```
 */
export abstract class LockAcquireTimeoutError extends Error {
  public readonly isAcquireTimeout = true

  constructor(message: string) {
    super(message)
  }
}

/**
 * Error thrown when the browser Navigator Lock API fails to acquire a lock.
 *
 * @example
 * ```ts
 * import { NavigatorLockAcquireTimeoutError } from '@supabase/auth-js'
 *
 * throw new NavigatorLockAcquireTimeoutError('Lock timed out')
 * ```
 */
export class NavigatorLockAcquireTimeoutError extends LockAcquireTimeoutError {}
/**
 * Error thrown when the process-level lock helper cannot acquire a lock.
 *
 * @example
 * ```ts
 * import { ProcessLockAcquireTimeoutError } from '@supabase/auth-js'
 *
 * throw new ProcessLockAcquireTimeoutError('Lock timed out')
 * ```
 */
export class ProcessLockAcquireTimeoutError extends LockAcquireTimeoutError {}

/**
 * Implements a global exclusive lock using the Navigator LockManager API. It
 * is available on all browsers released after 2022-03-15 with Safari being the
 * last one to release support. If the API is not available, this function will
 * throw. Make sure you check availablility before configuring {@link
 * GoTrueClient}.
 *
 * You can turn on debugging by setting the `supabase.gotrue-js.locks.debug`
 * local storage item to `true`.
 *
 * Internals:
 *
 * Since the LockManager API does not preserve stack traces for the async
 * function passed in the `request` method, a trick is used where acquiring the
 * lock releases a previously started promise to run the operation in the `fn`
 * function. The lock waits for that promise to finish (with or without error),
 * while the function will finally wait for the result anyway.
 *
 * @param name Name of the lock to be acquired.
 * @param acquireTimeout If negative, no timeout. If 0 an error is thrown if
 *                       the lock can't be acquired without waiting. If positive, the lock acquire
 *                       will time out after so many milliseconds. An error is
 *                       a timeout if it has `isAcquireTimeout` set to true.
 * @param fn The operation to run once the lock is acquired.
 * @example
 * ```ts
 * await navigatorLock('sync-user', 1000, async () => {
 *   await refreshSession()
 * })
 * ```
 */
export async function navigatorLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  if (internals.debug) {
    console.log('@supabase/gotrue-js: navigatorLock: acquire lock', name, acquireTimeout)
  }

  const abortController = new globalThis.AbortController()

  if (acquireTimeout > 0) {
    setTimeout(() => {
      abortController.abort()
      if (internals.debug) {
        console.log('@supabase/gotrue-js: navigatorLock acquire timed out', name)
      }
    }, acquireTimeout)
  }

  // MDN article: https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request

  // Wrapping navigator.locks.request() with a plain Promise is done as some
  // libraries like zone.js patch the Promise object to track the execution
  // context. However, it appears that most browsers use an internal promise
  // implementation when using the navigator.locks.request() API causing them
  // to lose context and emit confusing log messages or break certain features.
  // This wrapping is believed to help zone.js track the execution context
  // better.
  await Promise.resolve()

  try {
    return await globalThis.navigator.locks.request(
      name,
      acquireTimeout === 0
        ? {
            mode: 'exclusive',
            ifAvailable: true,
          }
        : {
            mode: 'exclusive',
            signal: abortController.signal,
          },
      async (lock) => {
        if (lock) {
          if (internals.debug) {
            console.log('@supabase/gotrue-js: navigatorLock: acquired', name, lock.name)
          }

          try {
            return await fn()
          } finally {
            if (internals.debug) {
              console.log('@supabase/gotrue-js: navigatorLock: released', name, lock.name)
            }
          }
        } else {
          if (acquireTimeout === 0) {
            if (internals.debug) {
              console.log('@supabase/gotrue-js: navigatorLock: not immediately available', name)
            }

            throw new NavigatorLockAcquireTimeoutError(
              `Acquiring an exclusive Navigator LockManager lock "${name}" immediately failed`
            )
          } else {
            if (internals.debug) {
              try {
                const result = await globalThis.navigator.locks.query()

                console.log(
                  '@supabase/gotrue-js: Navigator LockManager state',
                  JSON.stringify(result, null, '  ')
                )
              } catch (e: any) {
                console.warn(
                  '@supabase/gotrue-js: Error when querying Navigator LockManager state',
                  e
                )
              }
            }

            // Browser is not following the Navigator LockManager spec, it
            // returned a null lock when we didn't use ifAvailable. So we can
            // pretend the lock is acquired in the name of backward compatibility
            // and user experience and just run the function.
            console.warn(
              '@supabase/gotrue-js: Navigator LockManager returned a null lock when using #request without ifAvailable set to true, it appears this browser is not following the LockManager spec https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request'
            )

            return await fn()
          }
        }
      }
    )
  } catch (e: any) {
    if (e?.name === 'AbortError' && acquireTimeout > 0) {
      // The lock acquisition was aborted because the timeout fired while the
      // request was still pending. This typically means another lock holder is
      // not releasing the lock, possibly due to React Strict Mode's
      // double-mount/unmount behavior or a component unmounting mid-operation,
      // leaving an orphaned lock.
      //
      // Recovery: use { steal: true } to forcefully acquire the lock. Per the
      // Web Locks API spec, this releases any currently held lock with the same
      // name and grants the request immediately, preempting any queued requests.
      // The previous holder's callback continues running to completion but no
      // longer holds the lock for exclusion purposes.
      //
      // See: https://github.com/supabase/supabase/issues/42505
      if (internals.debug) {
        console.log(
          '@supabase/gotrue-js: navigatorLock: acquire timeout, recovering by stealing lock',
          name
        )
      }

      console.warn(
        `@supabase/gotrue-js: Lock "${name}" was not released within ${acquireTimeout}ms. ` +
          'This may indicate an orphaned lock from a component unmount (e.g., React Strict Mode). ' +
          'Forcefully acquiring the lock to recover.'
      )

      return await Promise.resolve().then(() =>
        globalThis.navigator.locks.request(
          name,
          {
            mode: 'exclusive',
            steal: true,
          },
          async (lock) => {
            if (lock) {
              if (internals.debug) {
                console.log(
                  '@supabase/gotrue-js: navigatorLock: recovered (stolen)',
                  name,
                  lock.name
                )
              }

              try {
                return await fn()
              } finally {
                if (internals.debug) {
                  console.log(
                    '@supabase/gotrue-js: navigatorLock: released (stolen)',
                    name,
                    lock.name
                  )
                }
              }
            } else {
              // This should not happen with steal: true, but handle gracefully.
              console.warn(
                '@supabase/gotrue-js: Navigator LockManager returned null lock even with steal: true'
              )
              return await fn()
            }
          }
        )
      )
    }

    throw e
  }
}

const PROCESS_LOCKS: { [name: string]: Promise<any> } = {}

/**
 * Implements a global exclusive lock that works only in the current process.
 * Useful for environments like React Native or other non-browser
 * single-process (i.e. no concept of "tabs") environments.
 *
 * Use {@link #navigatorLock} in browser environments.
 *
 * @param name Name of the lock to be acquired.
 * @param acquireTimeout If negative, no timeout. If 0 an error is thrown if
 *                       the lock can't be acquired without waiting. If positive, the lock acquire
 *                       will time out after so many milliseconds. An error is
 *                       a timeout if it has `isAcquireTimeout` set to true.
 * @param fn The operation to run once the lock is acquired.
 * @example
 * ```ts
 * await processLock('migrate', 5000, async () => {
 *   await runMigration()
 * })
 * ```
 */
export async function processLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  const previousOperation = PROCESS_LOCKS[name] ?? Promise.resolve()

  // Wrap previousOperation to handle errors without using .catch()
  // This avoids Firefox content script security errors
  const previousOperationHandled = (async () => {
    try {
      await previousOperation
      return null
    } catch (e) {
      // ignore error of previous operation that we're waiting to finish
      return null
    }
  })()

  const currentOperation = (async () => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    try {
      // Wait for either previous operation or timeout
      const timeoutPromise =
        acquireTimeout >= 0
          ? new Promise((_, reject) => {
              timeoutId = setTimeout(() => {
                console.warn(
                  `@supabase/gotrue-js: Lock "${name}" acquisition timed out after ${acquireTimeout}ms. ` +
                    'This may be caused by another operation holding the lock. ' +
                    'Consider increasing lockAcquireTimeout or checking for stuck operations.'
                )

                reject(
                  new ProcessLockAcquireTimeoutError(
                    `Acquiring process lock with name "${name}" timed out`
                  )
                )
              }, acquireTimeout)
            })
          : null

      await Promise.race([previousOperationHandled, timeoutPromise].filter((x) => x))

      // If we reach here, previousOperationHandled won the race
      // Clear the timeout to prevent false warnings
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    } catch (e: any) {
      // Clear the timeout on error path as well
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }

      // Re-throw timeout errors, ignore others
      if (e && e.isAcquireTimeout) {
        throw e
      }
      // Fall through to run fn() - previous operation finished with error
    }

    // Previous operations finished and we didn't get a race on the acquire
    // timeout, so the current operation can finally start
    return await fn()
  })()

  PROCESS_LOCKS[name] = (async () => {
    try {
      return await currentOperation
    } catch (e: any) {
      if (e && e.isAcquireTimeout) {
        // if the current operation timed out, it doesn't mean that the previous
        // operation finished, so we need continue waiting for it to finish
        try {
          await previousOperation
        } catch (prevError) {
          // Ignore previous operation errors
        }
        return null
      }

      throw e
    }
  })()

  // finally wait for the current operation to finish successfully, with an
  // error or with an acquire timeout error
  return await currentOperation
}
