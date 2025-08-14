import {
  StorageError,
  StorageApiError,
  StorageUnknownError,
  isStorageError,
} from '../src/lib/errors'

describe('Storage Errors', () => {
  describe('StorageError', () => {
    test('creates StorageError with message', () => {
      const error = new StorageError('Test error')
      expect(error.message).toBe('Test error')
      expect(error.name).toBe('StorageError')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(StorageError)
    })

    test('has __isStorageError property', () => {
      const error = new StorageError('Test error')
      // @ts-ignore - accessing private property for test
      expect(error.__isStorageError).toBe(true)
    })
  })

  describe('StorageApiError', () => {
    test('creates StorageApiError with all parameters', () => {
      const error = new StorageApiError('API error', 404, 'NOT_FOUND')
      expect(error.message).toBe('API error')
      expect(error.name).toBe('StorageApiError')
      expect(error.status).toBe(404)
      expect(error.statusCode).toBe('NOT_FOUND')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(StorageError)
      expect(error).toBeInstanceOf(StorageApiError)
    })

    test('toJSON returns correct format', () => {
      const error = new StorageApiError('API error', 500, 'INTERNAL_ERROR')
      const json = error.toJSON()
      expect(json).toEqual({
        name: 'StorageApiError',
        message: 'API error',
        status: 500,
        statusCode: 'INTERNAL_ERROR',
      })
    })
  })

  describe('StorageUnknownError', () => {
    test('creates StorageUnknownError with original error', () => {
      const originalError = new Error('Original error')
      const error = new StorageUnknownError('Unknown error occurred', originalError)

      expect(error.message).toBe('Unknown error occurred')
      expect(error.name).toBe('StorageUnknownError')
      expect(error.originalError).toBe(originalError)
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(StorageError)
      expect(error).toBeInstanceOf(StorageUnknownError)
    })

    test('preserves original error of any type', () => {
      const originalError = { custom: 'error object' }
      const error = new StorageUnknownError('Unknown error', originalError)
      expect(error.originalError).toBe(originalError)
    })
  })

  describe('isStorageError', () => {
    test('returns true for StorageError instances', () => {
      const error = new StorageError('Test error')
      expect(isStorageError(error)).toBe(true)
    })

    test('returns true for StorageApiError instances', () => {
      const error = new StorageApiError('API error', 404, 'NOT_FOUND')
      expect(isStorageError(error)).toBe(true)
    })

    test('returns true for StorageUnknownError instances', () => {
      const error = new StorageUnknownError('Unknown error', new Error())
      expect(isStorageError(error)).toBe(true)
    })

    test('returns false for regular Error', () => {
      const error = new Error('Regular error')
      expect(isStorageError(error)).toBe(false)
    })

    test('returns false for non-objects', () => {
      expect(isStorageError('string')).toBe(false)
      expect(isStorageError(123)).toBe(false)
      expect(isStorageError(null)).toBe(false)
      expect(isStorageError(undefined)).toBe(false)
    })

    test('returns false for objects without __isStorageError', () => {
      const obj = { name: 'Error', message: 'test' }
      expect(isStorageError(obj)).toBe(false)
    })
  })
})
