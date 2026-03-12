import { extractTraceContext } from '../src/extract'

describe('extractTraceContext', () => {
  describe('OpenTelemetry API', () => {
    it('should return null when OTel API is not available', () => {
      // Without OpenTelemetry API installed, should return null
      const result = extractTraceContext()

      // Since @opentelemetry/api is not installed in this package, this should return null
      expect(result).toBeNull()
    })
  })
})
