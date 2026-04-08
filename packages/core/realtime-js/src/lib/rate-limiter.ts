export type SubscriptionWarningConfig = {
  readonly joinRatePerSecond: number
  readonly joinDelayMs: number
}

export const DEFAULT_SUBSCRIPTION_WARNING_CONFIG = {
  joinRatePerSecond: 20,
  joinDelayMs: 100,
} as const satisfies SubscriptionWarningConfig

export type SubscriptionWarning = {
  readonly current: number
  readonly threshold: number
  readonly message: string
}

export type RateLimitEvaluation = {
  readonly warning: SubscriptionWarning | null
  readonly delayMs: number
}

const WARN_COOLDOWN_MS = 10_000
const TROUBLESHOOTING_URL =
  'https://supabase.com/docs/guides/troubleshooting/realtime-too-many-channels-error'

class RingBuffer {
  private readonly slots: Float64Array
  private head = 0
  private count = 0

  constructor(capacity: number) {
    this.slots = new Float64Array(capacity)
  }

  push(ts: number): void {
    this.slots[this.head] = ts
    this.head = (this.head + 1) % this.slots.length
    if (this.count < this.slots.length) this.count++
  }

  countWithin(ms: number, now: number): number {
    const cutoff = now - ms
    let n = 0
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - 1 - i + this.slots.length) % this.slots.length
      if (this.slots[idx] > cutoff) n++
    }
    return n
  }
}

export class RateLimiter {
  private readonly joins: RingBuffer
  private lastWarnedAt = 0

  constructor(private readonly config: SubscriptionWarningConfig) {
    this.joins = new RingBuffer(config.joinRatePerSecond * 3)
  }

  recordJoin(): void {
    this.joins.push(Date.now())
  }

  evaluate(now: number = Date.now()): RateLimitEvaluation {
    const { joinRatePerSecond, joinDelayMs } = this.config
    const recentJoins = this.joins.countWithin(1000, now)

    let warning: SubscriptionWarning | null = null
    if (recentJoins >= joinRatePerSecond) {
      if (now - this.lastWarnedAt > WARN_COOLDOWN_MS) {
        this.lastWarnedAt = now
        warning = {
          current: recentJoins,
          threshold: joinRatePerSecond,
          message:
            `Realtime: ${recentJoins} channel joins in the last second (threshold: ${joinRatePerSecond}). ` +
            `You may be creating channels too rapidly — this often indicates a missing cleanup or channels being created in a render loop. ` +
            `See: ${TROUBLESHOOTING_URL}`,
        }
      }
    }

    const excess = recentJoins - joinRatePerSecond
    const delayMs = excess > 0 ? excess * joinDelayMs : 0

    return { warning, delayMs }
  }
}
