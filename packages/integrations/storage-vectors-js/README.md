# @supabase/storage-vectors-js

TypeScript client library for Supabase S3 Vector Buckets - a bottomless database service for storing and querying high-dimensional embeddings backed by S3 Vectors.

## Installation

```bash
npm install @supabase/storage-vectors-js
```

## Features

- **Vector Buckets**: Organize vector indexes into logical containers
- **Vector Indexes**: Define schemas with configurable dimensions and distance metrics
- **Batch Operations**: Insert/update/delete up to 500 vectors per request
- **Similarity Search**: Query for nearest neighbors using cosine, euclidean, or dot product distance
- **Metadata Filtering**: Store and filter vectors by arbitrary JSON metadata
- **Pagination**: Efficiently scan large vector datasets
- **Parallel Scanning**: Distribute scans across multiple workers for high throughput
- **TypeScript**: Full type safety with comprehensive type definitions
- **Cross-platform**: Works in Node.js, browsers, and edge runtimes

## Quick Start

```typescript
import { StorageVectorsClient } from '@supabase/storage-vectors-js'

// Initialize client
const client = new StorageVectorsClient('https://api.example.com', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})

// Create a vector bucket
await client.createVectorBucket('embeddings-prod')

// Create an index
const bucket = client.from('embeddings-prod')
await bucket.createIndex({
  indexName: 'documents-openai',
  dataType: 'float32',
  dimension: 1536,
  distanceMetric: 'cosine'
})

// Insert vectors
const index = bucket.index('documents-openai')
await index.putVectors({
  vectors: [
    {
      key: 'doc-1',
      data: { float32: [0.1, 0.2, 0.3, /* ...1536 dimensions */] },
      metadata: { title: 'Introduction', category: 'docs' }
    }
  ]
})

// Query similar vectors
const { data, error } = await index.queryVectors({
  queryVector: { float32: [0.15, 0.25, 0.35, /* ...1536 dimensions */] },
  topK: 5,
  returnDistance: true,
  returnMetadata: true
})

if (data) {
  data.matches.forEach(match => {
    console.log(`${match.key}: distance=${match.distance}`)
    console.log('Metadata:', match.metadata)
  })
}
```

## API Reference

### Client Initialization

```typescript
const client = new StorageVectorsClient(url, options?)
```

**Options:**
- `headers?: Record<string, string>` - Custom HTTP headers (e.g., Authorization)
- `fetch?: Fetch` - Custom fetch implementation

### Vector Buckets

Vector buckets are top-level containers for organizing vector indexes.

#### Create Bucket

```typescript
const { data, error } = await client.createVectorBucket('my-bucket')
```

#### Get Bucket

```typescript
const { data, error } = await client.getVectorBucket('my-bucket')
console.log('Created at:', new Date(data.vectorBucket.creationTime! * 1000))
```

#### List Buckets

```typescript
const { data, error } = await client.listVectorBuckets({
  prefix: 'prod-',
  maxResults: 100
})

// Pagination
if (data?.nextToken) {
  const next = await client.listVectorBuckets({ nextToken: data.nextToken })
}
```

#### Delete Bucket

```typescript
// Bucket must be empty (all indexes deleted first)
const { error } = await client.deleteVectorBucket('my-bucket')
```

### Vector Indexes

Vector indexes define the schema for embeddings including dimension and distance metric.

#### Create Index

```typescript
const bucket = client.bucket('my-bucket')

await bucket.createIndex({
  indexName: 'my-index',
  dataType: 'float32',
  dimension: 1536,
  distanceMetric: 'cosine', // 'cosine' | 'euclidean' | 'dotproduct'
  metadataConfiguration: {
    nonFilterableMetadataKeys: ['raw_text', 'internal_id']
  }
})
```

**Distance Metrics:**
- `cosine` - Cosine similarity (normalized dot product)
- `euclidean` - Euclidean distance (L2 norm)
- `dotproduct` - Dot product similarity

#### Get Index

```typescript
const { data, error } = await bucket.getIndex('my-index')
console.log('Dimension:', data?.index.dimension)
console.log('Distance metric:', data?.index.distanceMetric)
```

#### List Indexes

```typescript
const { data, error } = await bucket.listIndexes({
  prefix: 'documents-',
  maxResults: 100
})
```

#### Delete Index

```typescript
// Deletes index and all its vectors
await bucket.deleteIndex('my-index')
```

### Vector Operations

#### Insert/Update Vectors (Upsert)

```typescript
const index = client.bucket('my-bucket').index('my-index')

await index.putVectors({
  vectors: [
    {
      key: 'unique-id-1',
      data: { float32: [/* 1536 numbers */] },
      metadata: {
        title: 'Document Title',
        category: 'technical',
        page: 1
      }
    },
    // ... up to 500 vectors per request
  ]
})
```

**Limitations:**
- 1-500 vectors per request
- Vectors must match index dimension
- Keys must be unique within index

#### Get Vectors by Key

```typescript
const { data, error } = await index.getVectors({
  keys: ['doc-1', 'doc-2', 'doc-3'],
  returnData: true,      // Include embeddings (requires permission)
  returnMetadata: true   // Include metadata (requires permission)
})

data?.vectors.forEach(v => {
  console.log(v.key, v.metadata)
})
```

#### Query Similar Vectors (ANN Search)

```typescript
const { data, error } = await index.queryVectors({
  queryVector: { float32: [/* 1536 numbers */] },
  topK: 10,
  filter: {
    category: 'technical',
    published: true
  },
  returnDistance: true,
  returnMetadata: true
})

// Results ordered by similarity
data?.matches.forEach(match => {
  console.log(`${match.key}: distance=${match.distance}`)
})
```

**Filter Syntax:**
The `filter` parameter accepts arbitrary JSON for metadata filtering. Non-filterable keys (configured at index creation) cannot be used in filters but can still be returned.

#### List/Scan Vectors

```typescript
// Simple pagination
let nextToken: string | undefined
do {
  const { data } = await index.listVectors({
    maxResults: 500,
    nextToken,
    returnMetadata: true
  })

  console.log('Batch:', data?.vectors.length)
  nextToken = data?.nextToken
} while (nextToken)

// Parallel scanning (4 workers)
const workers = [0, 1, 2, 3].map(async (segmentIndex) => {
  const { data } = await index.listVectors({
    segmentCount: 4,
    segmentIndex,
    returnMetadata: true
  })
  return data?.vectors || []
})

const results = await Promise.all(workers)
const allVectors = results.flat()
```

**Limitations:**
- `maxResults`: 1-1000 (default: 500)
- `segmentCount`: 1-16
- Response may be limited by 1MB size

#### Delete Vectors

```typescript
await index.deleteVectors({
  keys: ['doc-1', 'doc-2', 'doc-3']
  // ... up to 500 keys per request
})
```

## Error Handling

The library uses a consistent error handling pattern:

```typescript
const { data, error } = await client.createVectorBucket('my-bucket')

if (error) {
  console.error('Error:', error.message)
  console.error('Status:', error.status)
  console.error('Code:', error.statusCode)
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `InternalError` | 500 | Internal server error |
| `S3VectorConflictException` | 409 | Resource already exists |
| `S3VectorNotFoundException` | 404 | Resource not found |
| `S3VectorBucketNotEmpty` | 400 | Bucket contains indexes |
| `S3VectorMaxBucketsExceeded` | 400 | Bucket quota exceeded |
| `S3VectorMaxIndexesExceeded` | 400 | Index quota exceeded |

### Throwing Errors

You can configure the client to throw errors instead:

```typescript
const client = new StorageVectorsClient(url, options)
client.throwOnError()

try {
  const { data } = await client.createVectorBucket('my-bucket')
  // data is guaranteed to be present
} catch (error) {
  if (error instanceof StorageVectorsApiError) {
    console.error('API Error:', error.statusCode)
  }
}
```

## Advanced Usage

### Scoped Clients

Create scoped clients for cleaner code:

```typescript
// Bucket-scoped operations
const bucket = client.bucket('embeddings-prod')
await bucket.createIndex({ /* ... */ })
await bucket.listIndexes()

// Index-scoped operations
const index = bucket.index('documents-openai')
await index.putVectors({ /* ... */ })
await index.queryVectors({ /* ... */ })
```

### Custom Fetch

Provide a custom fetch implementation:

```typescript
import { StorageVectorsClient } from '@supabase/storage-vectors-js'

const client = new StorageVectorsClient(url, {
  fetch: customFetch,
  headers: { /* ... */ }
})
```

### Batch Processing

Process large datasets in batches:

```typescript
async function insertLargeDataset(vectors: VectorObject[]) {
  const batchSize = 500

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize)
    await index.putVectors({ vectors: batch })
    console.log(`Inserted ${i + batch.length}/${vectors.length}`)
  }
}
```

### Float32 Validation

Ensure vectors are properly normalized to float32:

```typescript
import { normalizeToFloat32 } from '@supabase/storage-vectors-js'

const vector = normalizeToFloat32([0.1, 0.2, 0.3, /* ... */])
```

## Type Definitions

The library exports comprehensive TypeScript types:

```typescript
import type {
  VectorBucket,
  VectorIndex,
  VectorData,
  VectorObject,
  VectorMatch,
  VectorMetadata,
  DistanceMetric,
  ApiResponse,
  StorageVectorsError
} from '@supabase/storage-vectors-js'
```

## Requirements

- Node.js 14+ or modern browser with fetch support
- TypeScript 4.5+ (for type checking)