# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository Overview

This is a unified Nx monorepo consolidating all Supabase JavaScript SDKs, built with Nx for optimal developer experience and maintainability. This strategic migration from 6 separate repositories addresses critical maintenance overhead, dependency duplication, and release coordination challenges while maintaining **zero breaking changes** for consumers.

> **📚 Key Documentation**: For comprehensive guides, see:
>
> - [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines and PR process
> - [TESTING.md](docs/TESTING.md) - Complete testing guide
> - [RELEASE.md](docs/RELEASE.md) - Release workflows and versioning
> - [MIGRATION.md](docs/MIGRATION.md) - Migration guide from old repos
> - [SECURITY.md](docs/SECURITY.md) - Security policies

### Migration Context

This monorepo replaces the following individual repositories:

- supabase/supabase-js → packages/core/supabase-js
- supabase/auth-js → packages/core/auth-js
- supabase/functions-js → packages/core/functions-js
- supabase/postgrest-js → packages/core/postgrest-js
- supabase/realtime-js → packages/core/realtime-js
- supabase/storage-js → packages/core/storage-js

### Important Notes

- **Current Default Branch**: `master` (confirmed current default branch)
- **Original Branch Differences**: Original repos used different default branches (master vs main). Check each library's original repo for reference.
- **Package Names**: All packages maintain their original npm names (@supabase/[package-name])
- **Zero Breaking Changes**: This migration maintains full backward compatibility for consumers
- **Shared Code**: Common patterns (HTTP client, error handling) should be extracted to shared packages when identified

### Key Benefits

- **Single Version Policy**: 22 previously duplicated dependencies now centrally managed
- **Atomic Changes**: Fix bugs across libraries in a single PR
- **Immediate Integration Testing**: Test integration changes without manual releases
- **Unified Versioning**: Fixed version mode with automated releases using `nx release`
- **Intelligent Building**: Nx only rebuilds/tests what actually changed

## Project Structure

```text
supabase-js/
├── packages/core/              # Published libraries
│   ├── supabase-js/           # Main isomorphic SDK for Supabase (@supabase/supabase-js)
│   ├── auth-js/               # Authentication SDK (@supabase/auth-js)
│   ├── postgrest-js/          # PostgREST SDK for database operations (@supabase/postgrest-js)
│   ├── realtime-js/           # Real-time subscriptions SDK (@supabase/realtime-js)
│   ├── storage-js/            # File storage SDK (@supabase/storage-js)
│   └── functions-js/          # Edge Functions SDK (@supabase/functions-js)
├── docs/                       # Documentation guides
│   ├── CONTRIBUTING.md         # Contribution guidelines
│   ├── TESTING.md             # Testing guide
│   ├── RELEASE.md             # Release workflows
│   ├── MIGRATION.md           # Migration guide
│   └── SECURITY.md            # Security policy
├── scripts/                    # Build and release scripts
│   ├── release-canary.ts      # Canary release automation
│   ├── release-stable.ts      # Stable release automation
│   └── update-version-files.ts # Version management
├── nx.json                    # Nx workspace configuration
├── tsconfig.base.json         # Base TypeScript configuration
├── package.json               # Root package with workspace scripts
└── commitlint.config.js       # Commit message validation
```

## Essential Commands

### Building Libraries

```bash
# Build all packages
nx run-many --target=build --all

# Build a specific library
nx build auth-js
nx build supabase-js

# Build with watch mode for development
nx build auth-js --watch

# Build only affected packages (based on changes)
nx affected --target=build
```

### Testing

> **📖 For detailed testing information, see [TESTING.md](docs/TESTING.md)**

```bash
# Run all unit tests
nx run-many --target=test --all

# Run tests for a specific library
nx test auth-js                  # May also use: nx test:auth auth-js
nx test postgrest-js
nx test functions-js
nx test realtime-js
nx test storage-js               # May also use: nx test:storage storage-js
nx test supabase-js

# Run only affected tests (recommended during development)
nx affected --target=test

# Run tests in watch mode for a specific library
nx test auth-js --watch

# Run tests with coverage
nx test auth-js --coverage
```

**Docker Requirements for Integration Tests:**

| Package      | Docker Required | Notes                           | Special Commands |
| ------------ | --------------- | ------------------------------- | ---------------- |
| auth-js      | ✅ Yes          | Requires GoTrue + PostgreSQL    | May use `nx test:auth auth-js` |
| functions-js | ✅ Yes          | Uses testcontainers for Deno    | Standard `nx test functions-js` |
| postgrest-js | ✅ Yes          | Requires PostgREST + PostgreSQL | Standard `nx test postgrest-js` |
| storage-js   | ✅ Yes          | Requires Storage API + Kong     | May use `nx test:storage storage-js` |
| realtime-js  | ❌ No           | Uses mock WebSockets            | Standard `nx test realtime-js` |
| supabase-js  | ❌ No           | Unit tests only                 | Standard `nx test supabase-js` |

### Code Quality

```bash
# Lint all packages
nx run-many --target=lint --all

# Lint a specific package
nx lint auth-js

# Format all code
nx format

# Check code formatting without fixing
nx format:check
```

### Workspace Analysis

```bash
# Generate interactive dependency graph
nx graph

# Show all projects in the workspace
nx show projects

# Show what's affected by current changes
nx affected --graph
```

### Library-Specific Development

> **⚠️ Important**: Always use Nx commands from the repository root rather than running npm scripts directly in library directories.

```bash
# ✅ Correct: Use Nx from root
nx test auth-js
nx build postgrest-js --watch

# ❌ Avoid: Don't run npm directly in library directories
# cd packages/core/auth-js && npm test
```

Each library has its own testing infrastructure. See the [TESTING.md](docs/TESTING.md) guide and individual package READMEs for details.

## Architecture & Dependencies

### Core Architecture

The main `@supabase/supabase-js` package aggregates all individual SDKs:

- **auth-js**: Handles authentication and user management
- **postgrest-js**: Provides database query capabilities via PostgREST
- **realtime-js**: Manages real-time subscriptions and channels
- **storage-js**: Handles file uploads and storage operations
- **functions-js**: Invokes Supabase Edge Functions

Each library is designed to work independently but integrates seamlessly when used together through the main SDK.

### Development Infrastructure

- **Testing**: Uses Jest for unit testing, with integration tests for each library
- **Build System**: TypeScript compilation with separate builds for CommonJS and ES modules
- **Infrastructure**: Docker Compose configurations for auth-js and storage-js to run local Supabase services during testing

### Key TypeScript Configuration

The workspace uses strict TypeScript settings:

- Target: ES2022
- Module Resolution: NodeNext
- Strict mode enabled
- Isolated modules for better compilation performance
- Composite projects for incremental builds

## Testing Strategy

> **📖 Comprehensive testing documentation available in [TESTING.md](docs/TESTING.md)**

### Unit Tests

Each library has comprehensive unit tests in its `test/` directory. Tests are run using Jest and should cover all public APIs.

### Integration Tests

Libraries that interact with external services include Docker-based integration tests:

| Library      | Infrastructure                  | Setup Method   |
| ------------ | ------------------------------- | -------------- |
| auth-js      | GoTrue + PostgreSQL             | Docker Compose |
| storage-js   | Storage API + PostgreSQL + Kong | Docker Compose |
| postgrest-js | PostgREST + PostgreSQL          | Docker Compose |
| functions-js | Deno relay                      | Testcontainers |

### Cross-Platform Testing

The main `supabase-js` library includes integration tests for multiple environments:

- Node.js (native runtime)
- Next.js (SSR/React framework)
- Expo (React Native)
- Bun (alternative runtime)
- Deno (secure runtime)
- Browser (via Puppeteer)

### Running Tests

```bash
# Test specific package
nx test [package-name]

# Test with coverage
nx test [package-name] --coverage

# Test in watch mode
nx test [package-name] --watch

# Test only what changed (recommended)
nx affected --target=test
```

## Working with Individual Libraries

> **📖 Each library has detailed README with testing and development instructions**
>
> - [supabase-js README](packages/core/supabase-js/README.md)
> - [auth-js README](packages/core/auth-js/README.md)
> - [functions-js README](packages/core/functions-js/README.md)
> - [postgrest-js README](packages/core/postgrest-js/README.md)
> - [realtime-js README](packages/core/realtime-js/README.md)
> - [storage-js README](packages/core/storage-js/README.md)

### Library Characteristics

| Library      | Docker Required | Primary Use Case           |
| ------------ | --------------- | -------------------------- |
| supabase-js  | ❌ No           | Main isomorphic SDK     |
| auth-js      | ✅ Yes          | Authentication & user mgmt |
| postgrest-js | ✅ Yes          | Database queries           |
| realtime-js  | ❌ No           | Real-time subscriptions    |
| functions-js | ✅ Yes          | Edge Functions invocation  |
| storage-js   | ✅ Yes          | File storage operations    |

## Nx Workspace Features

### Caching

Nx caches build and test results. Clear cache when needed:

```bash
nx reset
```

### Parallel Execution

Commands run in parallel by default. Control with:

```bash
nx run-many --target=build --all --parallel=3
```

### Task Dependencies

Nx automatically handles task dependencies. Building a library will first build its dependencies.

## Common Development Workflows

### Adding a New Feature

1. Make changes in the relevant library under `packages/core/[library]/src/`
2. Add unit tests in `packages/core/[library]/test/`
3. Run affected tests: `nx affected --target=test`
4. Build affected libraries: `nx affected --target=build`
5. Format code: `nx format`
6. Commit using conventional commits: `npm run commit`

### Cross-Library Bug Fix

When a bug spans multiple libraries (e.g., issue in supabase-js caused by realtime-js):

1. Fix the root cause in the source library (e.g., `packages/core/realtime-js/src/`)
2. Add/update unit tests in the source library
3. Add integration tests in `packages/core/supabase-js/test/` if needed
4. Run: `nx affected --target=test` to verify all affected packages
5. Commit with clear message: `fix(realtime-js): resolve connection issue affecting supabase-js`
6. All changes ship together in the next release - no manual coordination needed

### Debugging Test Failures

1. Run tests for specific library: `nx test [library-name]`
2. Run with watch mode: `nx test [library-name] --watch`
3. Check if Docker is required and running (see [TESTING.md](docs/TESTING.md))
4. Review test output and error messages
5. Use `nx graph` to understand dependencies

### Preparing Changes for PR

1. Format all code: `nx format`
2. Check formatting: `nx format:check`
3. Run affected tests: `nx affected --target=test`
4. Run affected linting: `nx affected --target=lint`
5. Build affected packages: `nx affected --target=build`
6. Use interactive commit tool: `npm run commit`

## Release Strategy

> **📖 Complete release documentation in [RELEASE.md](docs/RELEASE.md)**

### Fixed Version Mode

All packages in this monorepo use **fixed version mode**, meaning they share the same version number and are released together. This ensures compatibility and simplifies dependency management.

- **Version**: All packages have identical version (e.g., 2.80.0)
- **Version Line**: Continuing with v2.x.x
- **Dependencies**: Internal dependencies use workspace protocol (`*`)
- **Changelog**: Per-package changelogs; unchanged packages show "No user-facing changes"

### Release Types

#### 1. Canary Releases (Automated)

**Trigger**: Every commit to `master` branch  
**Workflow**: `.github/workflows/main-ci-release.yml`

- Automatically creates pre-release version (e.g., `2.80.1-canary.0`)
- Publishes to npm with `canary` dist-tag
- Creates GitHub pre-release tag
- Used for internal validation and early testing

Install canary versions:

```bash
npm install @supabase/supabase-js@canary
npm install @supabase/auth-js@canary
```

#### 2. Stable Releases (Manual)

**Trigger**: Manual workflow dispatch (repository owners only)  
**Workflow**: `.github/workflows/release-stable.yml`

- Repository owner specifies version (`patch`, `minor`, `major`, or explicit version)
- Bumps version for all packages
- Generates changelogs from conventional commits
- Publishes to npm with `latest` dist-tag
- Creates release branch and auto-merge PR

#### 3. Preview Releases (PR-based)

**Trigger**: PR with `trigger: preview` label  
**Workflow**: `.github/workflows/preview-release.yml`

- Contributors request preview by asking maintainers to add label
- Uses [pkg.pr.new](https://pkg.pr.new) to create preview packages
- Allows testing PR changes before merging

Install preview versions:

```bash
npm install https://pkg.pr.new/@supabase/supabase-js@[pr-number]
```

### Internal Dependencies

The `supabase-js` package uses workspace dependencies:

```json
{
  "dependencies": {
    "@supabase/auth-js": "*",
    "@supabase/realtime-js": "*",
    "@supabase/functions-js": "*",
    "@supabase/storage-js": "*",
    "@supabase/postgrest-js": "*"
  }
}
```

Nx automatically replaces `*` with the actual version during release.

## Commit Message Guidelines

> **📖 Complete guidelines in [CONTRIBUTING.md](CONTRIBUTING.md#commit-guidelines)**

This monorepo uses [Conventional Commits](https://www.conventionalcommits.org/) with strict validation.

### Using the Interactive Commit Tool

**Always use the interactive commit tool** instead of `git commit`:

```bash
npm run commit
```

This ensures your commits follow the required format and pass validation.

### Commit Format

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Available Types

| Type       | Description                                       | Version Impact |
| ---------- | ------------------------------------------------- | -------------- |
| `feat`     | A new feature                                     | Minor          |
| `fix`      | A bug fix                                         | Patch          |
| `docs`     | Documentation only changes                        | None           |
| `style`    | Code style changes (formatting, semicolons, etc.) | None           |
| `refactor` | Code change that neither fixes bug nor adds feat  | None           |
| `perf`     | Performance improvement                           | Patch          |
| `test`     | Adding or correcting tests                        | None           |
| `build`    | Build system or external dependencies             | None           |
| `ci`       | CI configuration files and scripts                | None           |
| `chore`    | Other changes that don't modify src or test       | None           |
| `revert`   | Reverts a previous commit                         | Depends        |

### Available Scopes (Required)

**Library-Specific:**

- `auth` - Changes to @supabase/auth-js
- `functions` - Changes to @supabase/functions-js
- `postgrest` - Changes to @supabase/postgrest-js
- `realtime` - Changes to @supabase/realtime-js
- `storage` - Changes to @supabase/storage-js
- `supabase` - Changes to @supabase/supabase-js

**Workspace-Level:**

- `repo` - Repository-level changes
- `deps` - Dependencies
- `ci` - Changes to CI
- `release` - Release process
- `docs` - Documentation
- `scripts` - Build/dev scripts
- `misc` - Miscellaneous

### Breaking Changes

To trigger a major version bump, use:

- `feat(auth)!: remove deprecated method` (note the `!`)
- Or include `BREAKING CHANGE:` in the commit body

### Commit Examples

```bash
feat(auth): add support for custom auth providers
fix(storage): resolve upload timeout issue
docs(postgrest): update filter documentation
chore(deps): update nx to latest version
ci(release): add preview package generation
feat(realtime)!: remove deprecated subscribe method
```

## Pull Request Process

> **📖 Complete PR guidelines in [CONTRIBUTING.md](CONTRIBUTING.md#pull-request-process)**

### Before Submitting

1. Ensure your branch is up to date with `master`
2. Run affected tests: `nx affected --target=test`
3. Run affected builds: `nx affected --target=build`
4. Format code: `nx format`
5. Use interactive commit tool: `npm run commit`

### PR Requirements

All pull requests must meet these requirements:

- ✅ At least 1 approving review from a code owner
- ✅ All status checks passing (CI/CD pipeline)
- ✅ No merge conflicts with the base branch
- ✅ Squash merge only (enforced by repository settings)

### Requesting Preview Releases

If you need to test your changes with a release build:

1. Create your PR
2. Request in PR comment: "Can a maintainer add the preview label for testing?"
3. Wait for maintainer to add `trigger: preview` label
4. Install preview packages following automated comment instructions

## Code Organization Conventions

### Directory Structure

Each library follows this structure:

```text
packages/core/[library]/
├── src/              # Source code
├── test/             # Test files (mirrors src/ structure)
├── docs/             # API documentation
├── infra/            # Docker infrastructure (if needed)
├── package.json      # Library-specific dependencies
├── tsconfig.json     # TypeScript configuration
├── jest.config.js    # Jest configuration
└── README.md         # Library documentation
```

### Code Style

- **Formatting**: Prettier handles all formatting (run `nx format`)
- **Linting**: ESLint enforces code quality (run `nx lint [library]`)
- **TypeScript**: Strict mode enabled for all libraries
- **Naming**: Follow existing patterns in each library

### Testing Patterns

- Unit tests for all public APIs
- Integration tests for external service interactions
- Use Docker for reproducible test environments
- Mock external dependencies in unit tests
- Test files mirror source structure

## Important Reminders

### Do's ✅

- **Use Nx commands** from repository root
- **Run affected commands** to save time (`nx affected --target=test`)
- **Use interactive commit tool** (`npm run commit`)
- **Format code** before committing (`nx format`)
- **Read package READMEs** for library-specific details and special test commands
- **Check documentation** in `docs/` for comprehensive guides
- **Check for Docker requirements** before running integration tests
- **Use conventional commit format** with proper scope

### Don'ts ❌

- **Don't run npm commands** directly in library directories
- **Don't skip commit message validation** (use `npm run commit`)
- **Don't hardcode internal versions** (use `*` protocol)
- **Don't test everything** when only some packages changed (use `nx affected`)
- **Don't make breaking changes** without discussion and proper commit format
- **Don't assume all packages use standard test commands** (check for special targets)

## Troubleshooting

### Port Conflicts

If you get port conflict errors during tests:

```bash
# Check what's using the port
lsof -i :<port-number>

# Kill the process
kill -9 <PID>
```

### Docker Issues

If Docker tests fail:

1. Ensure Docker Desktop is running
2. Check available disk space
3. Try cleaning up containers: `docker system prune`
4. Restart Docker Desktop if needed

### Build Failures

If builds fail unexpectedly:

```bash
# Clear Nx cache
nx reset

# Clean node_modules and reinstall
rm -rf node_modules
npm install

# Rebuild from scratch
nx run-many --target=build --all
```

### Test Failures

If tests fail after pulling latest changes:

```bash
# Ensure dependencies are up to date
npm install

# Rebuild affected packages
nx affected --target=build

# Run tests
nx affected --target=test
```

## Additional Resources

- **[Main README](README.md)** - Repository overview and quick start
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines and workflow
- **[TESTING.md](docs/TESTING.md)** - Complete testing guide
- **[RELEASE.md](docs/RELEASE.md)** - Release workflows and versioning
- **[MIGRATION.md](docs/MIGRATION.md)** - Migration guide from old repos
- **[SECURITY.md](docs/SECURITY.md)** - Security policies and reporting
- **[Supabase Docs](https://supabase.com/docs)** - Official Supabase documentation
- **[Nx Documentation](https://nx.dev)** - Nx workspace documentation
