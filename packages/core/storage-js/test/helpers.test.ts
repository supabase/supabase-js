import { resolveFetch, resolveResponse, recursiveToCamel, isPlainObject } from '../src/lib/helpers'

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

    test('returns dynamic import when Response is undefined', async () => {
      const originalResponse = global.Response
      // @ts-ignore
      global.Response = undefined

      const result = await resolveResponse()
      expect(typeof result).toBe('function')

      global.Response = originalResponse
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
})
