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

export abstract class LockAcquireTimeoutError extends Error {
  public readonly isAcquireTimeout = true

  constructor(message: string) {
    super(message)
  }
}

export class NavigatorLockAcquireTimeoutError extends LockAcquireTimeoutError {}

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
 * @experimental
 *
 * @param name Name of the lock to be acquired.
 * @param acquireTimeout If negative, no timeout. If 0 an error is thrown if
 *                       the lock can't be acquired without waiting. If positive, the lock acquire
 *                       will time out after so many milliseconds. An error is
 *                       a timeout if it has `isAcquireTimeout` set to true.
 * @param fn The operation to run once the lock is acquired.
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
}
