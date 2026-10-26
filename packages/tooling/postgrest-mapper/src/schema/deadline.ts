import { SchemaAcquisitionError, timeoutError } from './errors'

/** One time budget shared by every step of an acquisition. */
export interface Deadline {
  /** The budget in ms */
  readonly ms: number
  /** ms left (`Infinity` without a budget) */
  remaining(): number
  /** Rejects with a `'timeout'` error when the budget runs out; never settles otherwise. */
  readonly expired: Promise<never>
  /** Runs `callback` once if the budget runs out (to cancel whatever is in flight). */
  onExpire(callback: () => void): void
  /** Stops the timer. */
  stop(): void
}

const MAX_TIMER_MS = 2 ** 31 - 1

export function createDeadline(ms: number, what: string): Deadline {
  if (Number.isNaN(ms) || ms <= 0) {
    throw new SchemaAcquisitionError('config', `timeoutMs must be a positive number, got ${ms}`)
  }
  const start = Date.now()
  const callbacks: Array<() => void> = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_, reject) => {
    if (!isFinite(ms)) return
    timer = setTimeout(
      () => {
        for (const callback of callbacks) callback()
        reject(timeoutError(what, ms))
      },
      Math.min(ms, MAX_TIMER_MS)
    )
  })
  // the race may already be decided when the timer fires; keep that rejection from surfacing as unhandled
  expired.catch(() => undefined)
  return {
    ms,
    remaining: () => (isFinite(ms) ? Math.max(0, ms - (Date.now() - start)) : Infinity),
    expired,
    onExpire: (callback) => void callbacks.push(callback),
    stop: () => clearTimeout(timer),
  }
}
