/**
 * Integration tests for StorageAnalyticsClient.getCatalog()
 * Tests the integration with Iceberg REST Catalog for analytics buckets
 *
 * These tests require Docker infrastructure to be running (via test:infra script)
 * - Iceberg REST Catalog at http://localhost:8181
 * - MinIO for S3-compatible storage backend
 */

import { IcebergError } from 'iceberg-js'
import { createAnalyticsTestClient, generateTestName } from './helpers'

describe('Analytics Catalog API Integration Tests', () => {
  const client = createAnalyticsTestClient()
  let testBucketName: string

  beforeEach(() => {
    // Generate unique bucket name for this test
    testBucketName = generateTestName('test-warehouse')
  })

  describe('getCatalog', () => {
    it('should return a configured IcebergRestCatalog instance', () => {
      const catalog = client.getCatalog(testBucketName)
      expect(catalog).toBeDefined()
      expect(typeof catalog.listNamespaces).toBe('function')
      expect(typeof catalog.createNamespace).toBe('function')
      expect(typeof catalog.createTable).toBe('function')
    })

    it('should support listing namespaces', async () => {
      const catalog = client.getCatalog(testBucketName)
      const namespaces = await catalog.listNamespaces()
      expect(Array.isArray(namespaces)).toBe(true)
    })
  })

  describe('Iceberg operations via getCatalog', () => {
    const testNamespace = 'test'
    const testTableName = 'users'

    beforeEach(async () => {
      const catalog = client.getCatalog(testBucketName)

      // Cleanup: Drop test resources if they exist (to make tests idempotent)
      try {
        await catalog.dropTable({ namespace: [testNamespace], name: testTableName })
      } catch (error) {
        if (!(error instanceof IcebergError && error.status === 404)) {
          throw error
        }
      }

      try {
        await catalog.dropNamespace({ namespace: [testNamespace] })
      } catch (error) {
        if (!(error instanceof IcebergError && error.status === 404)) {
          throw error
        }
      }
    })

    afterEach(async () => {
      const catalog = client.getCatalog(testBucketName)

      // Cleanup after test
      try {
        await catalog.dropTable({ namespace: [testNamespace], name: testTableName })
      } catch (error) {
        // Ignore cleanup errors
      }

      try {
        await catalog.dropNamespace({ namespace: [testNamespace] })
      } catch (error) {
        // Ignore cleanup errors
      }
    })

    it('should create and list namespaces', async () => {
      const catalog = client.getCatalog(testBucketName)

      // Create namespace
      await catalog.createNamespace(
        { namespace: [testNamespace] },
        { properties: { owner: 'storage-js-test' } }
      )

      // List namespaces
      const namespaces = await catalog.listNamespaces()
      const createdNamespace = namespaces.find(
        (ns) => ns.namespace.length === 1 && ns.namespace[0] === testNamespace
      )
      expect(createdNamespace).toBeDefined()
    })

    it('should load namespace metadata', async () => {
      const catalog = client.getCatalog(testBucketName)

      // Create namespace with properties
      await catalog.createNamespace(
        { namespace: [testNamespace] },
        { properties: { owner: 'storage-js-test', description: 'Test namespace' } }
      )

      // Load metadata
      const metadata = await catalog.loadNamespaceMetadata({ namespace: [testNamespace] })
      expect(metadata.properties).toBeDefined()
      expect(metadata.properties?.owner).toBe('storage-js-test')
    })

    it('should create and list tables', async () => {
      const catalog = client.getCatalog(testBucketName)

      // Create namespace first
      await catalog.createNamespace({ namespace: [testNamespace] })

      // Create table with schema
      const tableMetadata = await catalog.createTable(
        { namespace: [testNamespace] },
        {
          name: testTableName,
          schema: {
            type: 'struct',
            fields: [
              { id: 1, name: 'id', type: 'long', required: true },
              { id: 2, name: 'name', type: 'string', required: true },
              { id: 3, name: 'email', type: 'string', required: false },
            ],
            'schema-id': 0,
            'identifier-field-ids': [1],
          },
          'partition-spec': {
            'spec-id': 0,
            fields: [],
          },
          'write-order': {
            'order-id': 0,
            fields: [],
          },
          properties: {
            'write.format.default': 'parquet',
          },
        }
      )

      expect(tableMetadata.location).toBeDefined()
      expect(tableMetadata['table-uuid']).toBeDefined()

      // List tables in namespace
      const tables = await catalog.listTables({ namespace: [testNamespace] })
      const createdTable = tables.find(
        (t) => t.namespace[0] === testNamespace && t.name === testTableName
      )
      expect(createdTable).toBeDefined()
    })

    it('should load table metadata', async () => {
      const catalog = client.getCatalog(testBucketName)

      // Create namespace and table
      await catalog.createNamespace({ namespace: [testNamespace] })
      await catalog.createTable(
        { namespace: [testNamespace] },
        {
          name: testTableName,
          schema: {
            type: 'struct',
            fields: [
              { id: 1, name: 'id', type: 'long', required: true },
              { id: 2, name: 'name', type: 'string', required: true },
            ],
            'schema-id': 0,
            'identifier-field-ids': [1],
          },
          'partition-spec': { 'spec-id': 0, fields: [] },
          'write-order': { 'order-id': 0, fields: [] },
        }
      )

      // Load table metadata
      const loadedTable = await catalog.loadTable({
        namespace: [testNamespace],
        name: testTableName,
      })

      expect(loadedTable['table-uuid']).toBeDefined()
      expect(loadedTable.location).toBeDefined()
      expect(loadedTable.schemas).toBeDefined()
      expect(Array.isArray(loadedTable.schemas)).toBe(true)
      expect(loadedTable.schemas.length).toBeGreaterThan(0)
    })

    it('should update table properties', async () => {
      const catalog = client.getCatalog(testBucketName)

      // Create namespace and table
      await catalog.createNamespace({ namespace: [testNamespace] })
      await catalog.createTable(
        { namespace: [testNamespace] },
        {
          name: testTableName,
          schema: {
            type: 'struct',
            fields: [{ id: 1, name: 'id', type: 'long', required: true }],
            'schema-id': 0,
            'identifier-field-ids': [1],
          },
          'partition-spec': { 'spec-id': 0, fields: [] },
          'write-order': { 'order-id': 0, fields: [] },
        }
      )

      // Update table properties
      const updatedTable = await catalog.updateTable(
        { namespace: [testNamespace], name: testTableName },
        {
          properties: {
            'read.split.target-size': '134217728',
            'write.parquet.compression-codec': 'snappy',
          },
        }
      )

      expect(updatedTable['table-uuid']).toBeDefined()
      expect(updatedTable.properties).toBeDefined()
    })

    it('should drop tables', async () => {
      const catalog = client.getCatalog(testBucketName)

      // Create namespace and table
      await catalog.createNamespace({ namespace: [testNamespace] })
      await catalog.createTable(
        { namespace: [testNamespace] },
        {
          name: testTableName,
          schema: {
            type: 'struct',
            fields: [{ id: 1, name: 'id', type: 'long', required: true }],
            'schema-id': 0,
            'identifier-field-ids': [1],
          },
          'partition-spec': { 'spec-id': 0, fields: [] },
          'write-order': { 'order-id': 0, fields: [] },
        }
      )

      // Drop the table
      await catalog.dropTable({ namespace: [testNamespace], name: testTableName })

      // Verify table is gone
      const tables = await catalog.listTables({ namespace: [testNamespace] })
      const foundTable = tables.find(
        (t) => t.namespace[0] === testNamespace && t.name === testTableName
      )
      expect(foundTable).toBeUndefined()
    })

    it('should drop namespaces', async () => {
      const catalog = client.getCatalog(testBucketName)

      // Create namespace
      await catalog.createNamespace({ namespace: [testNamespace] })

      // Drop the namespace
      await catalog.dropNamespace({ namespace: [testNamespace] })

      // Try to load the namespace (should fail with 404)
      await expect(catalog.loadNamespaceMetadata({ namespace: [testNamespace] })).rejects.toThrow()
    })

    it('should handle errors gracefully', async () => {
      const catalog = client.getCatalog(testBucketName)

      // Try to load non-existent table
      await expect(
        catalog.loadTable({ namespace: ['nonexistent'], name: 'nonexistent' })
      ).rejects.toThrow(IcebergError)

      // Try to create table in non-existent namespace
      await expect(
        catalog.createTable(
          { namespace: ['nonexistent'] },
          {
            name: 'test',
            schema: {
              type: 'struct',
              fields: [{ id: 1, name: 'id', type: 'long', required: true }],
              'schema-id': 0,
              'identifier-field-ids': [1],
            },
            'partition-spec': { 'spec-id': 0, fields: [] },
            'write-order': { 'order-id': 0, fields: [] },
          }
        )
      ).rejects.toThrow(IcebergError)
    })
  })
})
