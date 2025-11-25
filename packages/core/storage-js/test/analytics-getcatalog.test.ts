/**
 * Unit tests for StorageAnalyticsClient.from() method
 * Tests that the method returns a properly configured IcebergRestCatalog instance
 */

import { IcebergRestCatalog } from 'iceberg-js'
import StorageAnalyticsClient from '../src/packages/StorageAnalyticsClient'
import { StorageError } from '../src/lib/errors'

describe('StorageAnalyticsClient.from()', () => {
  it('should return an IcebergRestCatalog instance', () => {
    const client = new StorageAnalyticsClient('https://example.supabase.co/storage/v1/iceberg', {
      Authorization: 'Bearer test-token',
    })

    const catalog = client.from('my-analytics-bucket')

    expect(catalog).toBeInstanceOf(IcebergRestCatalog)
  })

  it('should return different instances for different bucket names', () => {
    const client = new StorageAnalyticsClient('https://example.supabase.co/storage/v1/iceberg', {})

    const catalog1 = client.from('bucket-1')
    const catalog2 = client.from('bucket-2')

    expect(catalog1).toBeInstanceOf(IcebergRestCatalog)
    expect(catalog2).toBeInstanceOf(IcebergRestCatalog)
    expect(catalog1).not.toBe(catalog2) // Different instances
  })

  it('should work with minimal configuration', () => {
    const client = new StorageAnalyticsClient('http://localhost:8181', {})

    const catalog = client.from('test-warehouse')

    expect(catalog).toBeInstanceOf(IcebergRestCatalog)
    expect(typeof catalog.listNamespaces).toBe('function')
    expect(typeof catalog.createNamespace).toBe('function')
    expect(typeof catalog.createTable).toBe('function')
    expect(typeof catalog.listTables).toBe('function')
    expect(typeof catalog.loadTable).toBe('function')
    expect(typeof catalog.updateTable).toBe('function')
    expect(typeof catalog.dropTable).toBe('function')
    expect(typeof catalog.dropNamespace).toBe('function')
  })

  it('should work when called from throwOnError chain', () => {
    const client = new StorageAnalyticsClient('https://example.supabase.co/storage/v1/iceberg', {})

    const catalog = client.throwOnError().from('my-bucket')

    expect(catalog).toBeInstanceOf(IcebergRestCatalog)
  })

  describe('bucket name validation', () => {
    let client: StorageAnalyticsClient

    beforeEach(() => {
      client = new StorageAnalyticsClient('https://example.supabase.co/storage/v1/iceberg', {})
    })

    describe('valid bucket names', () => {
      it('should accept simple alphanumeric names', () => {
        expect(() => client.from('analytics-data')).not.toThrow()
        expect(() => client.from('bucket123')).not.toThrow()
        expect(() => client.from('MyBucket')).not.toThrow()
      })

      it('should accept names with safe special characters', () => {
        expect(() => client.from('my-bucket_2024')).not.toThrow()
        expect(() => client.from('data.backup')).not.toThrow()
        expect(() => client.from("bucket's-data")).not.toThrow()
        expect(() => client.from('bucket (2024)')).not.toThrow()
      })

      it('should accept real-world bucket names from examples', () => {
        expect(() => client.from('embeddings-prod')).not.toThrow()
        expect(() => client.from('user_uploads')).not.toThrow()
        expect(() => client.from('public-assets')).not.toThrow()
      })
    })

    describe('invalid bucket names', () => {
      it('should reject empty or null bucket names', () => {
        expect(() => client.from('')).toThrow(StorageError)
        expect(() => client.from(null as any)).toThrow(StorageError)
        expect(() => client.from(undefined as any)).toThrow(StorageError)
      })

      it('should reject path traversal with slashes', () => {
        expect(() => client.from('../etc/passwd')).toThrow(StorageError)
        expect(() => client.from('bucket/../other')).toThrow(StorageError)
        // Note: '..' alone is valid (just two periods), only with slashes is it path traversal
      })

      it('should reject names with path separators', () => {
        expect(() => client.from('bucket/nested')).toThrow(StorageError)
        expect(() => client.from('/bucket')).toThrow(StorageError)
        expect(() => client.from('bucket/')).toThrow(StorageError)
        expect(() => client.from('bucket\\nested')).toThrow(StorageError)
        expect(() => client.from('path\\to\\bucket')).toThrow(StorageError)
      })

      it('should reject names with leading or trailing whitespace', () => {
        expect(() => client.from(' bucket')).toThrow(StorageError)
        expect(() => client.from('bucket ')).toThrow(StorageError)
        expect(() => client.from(' bucket ')).toThrow(StorageError)
      })

      it('should reject names exceeding 100 characters', () => {
        const tooLongName = 'a'.repeat(101)
        expect(() => client.from(tooLongName)).toThrow(StorageError)
      })

      it('should reject names with unsafe special characters', () => {
        expect(() => client.from('bucket{name}')).toThrow(StorageError)
        expect(() => client.from('bucket[name]')).toThrow(StorageError)
        expect(() => client.from('bucket<name>')).toThrow(StorageError)
        expect(() => client.from('bucket#name')).toThrow(StorageError)
        expect(() => client.from('bucket%name')).toThrow(StorageError)
      })

      it('should provide clear error messages', () => {
        try {
          client.from('bucket/nested')
          fail('Should have thrown an error')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageError)
          expect((error as StorageError).message).toContain('Invalid bucket name')
          expect((error as StorageError).message).toContain('AWS object key naming guidelines')
        }
      })
    })

    describe('URL encoding behavior', () => {
      it('should reject strings with percent signs (URL encoding)', () => {
        // The % character is not in the allowed character set, so URL-encoded
        // strings will be rejected. This is correct behavior - users should
        // pass unencoded bucket names.
        const encodedSlash = 'bucket%2Fnested'
        expect(() => client.from(encodedSlash)).toThrow(StorageError)
      })
    })
  })
})
