import {
  resolveFetch,
  resolveResponse,
  isPlainObject,
  recursiveToCamel,
  isValidBucketName,
  normalizeToFloat32,
  validateVectorDimension,
} from '../../src/lib/common/helpers'

describe('Common Helpers', () => {
  describe('resolveFetch', () => {
    it('should return custom fetch if provided', () => {
      const customFetch = jest.fn()
      const resolved = resolveFetch(customFetch)
      expect(resolved).toBeDefined()
      // Call the resolved function
      resolved('http://example.com', {})
      expect(customFetch).toHaveBeenCalledWith('http://example.com', {})
    })

    it('should return native fetch if not provided', () => {
      const resolved = resolveFetch()
      expect(resolved).toBeDefined()
      expect(typeof resolved).toBe('function')
    })

    it('should wrap custom fetch correctly', () => {
      const customFetch = jest.fn().mockResolvedValue({ ok: true })
      const resolved = resolveFetch(customFetch)
      const url = 'http://test.com'
      const options = { method: 'GET' }
      resolved(url, options)
      expect(customFetch).toHaveBeenCalledWith(url, options)
    })
  })

  describe('resolveResponse', () => {
    it('should return native Response constructor', () => {
      const ResponseCtor = resolveResponse()
      expect(ResponseCtor).toBe(Response)
    })
  })

  describe('isPlainObject', () => {
    it('should return true for plain objects', () => {
      expect(isPlainObject({})).toBe(true)
      expect(isPlainObject({ a: 1 })).toBe(true)
      expect(isPlainObject({ a: 1, b: { c: 2 } })).toBe(true)
    })

    it('should return true for Object.create(null)', () => {
      expect(isPlainObject(Object.create(null))).toBe(true)
    })

    it('should return false for arrays', () => {
      expect(isPlainObject([])).toBe(false)
      expect(isPlainObject([1, 2, 3])).toBe(false)
    })

    it('should return false for class instances', () => {
      class TestClass {}
      expect(isPlainObject(new TestClass())).toBe(false)
      expect(isPlainObject(new Date())).toBe(false)
      expect(isPlainObject(new Error())).toBe(false)
    })

    it('should return false for null and primitives', () => {
      expect(isPlainObject(null as any)).toBe(false)
      expect(isPlainObject(undefined as any)).toBe(false)
      expect(isPlainObject('string' as any)).toBe(false)
      expect(isPlainObject(42 as any)).toBe(false)
      expect(isPlainObject(true as any)).toBe(false)
    })

    it('should return false for functions', () => {
      expect(isPlainObject((() => {}) as any)).toBe(false)
    })
  })

  describe('recursiveToCamel', () => {
    it('should convert snake_case keys to camelCase', () => {
      const input = { snake_case: 'value', another_key: 'test' }
      const expected = { snakeCase: 'value', anotherKey: 'test' }
      expect(recursiveToCamel(input)).toEqual(expected)
    })

    it('should convert kebab-case keys to camelCase', () => {
      const input = { 'kebab-case': 'value', 'another-key': 'test' }
      const expected = { kebabCase: 'value', anotherKey: 'test' }
      expect(recursiveToCamel(input)).toEqual(expected)
    })

    it('should handle nested objects recursively', () => {
      const input = {
        outer_key: {
          inner_key: 'value',
          nested_object: {
            deep_key: 'deep_value',
          },
        },
      }
      const expected = {
        outerKey: {
          innerKey: 'value',
          nestedObject: {
            deepKey: 'deep_value',
          },
        },
      }
      expect(recursiveToCamel(input)).toEqual(expected)
    })

    it('should handle arrays of objects', () => {
      const input = [
        { first_name: 'John' },
        { last_name: 'Doe' },
        { full_name: { first_name: 'Jane', last_name: 'Smith' } },
      ]
      const expected = [
        { firstName: 'John' },
        { lastName: 'Doe' },
        { fullName: { firstName: 'Jane', lastName: 'Smith' } },
      ]
      expect(recursiveToCamel(input)).toEqual(expected)
    })

    it('should preserve non-object values', () => {
      expect(recursiveToCamel('string' as any)).toBe('string')
      expect(recursiveToCamel(42 as any)).toBe(42)
      expect(recursiveToCamel(true as any)).toBe(true)
      expect(recursiveToCamel(null as any)).toBe(null)
    })

    it('should preserve functions', () => {
      const fn = () => {}
      expect(recursiveToCamel(fn as any)).toBe(fn)
    })
  })

  describe('isValidBucketName', () => {
    it('should accept valid bucket names', () => {
      expect(isValidBucketName('valid-bucket')).toBe(true)
      expect(isValidBucketName('bucket_name')).toBe(true)
      expect(isValidBucketName('bucket123')).toBe(true)
      expect(isValidBucketName('my.bucket')).toBe(true)
      expect(isValidBucketName("bucket'name")).toBe(true)
      expect(isValidBucketName('bucket(test)')).toBe(true)
      expect(isValidBucketName('bucket name')).toBe(true)
      expect(isValidBucketName('bucket&test')).toBe(true)
      expect(isValidBucketName('bucket$test')).toBe(true)
      expect(isValidBucketName('bucket@test')).toBe(true)
      expect(isValidBucketName('bucket=test')).toBe(true)
      expect(isValidBucketName('bucket;test')).toBe(true)
      expect(isValidBucketName('bucket:test')).toBe(true)
      expect(isValidBucketName('bucket+test')).toBe(true)
      expect(isValidBucketName('bucket,test')).toBe(true)
      expect(isValidBucketName('bucket?test')).toBe(true)
      expect(isValidBucketName('bucket!test')).toBe(true)
      expect(isValidBucketName('bucket*test')).toBe(true)
    })

    it('should accept consecutive periods', () => {
      expect(isValidBucketName('bucket..name')).toBe(true)
      expect(isValidBucketName('..bucket')).toBe(true)
    })

    it('should reject empty or null names', () => {
      expect(isValidBucketName('')).toBe(false)
      expect(isValidBucketName(null as any)).toBe(false)
      expect(isValidBucketName(undefined as any)).toBe(false)
    })

    it('should reject names longer than 100 characters', () => {
      const longName = 'a'.repeat(101)
      expect(isValidBucketName(longName)).toBe(false)
      expect(isValidBucketName('a'.repeat(100))).toBe(true)
    })

    it('should reject names with leading/trailing whitespace', () => {
      expect(isValidBucketName(' bucket')).toBe(false)
      expect(isValidBucketName('bucket ')).toBe(false)
      expect(isValidBucketName(' bucket ')).toBe(false)
    })

    it('should reject names with path separators', () => {
      expect(isValidBucketName('bucket/name')).toBe(false)
      expect(isValidBucketName('bucket\\name')).toBe(false)
      expect(isValidBucketName('/bucket')).toBe(false)
      expect(isValidBucketName('bucket/')).toBe(false)
    })

    it('should reject non-string values', () => {
      expect(isValidBucketName(123 as any)).toBe(false)
      expect(isValidBucketName({} as any)).toBe(false)
      expect(isValidBucketName([] as any)).toBe(false)
    })
  })

  describe('normalizeToFloat32', () => {
    it('should normalize numbers to float32', () => {
      const input = [1.0, 2.5, 3.14159]
      const result = normalizeToFloat32(input)
      expect(result).toHaveLength(3)
      expect(result[0]).toBeCloseTo(1.0)
      expect(result[1]).toBeCloseTo(2.5)
      expect(result[2]).toBeCloseTo(3.14159, 5)
    })

    it('should handle integer values', () => {
      const input = [1, 2, 3]
      const result = normalizeToFloat32(input)
      expect(result).toEqual([1, 2, 3])
    })

    it('should handle negative values', () => {
      const input = [-1.5, -2.5, -3.5]
      const result = normalizeToFloat32(input)
      expect(result[0]).toBeCloseTo(-1.5)
      expect(result[1]).toBeCloseTo(-2.5)
      expect(result[2]).toBeCloseTo(-3.5)
    })

    it('should handle zero', () => {
      const input = [0]
      const result = normalizeToFloat32(input)
      expect(result).toEqual([0])
      expect(result[0]).toBe(0)
    })

    it('should handle empty array', () => {
      const input: number[] = []
      const result = normalizeToFloat32(input)
      expect(result).toEqual([])
    })

    it('should convert to float32 precision', () => {
      // Float64 number that loses precision in Float32
      const input = [1.0000000000000001]
      const result = normalizeToFloat32(input)
      // Float32 can't represent this precision, so it should be 1.0
      expect(result[0]).toBe(1.0)
    })
  })

  describe('validateVectorDimension', () => {
    it('should not throw for matching dimensions', () => {
      const vector = { float32: [1, 2, 3] }
      expect(() => validateVectorDimension(vector, 3)).not.toThrow()
    })

    it('should not throw when expected dimension is undefined', () => {
      const vector = { float32: [1, 2, 3] }
      expect(() => validateVectorDimension(vector, undefined)).not.toThrow()
    })

    it('should throw for mismatched dimensions', () => {
      const vector = { float32: [1, 2, 3] }
      expect(() => validateVectorDimension(vector, 2)).toThrow(
        'Vector dimension mismatch: expected 2, got 3'
      )
    })

    it('should throw with correct error message for larger vector', () => {
      const vector = { float32: [1, 2, 3, 4, 5] }
      expect(() => validateVectorDimension(vector, 10)).toThrow(
        'Vector dimension mismatch: expected 10, got 5'
      )
    })

    it('should handle empty vectors', () => {
      const vector = { float32: [] }
      expect(() => validateVectorDimension(vector, 0)).not.toThrow()
      expect(() => validateVectorDimension(vector, 1)).toThrow(
        'Vector dimension mismatch: expected 1, got 0'
      )
    })
  })
})
