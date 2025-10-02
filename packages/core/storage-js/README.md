# `storage-js`

<div align="center">

[![pkg.pr.new](https://pkg.pr.new/badge/supabase/storage-js)](https://pkg.pr.new/~/supabase/storage-js)

</div>

JS Client library to interact with Supabase Storage.

- Documentation: https://supabase.io/docs/reference/javascript/storage-createbucket
- Typedoc: https://supabase.github.io/supabase-js/storage-js/v2/spec.json

## Quick Start Guide

### Installing the module

```bash
npm install @supabase/storage-js
```

### Connecting to the storage backend

```js
import { StorageClient } from '@supabase/storage-js'

const STORAGE_URL = 'https://<project_ref>.supabase.co/storage/v1'
const SERVICE_KEY = '<service_role>' //! service key, not anon key

const storageClient = new StorageClient(STORAGE_URL, {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
})
```

### Handling resources

#### Handling Storage Buckets

- Create a new Storage bucket:

  ```js
  const { data, error } = await storageClient.createBucket(
    'test_bucket', // Bucket name (must be unique)
    { public: false } // Bucket options
  )
  ```

- Retrieve the details of an existing Storage bucket:

  ```js
  const { data, error } = await storageClient.getBucket('test_bucket')
  ```

- Update a new Storage bucket:

  ```js
  const { data, error } = await storageClient.updateBucket(
    'test_bucket', // Bucket name
    { public: false } // Bucket options
  )
  ```

- Remove all objects inside a single bucket:

  ```js
  const { data, error } = await storageClient.emptyBucket('test_bucket')
  ```

- Delete an existing bucket (a bucket can't be deleted with existing objects inside it):

  ```js
  const { data, error } = await storageClient.deleteBucket('test_bucket')
  ```

- Retrieve the details of all Storage buckets within an existing project:

  ```js
  const { data, error } = await storageClient.listBuckets()
  ```

#### Handling Files

- Upload a file to an existing bucket:

  ```js
  const fileBody = ... // load your file here

  const { data, error } = await storageClient.from('bucket').upload('path/to/file', fileBody)
  ```

  > Note:  
  > The path in `data.Key` is prefixed by the bucket ID and is not the value which should be passed to the `download` method in order to fetch the file.  
  > To fetch the file via the `download` method, use `data.path` and `data.bucketId` as follows:
  >
  > ```javascript
  > const { data, error } = await storageClient.from('bucket').upload('/folder/file.txt', fileBody)
  > // check for errors
  > const { data2, error2 } = await storageClient.from(data.bucketId).download(data.path)
  > ```

  > Note: The `upload` method also accepts a map of optional parameters. For a complete list see the [Supabase API reference](https://supabase.com/docs/reference/javascript/storage-from-upload).

- Download a file from an exisiting bucket:

  ```js
  const { data, error } = await storageClient.from('bucket').download('path/to/file')
  ```

- List all the files within a bucket:

  ```js
  const { data, error } = await storageClient.from('bucket').list('folder')
  ```

  > Note: The `list` method also accepts a map of optional parameters. For a complete list see the [Supabase API reference](https://supabase.com/docs/reference/javascript/storage-from-list).

- Replace an existing file at the specified path with a new one:

  ```js
  const fileBody = ... // load your file here

  const { data, error } = await storageClient
    .from('bucket')
    .update('path/to/file', fileBody)
  ```

  > Note: The `upload` method also accepts a map of optional parameters. For a complete list see the [Supabase API reference](https://supabase.com/docs/reference/javascript/storage-from-upload).

- Move an existing file:

  ```js
  const { data, error } = await storageClient
    .from('bucket')
    .move('old/path/to/file', 'new/path/to/file')
  ```

- Delete files within the same bucket:

  ```js
  const { data, error } = await storageClient.from('bucket').remove(['path/to/file'])
  ```

- Create signed URL to download file without requiring permissions:

  ```js
  const expireIn = 60

  const { data, error } = await storageClient
    .from('bucket')
    .createSignedUrl('path/to/file', expireIn)
  ```

- Retrieve URLs for assets in public buckets:

  ```js
  const { data, error } = await storageClient.from('public-bucket').getPublicUrl('path/to/file')
  ```

## Development

This package is part of the [Supabase JavaScript monorepo](https://github.com/supabase/supabase-js). To work on this package:

### Building

#### Build Scripts Overview

The storage-js package uses multiple build scripts to generate different module formats for various JavaScript environments:

| Script         | Description                 | Output                                                          |
| -------------- | --------------------------- | --------------------------------------------------------------- |
| `build`        | **Complete build pipeline** | Runs all build steps in sequence                                |
| `build:main`   | **CommonJS build**          | `dist/main/` - Node.js compatible CommonJS modules              |
| `build:module` | **ES Modules build**        | `dist/module/` - Modern ES6 modules with TypeScript definitions |
| `build:umd`    | **UMD build**               | `dist/umd/` - Universal Module Definition for browsers/CDN      |
| `clean`        | **Clean build artifacts**   | Removes `dist/` and `docs/v2/` directories                      |
| `format`       | **Format code**             | Runs Prettier on all TypeScript files                           |

#### Running Builds

##### Complete Build (Recommended)

```bash
# From the monorepo root
npx nx build storage-js
```

This command executes the full build pipeline:

1. **Cleans** - Removes any existing build artifacts
2. **Formats** - Ensures consistent code formatting
3. **Builds CommonJS** - For Node.js environments (`dist/main/`)
4. **Builds ES Modules** - For modern bundlers (`dist/module/`)
5. **Builds UMD** - For browser script tags (`dist/umd/`)

##### Development Build with Watch Mode

```bash
# Continuously rebuild on file changes (from monorepo root)
npx nx build storage-js --watch
```

##### Individual Build Targets

For specific build outputs during development:

```bash
# Build CommonJS only (Node.js)
npx nx build:main storage-js

# Build ES Modules only (Modern bundlers)
npx nx build:module storage-js

# Build UMD only (Browser/CDN)
npx nx build:umd storage-js
```

##### Other Useful Commands

```bash
# Clean build artifacts
npx nx clean storage-js

# Format code
npx nx format storage-js

# Type checking
npx nx typecheck storage-js

# Generate documentation
npx nx docs storage-js
```

#### Build Outputs Explained

##### CommonJS (`dist/main/`)

- **Used by:** Node.js applications, older build tools
- **Entry point:** `dist/main/index.js`
- **Module format:** `require()` and `module.exports`
- **TypeScript definitions:** Included

##### ES Modules (`dist/module/`)

- **Used by:** Modern bundlers (Webpack, Rollup, Vite)
- **Entry point:** `dist/module/index.js`
- **Module format:** `import` and `export`
- **TypeScript definitions:** `dist/module/index.d.ts`
- **Benefits:** Tree-shaking, better static analysis

##### UMD (`dist/umd/`)

- **Used by:** Browser `<script>` tags, CDNs
- **Entry point:** `dist/umd/supabase.js`
- **Global variable:** `window.supabase`
- **Size:** Larger (includes all dependencies)
- **Usage example:**
  ```html
  <script src="https://unpkg.com/@supabase/storage-js/dist/umd/supabase.js"></script>
  <script>
    const { StorageClient } = window.supabase
  </script>
  ```

#### Package Exports

The package.json exports are configured to provide the right format for each environment:

```json
{
  "main": "dist/main/index.js",
  "module": "dist/module/index.js",
  "types": "dist/module/index.d.ts",
  "jsdelivr": "dist/umd/supabase.js",
  "unpkg": "dist/umd/supabase.js"
}
```

- **main** → Node.js environments (CommonJS format)
- **module** → Modern bundlers like Webpack, Vite, Rollup (ES Modules)
- **types** → TypeScript type definitions
- **jsdelivr/unpkg** → CDN usage via `<script>` tags (UMD format)

### Testing

**Important:** The storage-js tests require a local test infrastructure running in Docker. This is **NOT** the same as a regular Supabase instance - it's a specialized test setup with its own storage API, database, and Kong gateway.

#### Prerequisites

1. **Docker** must be installed and running
2. **Port availability** - The following ports must be free:
   - 5432 (PostgreSQL database)
   - 5050 (Storage API - sometimes 5000 conflicts macOS AirPlay conflict)
   - 8000 (Kong API Gateway)
   - 50020 (imgproxy for image transformations)

**Note:** If port 5000 conflicts with macOS AirPlay Receiver, the docker-compose.yml has been configured to use port 5050 instead.

#### Test Scripts Overview

| Script         | Description                       | What it does                                                      |
| -------------- | --------------------------------- | ----------------------------------------------------------------- |
| `test:storage` | **Complete test workflow**        | Runs the full test cycle: clean → start infra → run tests → clean |
| `test:suite`   | **Jest tests only**               | Runs Jest tests with coverage (requires infra to be running)      |
| `test:infra`   | **Start test infrastructure**     | Starts Docker containers for storage API, database, and Kong      |
| `test:clean`   | **Stop and clean infrastructure** | Stops all Docker containers and removes them                      |

#### Running Tests

##### Option 1: Complete Test Run (Recommended)

This handles everything automatically - starting infrastructure, running tests, and cleaning up:

```bash
# From monorepo root
npx nx test:storage storage-js
```

This command will:

1. Stop any existing test containers
2. Build and start fresh test infrastructure
3. Wait for services to be ready
4. Run all Jest tests with coverage
5. Clean up all containers after tests complete

##### Option 2: Manual Infrastructure Management

Useful for development when you want to run tests multiple times without restarting Docker:

```bash
# Step 1: Start the test infrastructure
# From root
npx nx test:infra storage-js
# This starts: PostgreSQL, Storage API, Kong Gateway, and imgproxy

# Step 2: Run tests (can run multiple times)
npx nx test:suite storage-js

# Step 3: When done, clean up the infrastructure
npx nx test:clean storage-js
```

##### Option 3: Development Mode

For actively developing and debugging tests:

```bash
# Start infrastructure once (from root)
npx nx test:infra storage-js

# Run tests in watch mode
npx nx test:suite storage-js --watch

# Clean up when done
npx nx test:clean storage-js
```

#### Test Infrastructure Details

The test infrastructure (`infra/docker-compose.yml`) includes:

- **PostgreSQL Database** (port 5432)
  - Initialized with storage schema and test data
  - Contains bucket configurations and permissions

- **Storage API** (port 5050, internal 5000)
  - Supabase Storage service for handling file operations
  - Configured with test authentication keys

- **Kong Gateway** (port 8000)
  - API gateway that routes requests to storage service
  - Handles authentication and CORS

- **imgproxy** (port 50020)
  - Image transformation service for on-the-fly image processing

#### Common Issues and Solutions

| Issue                             | Solution                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Port 5000 already in use          | macOS AirPlay uses this port. Either disable AirPlay Receiver in System Settings or use the modified docker-compose.yml with port 5050 |
| Port 5432 already in use          | Another PostgreSQL instance is running. Stop it or modify the port in docker-compose.yml                                               |
| "request failed, reason:" errors  | Infrastructure isn't running. Run `npx nx test:infra storage-js` first                                                                 |
| Tests fail with connection errors | Ensure Docker is running and healthy                                                                                                   |
| "Container name already exists"   | Run `npx nx test:clean storage-js` to remove existing containers                                                                       |

#### Understanding Test Failures

- **StorageUnknownError with "request failed"**: Infrastructure not running
- **Port binding errors**: Ports are already in use by other services
- **Snapshot failures**: Expected test data has changed - review and update snapshots if needed

#### What About Supabase CLI?

**No**, you don't need `supabase start` or a regular Supabase instance for these tests. The storage-js tests use their own specialized Docker setup that's lighter and focused specifically on testing the storage client library. This test infrastructure:

- Is completely independent from any Supabase CLI projects
- Uses fixed test authentication keys
- Has predictable test data and bucket configurations
- Runs faster than a full Supabase stack
- Doesn't interfere with your local Supabase development projects

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.

## Sponsors

We are building the features of Firebase using enterprise-grade, open source products. We support existing communities wherever possible, and if the products don’t exist we build them and open source them ourselves. Thanks to these sponsors who are making the OSS ecosystem better for everyone.

[![New Sponsor](https://user-images.githubusercontent.com/10214025/90518111-e74bbb00-e198-11ea-8f88-c9e3c1aa4b5b.png)](https://github.com/sponsors/supabase)
