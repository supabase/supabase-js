/**
 * @experimental
 */
export const internals = {
  /**
   * @experimental
   */
  debug: !!(
    globalThis &&
    globalThis.localStorage &&
    globalThis.localStorage.getItem('supabase.gotrue-js.locks.debug') === 'true'
  ),
}

export class NavigatorLockAcquireTimeoutError extends Error {
  public readonly isAcquireTimeout = true

  constructor(message: string) {
    super(message)
  }
}

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

  let beginOperation: (() => void) | null = null
  let rejectOperation: ((error: any) => void) | null = null
  const beginOperationPromise = new Promise<void>((accept, reject) => {
    beginOperation = accept
    rejectOperation = reject
  })

  // this lets us preserve stack traces over the operation, which the
  // navigator.locks.request function does not preserve well still
  const result = (async () => {
    await beginOperationPromise

    if (internals.debug) {
      console.log('@supabase/gotrue-js: navigatorLock: operation start')
    }

    try {
      return await fn()
    } finally {
      if (internals.debug) {
        console.log('@supabase/gotrue-js: navigatorLock: operation end')
      }
    }
  })()

  const abortController = new globalThis.AbortController()

  if (acquireTimeout > 0) {
    setTimeout(() => {
      beginOperation = null
      abortController.abort()

      if (rejectOperation) {
        if (internals.debug) {
          console.log('@supabase/gotrue-js: navigatorLock acquire timed out', name)
        }

        if (rejectOperation) {
          rejectOperation(
            new NavigatorLockAcquireTimeoutError(
              `Acquiring an exclusive Navigator LockManager lock "${name}" timed out after ${acquireTimeout}ms`
            )
          )
        }
        beginOperation = null
        rejectOperation = null
      }
    }, acquireTimeout)
  }

  await globalThis.navigator.locks.request(
    name,
    {
      mode: 'exclusive',
      ifAvailable: acquireTimeout === 0,
      signal: abortController.signal,
    },
    async (lock) => {
      if (lock) {
        if (internals.debug) {
          console.log('@supabase/gotrue-js: navigatorLock acquired', name)
        }

        try {
          if (beginOperation) {
            beginOperation()
            beginOperation = null
            rejectOperation = null
            await result
          }
        } catch (e: any) {
          // not important to handle the error here
        } finally {
          if (internals.debug) {
            console.log('@supabase/gotrue-js: navigatorLock released', name)
          }
        }
      } else {
        if (internals.debug) {
          console.log('@supabase/gotrue-js: navigatorLock not immediately available', name)
        }

        // no lock was available because acquireTimeout === 0
        const timeout: any = new Error(
          `Acquiring an exclusive Navigator LockManager lock "${name}" immediately failed`
        )
        timeout.isAcquireTimeout = true

        if (rejectOperation) {
          rejectOperation(
            new NavigatorLockAcquireTimeoutError(
              `Acquiring an exclusive Navigator LockManager lock "${name}" immediately failed`
            )
          )
        }
        beginOperation = null
        rejectOperation = null
      }
    }
  )

  return await result
}
