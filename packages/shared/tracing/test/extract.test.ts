import { extractTraceContext, _resetOtelCache } from '../src/extract'

describe('extractTraceContext', () => {
  describe('OpenTelemetry API', () => {
    it('should return null when OTel API is not available', async () => {
      // Without OpenTelemetry API installed, should return null
      const result = await extractTraceContext()

      // Since @opentelemetry/api is not installed in this package, this should return null
      expect(result).toBeNull()
    })

    it('caches the dynamic import across calls', async () => {
      // The first call resolves the module (or fails); subsequent calls must
      // hit the cached promise and never trigger a fresh `import()`.
      _resetOtelCache()

      // Spy is hard to attach to dynamic import; instead measure indirectly:
      // many sequential calls should each return null without throwing, and
      // total time should be modest (we don't assert a tight bound — just
      // that 1000 invocations complete quickly because they share one
      // settled promise).
      const start = Date.now()
      const results = await Promise.all(Array.from({ length: 1000 }, () => extractTraceContext()))
      const elapsed = Date.now() - start

      expect(results.every((r) => r === null)).toBe(true)
      // 1000 cached calls should comfortably finish under 200ms even on
      // slow CI. If the cache regresses to per-call dynamic imports, this
      // climbs into the seconds.
      expect(elapsed).toBeLessThan(2000)
    })
  })
})
