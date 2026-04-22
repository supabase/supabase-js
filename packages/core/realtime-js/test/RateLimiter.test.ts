import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimiter, DEFAULT_SUBSCRIPTION_WARNING_CONFIG } from '../src/lib/rate-limiter'

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns no warning when below threshold', () => {
    const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)
    expect(limiter.evaluate().warning).toBeNull()
  })

  describe('join rate warnings', () => {
    it('warns when joins per second reach the threshold', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 20; i++) {
        limiter.recordJoin()
      }

      const { warning } = limiter.evaluate()
      expect(warning).not.toBeNull()
      expect(warning!.current).toBe(20)
      expect(warning!.threshold).toBe(20)
      expect(warning!.message).toContain('20 channel joins in the last second')
      expect(warning!.message).toContain('render loop')
    })

    it('does not warn when joins are spread across seconds', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 15; i++) {
        limiter.recordJoin()
      }
      vi.advanceTimersByTime(1_100)
      for (let i = 0; i < 15; i++) {
        limiter.recordJoin()
      }

      expect(limiter.evaluate().warning).toBeNull()
    })

    it('does not repeat the warning within the cooldown period', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 20; i++) {
        limiter.recordJoin()
      }
      expect(limiter.evaluate().warning).not.toBeNull()

      vi.advanceTimersByTime(5_000)
      expect(limiter.evaluate().warning).toBeNull()
    })

    it('repeats the warning after the cooldown expires', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 20; i++) {
        limiter.recordJoin()
      }
      expect(limiter.evaluate().warning).not.toBeNull()

      vi.advanceTimersByTime(10_001)

      for (let i = 0; i < 20; i++) {
        limiter.recordJoin()
      }
      expect(limiter.evaluate().warning).not.toBeNull()
    })

    it('does not warn after the 1 second window expires', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 20; i++) {
        limiter.recordJoin()
      }

      vi.advanceTimersByTime(1_100)

      expect(limiter.evaluate().warning).toBeNull()
    })

    it('naturally resets once the time window expires without explicit purge', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 25; i++) {
        limiter.recordJoin()
      }
      expect(limiter.evaluate().warning).not.toBeNull()

      vi.advanceTimersByTime(1_100)
      expect(limiter.evaluate().warning).toBeNull()

      for (let i = 0; i < 5; i++) {
        limiter.recordJoin()
      }
      expect(limiter.evaluate().warning).toBeNull()
    })

    it('retains sub-threshold join counts across evaluate calls', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 19; i++) {
        limiter.recordJoin()
      }
      expect(limiter.evaluate().delayMs).toBe(0)

      limiter.recordJoin()
      expect(limiter.evaluate().warning).not.toBeNull()
    })
  })

  describe('evaluate', () => {
    it('returns both warning and delay in a single call', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 25; i++) {
        limiter.recordJoin()
      }

      const result = limiter.evaluate()
      expect(result.warning).not.toBeNull()
      expect(result.warning!.current).toBe(25)
      expect(result.delayMs).toBe(500)
    })

    it('returns no warning and zero delay when under threshold', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 10; i++) {
        limiter.recordJoin()
      }

      const result = limiter.evaluate()
      expect(result.warning).toBeNull()
      expect(result.delayMs).toBe(0)
    })

    it('works with the _recordChannelJoin pattern', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 19; i++) {
        limiter.recordJoin()
        const { warning, delayMs } = limiter.evaluate()
        expect(warning).toBeNull()
        expect(delayMs).toBe(0)
      }

      limiter.recordJoin()
      const atThreshold = limiter.evaluate()
      expect(atThreshold.warning).not.toBeNull()
      expect(atThreshold.delayMs).toBe(0)

      limiter.recordJoin()
      const overThreshold = limiter.evaluate()
      expect(overThreshold.warning).toBeNull() // cooldown active
      expect(overThreshold.delayMs).toBe(100)
    })
  })

  describe('delay', () => {
    it('returns 0 when below the join rate threshold', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 19; i++) {
        limiter.recordJoin()
      }

      expect(limiter.evaluate().delayMs).toBe(0)
    })

    it('returns 0 when exactly at the join rate threshold', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 20; i++) {
        limiter.recordJoin()
      }

      expect(limiter.evaluate().delayMs).toBe(0)
    })

    it('returns linear delay proportional to excess joins', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 25; i++) {
        limiter.recordJoin()
      }

      expect(limiter.evaluate().delayMs).toBe(500)
    })

    it('respects a custom joinDelayMs', () => {
      const limiter = new RateLimiter({ ...DEFAULT_SUBSCRIPTION_WARNING_CONFIG, joinDelayMs: 50 })

      for (let i = 0; i < 23; i++) {
        limiter.recordJoin()
      }

      expect(limiter.evaluate().delayMs).toBe(150)
    })

    it('only counts joins within the last second', () => {
      const limiter = new RateLimiter(DEFAULT_SUBSCRIPTION_WARNING_CONFIG)

      for (let i = 0; i < 25; i++) {
        limiter.recordJoin()
      }

      vi.advanceTimersByTime(1_100)

      expect(limiter.evaluate().delayMs).toBe(0)
    })
  })

  describe('ring buffer overflow', () => {
    it('handles more joins than buffer capacity and still reports at least threshold', () => {
      const config = { joinRatePerSecond: 20, joinDelayMs: 100 }
      const limiter = new RateLimiter(config)
      const capacity = config.joinRatePerSecond * 3 // 60

      for (let i = 0; i < capacity + 10; i++) {
        limiter.recordJoin()
      }

      const { warning, delayMs } = limiter.evaluate()
      expect(warning).not.toBeNull()
      expect(warning!.current).toBeLessThanOrEqual(capacity)
      expect(warning!.current).toBeGreaterThanOrEqual(config.joinRatePerSecond)
      expect(delayMs).toBeGreaterThan(0)
    })
  })
})
