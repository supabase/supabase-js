# @supabase/storage-vectors-js (Internal Package)

> **⚠️ Note for Users:** This is an internal implementation package. For user-facing documentation on vector embeddings, see the [Vector Embeddings section in @supabase/storage-js](../../core/storage-js/README.md#vector-embeddings).

## Overview

`@supabase/storage-vectors-js` is a private, internal package within the Supabase JS monorepo that provides vector embeddings functionality for Supabase Storage. This package is **not published to npm separately** - instead, it is bundled with and re-exported through `@supabase/storage-js`.

## Architecture

### Integration Pattern

The integration follows a **re-export pattern**:

```typescript
// In packages/core/storage-js/src/index.ts
export * from '@supabase/storage-vectors-js'
```

This means:
- All exports from `storage-vectors-js` are transparently available through `storage-js`
- Users import from `@supabase/storage-js` and get everything, including vector types and classes
- The internal package structure is hidden from end users

### Package Configuration

**Build coordination in storage-js:**

```json
{
  "nx": {
    "targets": {
      "build:module": {
        "dependsOn": [
          "^build:module",
          {
            "projects": ["storage-vectors-js"],
            "target": "build"
          }
        ]
      }
    }
  }
}
```

This ensures that when storage-js is built, storage-vectors-js is built first.

### Module Structure

```
packages/integrations/storage-vectors-js/
├── src/
│   ├── index.ts                      # Main export file
│   └── lib/
│       ├── StorageVectorsClient.ts   # Main client class
│       ├── VectorBucketApi.ts        # Bucket operations
│       ├── VectorIndexApi.ts         # Index operations
│       ├── VectorDataApi.ts          # Vector data operations
│       ├── types.ts                  # Type definitions
│       ├── errors.ts                 # Error handling
│       ├── fetch.ts                  # Fetch utilities
│       ├── helpers.ts                # Helper functions
│       └── constants.ts              # Constants
├── package.json                       # Package configuration
├── tsconfig.json                      # Root TypeScript config
├── tsconfig.lib.json                  # Library build config
├── tsconfig.spec.json                 # Test config
├── jest.config.ts                     # Jest configuration
└── README.md                          # This file (contributor guide)
```

## Development

### Building

```bash
# From monorepo root
npx nx build storage-vectors-js

# Watch mode for development
npx nx build storage-vectors-js --watch
```

### Testing

```bash
# Run tests
npx nx test storage-vectors-js

# Watch mode
npx nx test storage-vectors-js --watch

# With coverage
npx nx test storage-vectors-js --coverage
```

### Integration with Storage-JS

When developing features that affect storage-js:

1. Make changes in `storage-vectors-js/src/`
2. Build `storage-vectors-js`: `npx nx build storage-vectors-js`
3. `storage-js` automatically picks up the changes via TypeScript project references
4. Test in `storage-js`: `npx nx test storage-js`
5. Run affected tests: `npx nx affected --target=test`

### Adding New Exports

When adding new types, classes, or functions:

1. Add them to the appropriate file in `src/lib/`
2. Export them from `src/index.ts`
3. They will automatically be available in `@supabase/storage-js` via the re-export

Example:

```typescript
// In src/lib/new-feature.ts
export class NewVectorFeature {
  // Implementation
}

// In src/index.ts
export { NewVectorFeature } from './lib/new-feature'

// Now automatically available in storage-js
import { NewVectorFeature } from '@supabase/storage-js'
```

## Key Exports

### Client Classes

- `StorageVectorsClient` - Main client for vector operations
- `VectorBucketScope` - Scoped operations for a bucket
- `VectorIndexScope` - Scoped operations for an index
- `VectorBucketApi` - Bucket management methods
- `VectorIndexApi` - Index management methods
- `VectorDataApi` - Vector data operations

### Types

- `VectorBucket` - Vector bucket metadata
- `VectorIndex` - Vector index configuration
- `VectorData` - Vector data representation
- `VectorObject` - Individual vector with metadata
- `VectorMatch` - Query result with similarity score
- `VectorMetadata` - Arbitrary JSON metadata
- `DistanceMetric` - 'cosine' | 'euclidean' | 'dotproduct'

### Error Handling

- `StorageVectorsError` - Base error class
- `StorageVectorsApiError` - API-specific errors
- `isStorageVectorsError()` - Type guard function

### Utilities

- `resolveFetch()` - Fetch implementation resolver
- `normalizeToFloat32()` - Vector normalization helper
- `validateVectorDimension()` - Dimension validation

## Related Documentation

- **User Documentation**: [storage-js README](../../core/storage-js/README.md#vector-embeddings)
- **Contributing Guide**: [CONTRIBUTING.md](../../../CONTRIBUTING.md)
- **Testing Guide**: [TESTING.md](../../../docs/TESTING.md)
- **Monorepo Architecture**: [CLAUDE.md](../../../CLAUDE.md)
