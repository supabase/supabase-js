import { parseTraceParent } from '../src/parse'

describe('parseTraceParent', () => {
  describe('valid traceparent', () => {
    it('should parse valid traceparent with sampled flag', () => {
      const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
      const result = parseTraceParent(traceparent)

      expect(result).toEqual({
        version: '00',
        traceId: '0af7651916cd43dd8448eb211c80319c',
        parentId: 'b7ad6b7169203331',
        traceFlags: '01',
        isSampled: true,
      })
    })

    it('should parse valid traceparent without sampled flag', () => {
      const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00'
      const result = parseTraceParent(traceparent)

      expect(result).toEqual({
        version: '00',
        traceId: '0af7651916cd43dd8448eb211c80319c',
        parentId: 'b7ad6b7169203331',
        traceFlags: '00',
        isSampled: false,
      })
    })

    it('should parse traceparent with uppercase hex', () => {
      const traceparent = '00-0AF7651916CD43DD8448EB211C80319C-B7AD6B7169203331-01'
      const result = parseTraceParent(traceparent)

      expect(result).toEqual({
        version: '00',
        traceId: '0AF7651916CD43DD8448EB211C80319C',
        parentId: 'B7AD6B7169203331',
        traceFlags: '01',
        isSampled: true,
      })
    })

    it('should correctly identify sampled flag in different positions', () => {
      // Only bit 0 matters for sampling
      const testCases = [
        { flags: '00', isSampled: false },
        { flags: '01', isSampled: true },
        { flags: '02', isSampled: false },
        { flags: '03', isSampled: true },
        { flags: 'ff', isSampled: true },
        { flags: 'fe', isSampled: false },
      ]

      testCases.forEach(({ flags, isSampled }) => {
        const traceparent = `00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-${flags}`
        const result = parseTraceParent(traceparent)
        expect(result?.isSampled).toBe(isSampled)
      })
    })
  })

  describe('invalid traceparent', () => {
    it('should return null for null input', () => {
      const result = parseTraceParent(null as any)
      expect(result).toBeNull()
    })

    it('should return null for undefined input', () => {
      const result = parseTraceParent(undefined as any)
      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = parseTraceParent('')
      expect(result).toBeNull()
    })

    it('should return null for non-string input', () => {
      const result = parseTraceParent(123 as any)
      expect(result).toBeNull()
    })

    it('should return null when too few parts', () => {
      const result = parseTraceParent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331')
      expect(result).toBeNull()
    })

    it('should return null when too many parts', () => {
      const result = parseTraceParent(
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01-extra'
      )
      expect(result).toBeNull()
    })

    it('should return null when version has wrong length', () => {
      const result = parseTraceParent('0-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01')
      expect(result).toBeNull()
    })

    it('should return null when traceId has wrong length', () => {
      const result = parseTraceParent('00-0af7651916cd43dd8448eb211c8031-b7ad6b7169203331-01')
      expect(result).toBeNull()
    })

    it('should return null when parentId has wrong length', () => {
      const result = parseTraceParent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b716920-01')
      expect(result).toBeNull()
    })

    it('should return null when traceFlags has wrong length', () => {
      const result = parseTraceParent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-1')
      expect(result).toBeNull()
    })

    it('should return null when version is not hex', () => {
      const result = parseTraceParent('0g-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01')
      expect(result).toBeNull()
    })

    it('should return null when traceId is not hex', () => {
      const result = parseTraceParent('00-0af7651916cd43dd8448eb211c80319g-b7ad6b7169203331-01')
      expect(result).toBeNull()
    })

    it('should return null when parentId is not hex', () => {
      const result = parseTraceParent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b716920333g-01')
      expect(result).toBeNull()
    })

    it('should return null when traceFlags is not hex', () => {
      const result = parseTraceParent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-0g')
      expect(result).toBeNull()
    })

    it('should return null when traceId is all zeros', () => {
      const result = parseTraceParent('00-00000000000000000000000000000000-b7ad6b7169203331-01')
      expect(result).toBeNull()
    })

    it('should return null when parentId is all zeros', () => {
      const result = parseTraceParent('00-0af7651916cd43dd8448eb211c80319c-0000000000000000-01')
      expect(result).toBeNull()
    })
  })
})
