import {
  resolveFetch,
  resolveResponse,
  recursiveToCamel,
  isPlainObject,
  isValidBucketName,
} from '../src/lib/helpers'

describe('Helpers', () => {
  describe('resolveFetch', () => {
    test('returns wrapper function with custom fetch', () => {
      const customFetch = jest.fn()
      const result = resolveFetch(customFetch)
      expect(typeof result).toBe('function')
    })

    test('returns wrapper function with global fetch', () => {
      const originalFetch = global.fetch
      const mockFetch = jest.fn()
      global.fetch = mockFetch

      const result = resolveFetch()
      expect(typeof result).toBe('function')

      global.fetch = originalFetch
    })

    test('returns dynamic import when fetch is undefined', async () => {
      const originalFetch = global.fetch
      // @ts-ignore
      global.fetch = undefined

      const result = resolveFetch()
      expect(typeof result).toBe('function')

      global.fetch = originalFetch
    })
  })

  describe('resolveResponse', () => {
    test('returns Response constructor when available', async () => {
      // In Node.js, Response might not be globally available
      const originalResponse = global.Response
      // @ts-ignore
      global.Response = class MockResponse {}

      const result = await resolveResponse()
      expect(typeof result).toBe('function')

      global.Response = originalResponse
    })

    test('returns Response when available in Node 20+', async () => {
      // In Node 20+, Response is always available globally
      const result = await resolveResponse()
      expect(typeof result).toBe('function')
      expect(result).toBe(Response)
    })
  })

  describe('recursiveToCamel', () => {
    test('converts snake_case to camelCase', () => {
      const input = { snake_case: 'value', another_key: 'test' }
      const result = recursiveToCamel(input)
      expect(result).toEqual({ snakeCase: 'value', anotherKey: 'test' })
    })

    test('converts kebab-case to camelCase', () => {
      const input = { 'kebab-case': 'value' }
      const result = recursiveToCamel(input)
      expect(result).toEqual({ kebabCase: 'value' })
    })

    test('handles nested objects', () => {
      const input = { outer_key: { inner_key: 'value' } }
      const result = recursiveToCamel(input)
      expect(result).toEqual({ outerKey: { innerKey: 'value' } })
    })

    test('handles arrays', () => {
      const input = [{ snake_case: 'value1' }, { another_key: 'value2' }]
      const result = recursiveToCamel(input)
      expect(result).toEqual([{ snakeCase: 'value1' }, { anotherKey: 'value2' }])
    })

    test('returns functions unchanged', () => {
      const func = () => {}
      const result = recursiveToCamel(func)
      expect(result).toBe(func)
    })

    test('returns non-objects unchanged', () => {
      expect(recursiveToCamel('string' as any)).toBe('string')
      expect(recursiveToCamel(123 as any)).toBe(123)
      expect(recursiveToCamel(null as any)).toBe(null)
    })
  })

  describe('isPlainObject', () => {
    test('returns true for plain objects', () => {
      expect(isPlainObject({})).toBe(true)
      expect(isPlainObject(new Object())).toBe(true)
      expect(isPlainObject(Object.create(null))).toBe(true)
      expect(isPlainObject({ key: 'value' })).toBe(true)
    })

    test('returns false for non-objects', () => {
      expect(isPlainObject('string' as any)).toBe(false)
      expect(isPlainObject(123 as any)).toBe(false)
      expect(isPlainObject(null as any)).toBe(false)
      expect(isPlainObject(undefined as any)).toBe(false)
    })

    test('returns false for arrays', () => {
      expect(isPlainObject([])).toBe(false)
      expect(isPlainObject([1, 2, 3])).toBe(false)
    })

    test('returns false for functions', () => {
      expect(isPlainObject(() => {})).toBe(false)
      expect(isPlainObject(function () {})).toBe(false)
    })

    test('returns false for class instances', () => {
      class TestClass {}
      expect(isPlainObject(new TestClass())).toBe(false)
      expect(isPlainObject(new Date())).toBe(false)
      expect(isPlainObject(new Error())).toBe(false)
    })

    test('returns false for objects with toStringTag', () => {
      const obj = {}
      Object.defineProperty(obj, Symbol.toStringTag, { value: 'CustomObject' })
      expect(isPlainObject(obj)).toBe(false)
    })

    test('returns false for iterables', () => {
      const obj = {}
      Object.defineProperty(obj, Symbol.iterator, { value: function* () {} })
      expect(isPlainObject(obj)).toBe(false)
    })
  })

  describe('isValidBucketName', () => {
    describe('valid bucket names', () => {
      test('accepts simple alphanumeric names', () => {
        expect(isValidBucketName('bucket')).toBe(true)
        expect(isValidBucketName('bucket123')).toBe(true)
        expect(isValidBucketName('MyBucket')).toBe(true)
        expect(isValidBucketName('bucket_name')).toBe(true)
      })

      test('accepts names with hyphens and underscores', () => {
        expect(isValidBucketName('my-bucket')).toBe(true)
        expect(isValidBucketName('my_bucket')).toBe(true)
        expect(isValidBucketName('my-bucket_123')).toBe(true)
      })

      test('accepts names with safe special characters', () => {
        expect(isValidBucketName('bucket.data')).toBe(true)
        expect(isValidBucketName("bucket's-data")).toBe(true)
        expect(isValidBucketName('bucket (2024)')).toBe(true)
        expect(isValidBucketName('bucket*')).toBe(true)
        expect(isValidBucketName('bucket!')).toBe(true)
      })

      test('accepts names with multiple safe special characters', () => {
        expect(isValidBucketName('bucket!@$')).toBe(true)
        expect(isValidBucketName('data+analytics')).toBe(true)
        expect(isValidBucketName('file,list')).toBe(true)
        expect(isValidBucketName('query?params')).toBe(true)
        expect(isValidBucketName('user@domain')).toBe(true)
        expect(isValidBucketName('key=value')).toBe(true)
        expect(isValidBucketName('item;separator')).toBe(true)
        expect(isValidBucketName('path:colon')).toBe(true)
      })

      test('accepts names with spaces', () => {
        expect(isValidBucketName('my bucket')).toBe(true)
        expect(isValidBucketName('bucket name 2024')).toBe(true)
      })

      test('accepts maximum length names (100 characters)', () => {
        const maxLengthName = 'a'.repeat(100)
        expect(isValidBucketName(maxLengthName)).toBe(true)
      })

      test('accepts real-world examples', () => {
        expect(isValidBucketName('analytics-data')).toBe(true)
        expect(isValidBucketName('user_uploads')).toBe(true)
        expect(isValidBucketName('public-assets')).toBe(true)
        expect(isValidBucketName('embeddings-prod')).toBe(true)
        expect(isValidBucketName('avatars')).toBe(true)
      })
    })

    describe('invalid bucket names', () => {
      test('rejects empty or null/undefined names', () => {
        expect(isValidBucketName('')).toBe(false)
        expect(isValidBucketName(null as any)).toBe(false)
        expect(isValidBucketName(undefined as any)).toBe(false)
      })

      test('rejects non-string values', () => {
        expect(isValidBucketName(123 as any)).toBe(false)
        expect(isValidBucketName({} as any)).toBe(false)
        expect(isValidBucketName([] as any)).toBe(false)
      })

      test('rejects names exceeding 100 characters', () => {
        const tooLongName = 'a'.repeat(101)
        expect(isValidBucketName(tooLongName)).toBe(false)
      })

      test('rejects names with leading whitespace', () => {
        expect(isValidBucketName(' bucket')).toBe(false)
        expect(isValidBucketName('  bucket')).toBe(false)
        expect(isValidBucketName('\tbucket')).toBe(false)
      })

      test('rejects names with trailing whitespace', () => {
        expect(isValidBucketName('bucket ')).toBe(false)
        expect(isValidBucketName('bucket  ')).toBe(false)
        expect(isValidBucketName('bucket\t')).toBe(false)
      })

      test('rejects names with both leading and trailing whitespace', () => {
        expect(isValidBucketName(' bucket ')).toBe(false)
        expect(isValidBucketName('  bucket  ')).toBe(false)
      })

      test('rejects names with forward slash (path separator)', () => {
        expect(isValidBucketName('bucket/nested')).toBe(false)
        expect(isValidBucketName('/bucket')).toBe(false)
        expect(isValidBucketName('bucket/')).toBe(false)
        expect(isValidBucketName('path/to/bucket')).toBe(false)
      })

      test('rejects names with backslash (Windows path separator)', () => {
        expect(isValidBucketName('bucket\\nested')).toBe(false)
        expect(isValidBucketName('\\bucket')).toBe(false)
        expect(isValidBucketName('bucket\\')).toBe(false)
        expect(isValidBucketName('path\\to\\bucket')).toBe(false)
      })

      test('rejects path traversal with slashes', () => {
        // Note: '..' alone is allowed (just two periods), but with slashes it's path traversal
        expect(isValidBucketName('../bucket')).toBe(false)
        expect(isValidBucketName('bucket/..')).toBe(false)
        expect(isValidBucketName('../../etc/passwd')).toBe(false)
      })

      test('rejects names with unsafe special characters', () => {
        expect(isValidBucketName('bucket{name}')).toBe(false)
        expect(isValidBucketName('bucket[name]')).toBe(false)
        expect(isValidBucketName('bucket<name>')).toBe(false)
        expect(isValidBucketName('bucket>name')).toBe(false)
        expect(isValidBucketName('bucket#name')).toBe(false)
        expect(isValidBucketName('bucket%name')).toBe(false)
        expect(isValidBucketName('bucket|name')).toBe(false)
        expect(isValidBucketName('bucket^name')).toBe(false)
        expect(isValidBucketName('bucket~name')).toBe(false)
        expect(isValidBucketName('bucket`name')).toBe(false)
      })

      test('rejects double quotes', () => {
        expect(isValidBucketName('bucket"name')).toBe(false)
        expect(isValidBucketName('"bucket"')).toBe(false)
      })

      test('rejects newlines and control characters', () => {
        expect(isValidBucketName('bucket\nname')).toBe(false)
        expect(isValidBucketName('bucket\rname')).toBe(false)
        expect(isValidBucketName('bucket\tname')).toBe(false)
      })
    })

    describe('edge cases and AWS S3 compatibility', () => {
      test('accepts single character names', () => {
        expect(isValidBucketName('a')).toBe(true)
        expect(isValidBucketName('1')).toBe(true)
        expect(isValidBucketName('_')).toBe(true)
      })

      test('accepts names with consecutive special characters', () => {
        expect(isValidBucketName('bucket--name')).toBe(true)
        expect(isValidBucketName('bucket__name')).toBe(true)
        expect(isValidBucketName('bucket..name')).toBe(true)
      })

      test('handles period-only segments correctly', () => {
        // Single period is allowed as a character
        expect(isValidBucketName('.')).toBe(true)
        // Multiple periods are allowed
        expect(isValidBucketName('...')).toBe(true)
        // But path traversal with slashes is not
        expect(isValidBucketName('./')).toBe(false)
        expect(isValidBucketName('../')).toBe(false)
      })

      test('matches backend validation for common patterns', () => {
        // These should match the backend regex: /^(\w|!|-|\.|\*|'|\(|\)| |&|\$|@|=|;|:|\+|,|\?)*$/
        expect(isValidBucketName('test_bucket-123')).toBe(true)
        expect(isValidBucketName('my.great_photos-2014')).toBe(true)
        expect(isValidBucketName('data (backup)')).toBe(true)
      })
    })
  })
})
