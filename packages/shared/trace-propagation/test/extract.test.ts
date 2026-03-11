import { extractTraceContext } from '../src/extract'

describe('extractTraceContext', () => {
  describe('custom extractor', () => {
    it('should use custom extractor when provided', () => {
      const mockContext = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        tracestate: 'vendor1=value1',
        baggage: 'key1=value1',
      }

      const result = extractTraceContext({
        customExtractor: () => mockContext,
      })

      expect(result).toEqual(mockContext)
    })

    it('should return null when custom extractor returns null', () => {
      const result = extractTraceContext({
        customExtractor: () => null,
      })

      expect(result).toBeNull()
    })

    it('should return null when custom extractor throws error', () => {
      const result = extractTraceContext({
        customExtractor: () => {
          throw new Error('Extractor error')
        },
      })

      expect(result).toBeNull()
    })

    it('should return null when custom extractor returns context without traceparent', () => {
      const result = extractTraceContext({
        customExtractor: () => ({
          tracestate: 'vendor1=value1',
        }),
      })

      expect(result).toBeNull()
    })

    it('should prefer custom extractor over OTel API', () => {
      const customContext = {
        traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
      }

      const result = extractTraceContext({
        customExtractor: () => customContext,
      })

      expect(result).toEqual(customContext)
    })
  })

  describe('OpenTelemetry API fallback', () => {
    it('should return null when OTel API is not available and no custom extractor', () => {
      // Without a custom extractor and OTel API not installed, should return null
      const result = extractTraceContext()

      // Since @opentelemetry/api is not installed in this package, this should return null
      expect(result).toBeNull()
    })
  })
})
