# Storage Integration Tests

Integration tests for `@supabase/storage-js` running against Supabase CLI infrastructure.

## Test Files

### storageFileApi.test.ts

Main storage file API integration tests covering:

- File upload (single, multiple, overwrite)
- File download (blob, stream, signed URLs)
- File operations (move, copy, remove, list)
- Public URLs and signed URLs
- Search and list with filters
- Image transformations

### storageBucketApi.test.ts

Bucket API error handling and URL construction tests:

- URL normalization and construction
- Error handling for various API failures
- Bucket creation with different configurations

### storageApi.test.ts

Basic bucket API operations:

- List all buckets
- Get bucket by ID
- Create/update/delete buckets
- Empty buckets
- Bucket configuration (public, file size limits, MIME types)

### storageFileApiErrorHandling.test.ts

Comprehensive error handling tests:

- Network error handling
- API error responses
- Invalid request handling
- Error type verification

### storageFileApiNode.test.ts

Node.js-specific tests:

- Stream upload handling
- Duplex stream options

## Running Tests

```bash
# Run all storage tests
nx test:e2e:storage e2e-tests

# Run specific test file
cd e2e-tests
npm run jest tests/storage/storageFileApi.test.ts

# Run with coverage
nx test:e2e:storage e2e-tests -- --coverage
```

## Test Setup

Tests use shared helpers from `/e2e-tests/helpers/storage-client.ts`:

- `createStorageClient()` - Creates client with service_role key (bypasses RLS)
- `createAnonStorageClient()` - Creates client with anon key
- `createNewBucket()` - Creates a unique bucket for testing
- `findOrCreateBucket()` - Finds existing or creates new bucket
- `deleteBucket()` - Cleans up test buckets

## Fixtures

Test fixtures are located in `./fixtures/upload/`:

- `sadcat.jpg` - Test image file
- `file.txt` - Test text file
- Other test assets

## Notes

- Tests run against local Supabase CLI (http://127.0.0.1:54321/storage/v1)
- Tests use service_role key to bypass RLS for testing
- Buckets are created with unique timestamps to avoid conflicts
- Tests run sequentially (`--runInBand`) to prevent race conditions
- Original tests location: `packages/core/storage-js/test/`

## Migration Status

✅ **Completed**: All storage-js integration tests migrated to e2e-tests

- ✅ storageFileApi.test.ts (933 lines - main file API tests)
- ✅ storageBucketApi.test.ts (bucket API and error handling)
- ✅ storageApi.test.ts (basic bucket operations)
- ✅ storageFileApiErrorHandling.test.ts (error handling)
- ✅ storageFileApiNode.test.ts (Node-specific tests)
- ✅ Fixtures copied
- ✅ Imports updated to use shared helpers
- ✅ Nx target configured

**Next Step**: Keep old tests running in CI alongside new e2e tests for validation period (1-2 weeks)
