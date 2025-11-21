/**
 * Unit tests for StorageAnalyticsClient.fromCatalog() method
 * Tests that the method returns a properly configured IcebergRestCatalog instance
 */

import { IcebergRestCatalog } from 'iceberg-js'
import StorageAnalyticsClient from '../src/packages/StorageAnalyticsClient'

describe('StorageAnalyticsClient.fromCatalog()', () => {
  it('should return an IcebergRestCatalog instance', () => {
    const client = new StorageAnalyticsClient('https://example.supabase.co/storage/v1/iceberg', {
      Authorization: 'Bearer test-token',
    })

    const catalog = client.fromCatalog('my-analytics-bucket')

    expect(catalog).toBeInstanceOf(IcebergRestCatalog)
  })

  it('should return different instances for different bucket names', () => {
    const client = new StorageAnalyticsClient('https://example.supabase.co/storage/v1/iceberg', {})

    const catalog1 = client.fromCatalog('bucket-1')
    const catalog2 = client.fromCatalog('bucket-2')

    expect(catalog1).toBeInstanceOf(IcebergRestCatalog)
    expect(catalog2).toBeInstanceOf(IcebergRestCatalog)
    expect(catalog1).not.toBe(catalog2) // Different instances
  })

  it('should work with minimal configuration', () => {
    const client = new StorageAnalyticsClient('http://localhost:8181', {})

    const catalog = client.fromCatalog('test-warehouse')

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

    const catalog = client.throwOnError().fromCatalog('my-bucket')

    expect(catalog).toBeInstanceOf(IcebergRestCatalog)
  })
})
