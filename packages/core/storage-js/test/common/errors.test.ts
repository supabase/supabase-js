import {
  StorageError,
  StorageApiError,
  StorageUnknownError,
  StorageVectorsError,
  StorageVectorsApiError,
  StorageVectorsUnknownError,
  StorageVectorsErrorCode,
  isStorageError,
  isStorageVectorsError,
} from '../../src/lib/common/errors'

describe('Common Errors', () => {
  describe('StorageError', () => {
    it('should create a storage error with correct name', () => {
      const error = new StorageError('test message')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(StorageError)
      expect(error.name).toBe('StorageError')
      expect(error.message).toBe('test message')
      expect(error['__isStorageError']).toBe(true)
      expect(error['namespace']).toBe('storage')
    })

    it('should create a vectors error with correct name', () => {
      const error = new StorageError('test message', 'vectors')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(StorageError)
      expect(error.name).toBe('StorageVectorsError')
      expect(error.message).toBe('test message')
      expect(error['__isStorageError']).toBe(true)
      expect(error['namespace']).toBe('vectors')
    })
  })

  describe('StorageApiError', () => {
    it('should create a storage API error with correct properties', () => {
      const error = new StorageApiError('API error', 404, 'NotFound')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(StorageError)
      expect(error).toBeInstanceOf(StorageApiError)
      expect(error.name).toBe('StorageApiError')
      expect(error.message).toBe('API error')
      expect(error.status).toBe(404)
      expect(error.statusCode).toBe('NotFound')
      expect(error['namespace']).toBe('storage')
    })

    it('should create a vectors API error with correct name', () => {
      const error = new StorageApiError('API error', 409, 'Conflict', 'vectors')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(StorageError)
      expect(error).toBeInstanceOf(StorageApiError)
      expect(error.name).toBe('StorageVectorsApiError')
      expect(error.message).toBe('API error')
      expect(error.status).toBe(409)
      expect(error.statusCode).toBe('Conflict')
      expect(error['namespace']).toBe('vectors')
    })

    it('should serialize to JSON correctly', () => {
      const error = new StorageApiError('API error', 500, 'InternalError')
      const json = error.toJSON()
      expect(json).toEqual({
        name: 'StorageApiError',
        message: 'API error',
        status: 500,
        statusCode: 'InternalError',
      })
    })

    it('should serialize vectors error to JSON correctly', () => {
      const error = new StorageApiError('API error', 500, 'InternalError', 'vectors')
      const json = error.toJSON()
      expect(json).toEqual({
        name: 'StorageVectorsApiError',
        message: 'API error',
        status: 500,
        statusCode: 'InternalError',
      })
    })
  })

  describe('StorageUnknownError', () => {
    it('should wrap unknown errors for storage', () => {
      const originalError = new Error('Original error')
      const error = new StorageUnknownError('Wrapped error', originalError)
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(StorageError)
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error.name).toBe('StorageUnknownError')
      expect(error.message).toBe('Wrapped error')
      expect(error.originalError).toBe(originalError)
      expect(error['namespace']).toBe('storage')
    })

    it('should wrap unknown errors for vectors', () => {
      const originalError = new Error('Original error')
      const error = new StorageUnknownError('Wrapped error', originalError, 'vectors')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(StorageError)
      expect(error).toBeInstanceOf(StorageUnknownError)
      expect(error.name).toBe('StorageVectorsUnknownError')
      expect(error.message).toBe('Wrapped error')
      expect(error.originalError).toBe(originalError)
      expect(error['namespace']).toBe('vectors')
    })

    it('should preserve original error of any type', () => {
      const originalError = { custom: 'error object' }
      const error = new StorageUnknownError('Unknown error', originalError)
      expect(error.originalError).toBe(originalError)
    })
  })

  describe('isStorageError', () => {
    it('should return true for StorageError instances', () => {
      const error = new StorageError('test')
      expect(isStorageError(error)).toBe(true)
    })

    it('should return true for StorageApiError instances', () => {
      const error = new StorageApiError('test', 404, 'NotFound')
      expect(isStorageError(error)).toBe(true)
    })

    it('should return true for StorageUnknownError instances', () => {
      const error = new StorageUnknownError('test', new Error())
      expect(isStorageError(error)).toBe(true)
    })

    it('should return true for vectors errors', () => {
      const error = new StorageError('test', 'vectors')
      expect(isStorageError(error)).toBe(true)
    })

    it('should return false for regular errors', () => {
      const error = new Error('test')
      expect(isStorageError(error)).toBe(false)
    })

    it('should return false for non-error values', () => {
      expect(isStorageError(null)).toBe(false)
      expect(isStorageError(undefined)).toBe(false)
      expect(isStorageError('error')).toBe(false)
      expect(isStorageError(42)).toBe(false)
      expect(isStorageError({})).toBe(false)
    })

    it('should return false for objects without __isStorageError', () => {
      const obj = { name: 'Error', message: 'test' }
      expect(isStorageError(obj)).toBe(false)
    })
  })

  describe('isStorageVectorsError', () => {
    it('should return true for vectors namespace errors', () => {
      const error = new StorageError('test', 'vectors')
      expect(isStorageVectorsError(error)).toBe(true)
    })

    it('should return false for storage namespace errors', () => {
      const error = new StorageError('test', 'storage')
      expect(isStorageVectorsError(error)).toBe(false)
    })

    it('should return false for regular errors', () => {
      const error = new Error('test')
      expect(isStorageVectorsError(error)).toBe(false)
    })
  })

  describe('Backward Compatibility Classes', () => {
    describe('StorageVectorsError', () => {
      it('should create error with vectors namespace', () => {
        const error = new StorageVectorsError('test message')
        expect(error).toBeInstanceOf(StorageError)
        expect(error.name).toBe('StorageVectorsError')
        expect(error['namespace']).toBe('vectors')
        expect(isStorageVectorsError(error)).toBe(true)
      })
    })

    describe('StorageVectorsApiError', () => {
      it('should create API error with vectors namespace', () => {
        const error = new StorageVectorsApiError('test message', 404, 'NotFound')
        expect(error).toBeInstanceOf(StorageApiError)
        expect(error.name).toBe('StorageVectorsApiError')
        expect(error.status).toBe(404)
        expect(error.statusCode).toBe('NotFound')
        expect(error['namespace']).toBe('vectors')
        expect(isStorageVectorsError(error)).toBe(true)
      })
    })

    describe('StorageVectorsUnknownError', () => {
      it('should create unknown error with vectors namespace', () => {
        const originalError = new Error('original')
        const error = new StorageVectorsUnknownError('test message', originalError)
        expect(error).toBeInstanceOf(StorageUnknownError)
        expect(error.name).toBe('StorageVectorsUnknownError')
        expect(error.originalError).toBe(originalError)
        expect(error['namespace']).toBe('vectors')
        expect(isStorageVectorsError(error)).toBe(true)
      })
    })
  })

  describe('StorageVectorsErrorCode', () => {
    it('should have all expected error codes', () => {
      expect(StorageVectorsErrorCode.InternalError).toBe('InternalError')
      expect(StorageVectorsErrorCode.S3VectorConflictException).toBe('S3VectorConflictException')
      expect(StorageVectorsErrorCode.S3VectorNotFoundException).toBe('S3VectorNotFoundException')
      expect(StorageVectorsErrorCode.S3VectorBucketNotEmpty).toBe('S3VectorBucketNotEmpty')
      expect(StorageVectorsErrorCode.S3VectorMaxBucketsExceeded).toBe('S3VectorMaxBucketsExceeded')
      expect(StorageVectorsErrorCode.S3VectorMaxIndexesExceeded).toBe('S3VectorMaxIndexesExceeded')
    })
  })
})
