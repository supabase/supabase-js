/**
 * E2E tests for StorageAnalyticsClient.getCatalog() against real Supabase backend
 *
 * These tests verify the complete production flow:
 * StorageAnalyticsClient -> getCatalog(bucketName) -> Iceberg operations
 *
 * IMPORTANT: These tests require a real Supabase project with analytics buckets enabled.
 * They are SKIPPED by default unless environment variables are provided.
 *
 * Required environment variables:
 * - SUPABASE_ANALYTICS_URL: Iceberg REST Catalog URL (e.g., https://xxx.supabase.co/storage/v1/iceberg)
 * - SUPABASE_SERVICE_KEY: Service role key for authentication
 * - SUPABASE_ANALYTICS_BUCKET: Name of an existing analytics bucket to test against
 *
 * Example:
 * ```bash
 * export SUPABASE_ANALYTICS_URL="https://yourproject.supabase.co/storage/v1/iceberg"
 * export SUPABASE_SERVICE_KEY="your-service-key"
 * export SUPABASE_ANALYTICS_BUCKET="your-analytics-bucket"
 * npm run test:suite -- analytics-catalog-e2e.spec.ts
 * ```
 */

import { IcebergError } from 'iceberg-js'
import StorageAnalyticsClient from '../src/packages/StorageAnalyticsClient'
import { generateTestName } from './helpers'

// Read environment variables
const ANALYTICS_URL = process.env.SUPABASE_ANALYTICS_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BUCKET_NAME = process.env.SUPABASE_ANALYTICS_BUCKET

// Skip all tests if environment variables are not set
const describeOrSkip =
  ANALYTICS_URL && SERVICE_KEY && BUCKET_NAME ? describe : describe.skip

describeOrSkip('Analytics Catalog E2E (Real Supabase)', () => {
  let client: StorageAnalyticsClient
  const testNamespace = generateTestName('test-ns')
  const testTableName = 'users'

  beforeAll(() => {
    // Create StorageAnalyticsClient with real Supabase credentials
    client = new StorageAnalyticsClient(ANALYTICS_URL!, {
      Authorization: `Bearer ${SERVICE_KEY}`,
    })
  })

  beforeEach(async () => {
    // Get catalog using the production getCatalog() method
    const catalog = client.getCatalog(BUCKET_NAME!)

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
    const catalog = client.getCatalog(BUCKET_NAME!)

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

  it('should get catalog and list namespaces', async () => {
    // This tests the full production flow: getCatalog() returns configured catalog
    const catalog = client.getCatalog(BUCKET_NAME!)

    const namespaces = await catalog.listNamespaces()
    expect(Array.isArray(namespaces)).toBe(true)
  })

  it('should create and list namespaces via getCatalog', async () => {
    const catalog = client.getCatalog(BUCKET_NAME!)

    // Create namespace
    await catalog.createNamespace(
      { namespace: [testNamespace] },
      { properties: { owner: 'storage-js-e2e-test' } }
    )

    // List namespaces
    const namespaces = await catalog.listNamespaces()
    const createdNamespace = namespaces.find(
      (ns) => ns.namespace.length === 1 && ns.namespace[0] === testNamespace
    )
    expect(createdNamespace).toBeDefined()
  })

  it('should create table and perform operations via getCatalog', async () => {
    const catalog = client.getCatalog(BUCKET_NAME!)

    // Create namespace
    await catalog.createNamespace({ namespace: [testNamespace] })

    // Create table
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

    // List tables
    const tables = await catalog.listTables({ namespace: [testNamespace] })
    const createdTable = tables.find(
      (t) => t.namespace[0] === testNamespace && t.name === testTableName
    )
    expect(createdTable).toBeDefined()

    // Load table metadata
    const loadedTable = await catalog.loadTable({
      namespace: [testNamespace],
      name: testTableName,
    })
    expect(loadedTable['table-uuid']).toBe(tableMetadata['table-uuid'])

    // Update table properties
    const updatedTable = await catalog.updateTable(
      { namespace: [testNamespace], name: testTableName },
      {
        properties: {
          'read.split.target-size': '134217728',
        },
      }
    )
    expect(updatedTable.properties).toBeDefined()
  })

  it('should handle errors gracefully via getCatalog', async () => {
    const catalog = client.getCatalog(BUCKET_NAME!)

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

  it('should work with throwOnError chain', async () => {
    // Test that getCatalog() works after throwOnError()
    const catalog = client.throwOnError().getCatalog(BUCKET_NAME!)

    const namespaces = await catalog.listNamespaces()
    expect(Array.isArray(namespaces)).toBe(true)
  })
})

// Display helpful message when tests are skipped
if (!ANALYTICS_URL || !SERVICE_KEY || !BUCKET_NAME) {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║  E2E Analytics Catalog Tests SKIPPED                                          ║
║                                                                               ║
║  These tests require a real Supabase project with analytics buckets.         ║
║  To run these tests, set the following environment variables:                ║
║                                                                               ║
║  SUPABASE_ANALYTICS_URL - Iceberg REST Catalog URL                          ║
║  SUPABASE_SERVICE_KEY   - Service role key for authentication                ║
║  SUPABASE_ANALYTICS_BUCKET - Existing analytics bucket name                  ║
║                                                                               ║
║  Example:                                                                     ║
║  export SUPABASE_ANALYTICS_URL="https://xxx.supabase.co/storage/v1/iceberg" ║
║  export SUPABASE_SERVICE_KEY="your-service-key"                             ║
║  export SUPABASE_ANALYTICS_BUCKET="your-bucket-name"                        ║
╚═══════════════════════════════════════════════════════════════════════════════╝
  `)
}
