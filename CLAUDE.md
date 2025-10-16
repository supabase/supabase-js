# Claude AI Instructions for Supabase JS Libraries Monorepo

You are assisting with development in a unified Nx monorepo that consolidates all Supabase JavaScript SDKs, built with Nx for optimal developer experience and maintainability. This strategic migration from 6 separate repositories addresses critical maintenance overhead, dependency duplication, and release coordination challenges while maintaining **zero breaking changes** for consumers.

> **📚 Essential Documentation**: Always refer to these guides for detailed information:
>
> - **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development guidelines, commit format, PR process
> - **[TESTING.md](docs/TESTING.md)** - Complete testing guide with Docker requirements
> - **[RELEASE.md](docs/RELEASE.md)** - Release workflows and versioning strategy
> - **[MIGRATION.md](docs/MIGRATION.md)** - Migration context from old repositories
> - **[SECURITY.md](docs/SECURITY.md)** - Security policies and responsible disclosure

## Repository Architecture

### Monorepo Structure

```text
supabase-js/
├── packages/core/
│   ├── supabase-js/      # @supabase/supabase-js - Main isomorphic client for Supabase
│   ├── auth-js/          # @supabase/auth-js - Authentication client
│   ├── postgrest-js/     # @supabase/postgrest-js - PostgREST client for database operations
│   ├── realtime-js/      # @supabase/realtime-js - Real-time subscriptions client
│   ├── storage-js/       # @supabase/storage-js - File storage client
│   └── functions-js/     # @supabase/functions-js - Edge Functions client
├── docs/                 # Comprehensive documentation guides
│   ├── CONTRIBUTING.md   # Contribution guidelines
│   ├── TESTING.md        # Testing guide
│   ├── RELEASE.md        # Release workflows
│   ├── MIGRATION.md      # Migration guide
│   └── SECURITY.md       # Security policy
├── scripts/              # Automation scripts
│   ├── release-canary.ts # Canary release automation
│   ├── release-stable.ts # Stable release automation
│   └── update-version-files.ts # Version management
├── nx.json               # Nx workspace configuration
├── tsconfig.base.json    # Base TypeScript configuration
├── package.json          # Root package with workspace scripts
└── commitlint.config.js  # Commit message validation
```

### Migration Benefits

- **Dependency Consolidation**: 22 previously duplicated dependencies now centrally managed
- **Atomic Changes**: Cross-library fixes in single PRs
- **Immediate Integration Testing**: No manual release coordination needed
- **Unified Versioning**: Fixed version mode with automated releases using `nx release`
- **Intelligent Building**: Nx only rebuilds/tests what actually changed

## Core Development Principles

### 1. Zero Breaking Changes

Every change must maintain full backward compatibility. The migration itself introduces no breaking changes - all packages maintain their original npm names and APIs.

### 2. Hybrid Release Model with Fixed Versioning

Uses automated canary releases with batched stable releases:

- **Canary**: Every commit to master → prerelease (e.g., `2.80.1-canary.0`) with `canary` dist-tag
- **Stable**: Manual promotion of validated canary to `latest` dist-tag
- **Fixed Versioning**: All packages share identical version numbers (e.g., all at 2.80.0)
- **Version Line**: Continuing with v2.x.x to maintain ecosystem stability

**Three Release Workflows:**

1. **Canary** (`.github/workflows/main-ci-release.yml`) - Automated on every master commit
2. **Stable** (`.github/workflows/release-stable.yml`) - Manual by repository owners
3. **Preview** (`.github/workflows/preview-release.yml`) - PR-based testing via pkg.pr.new

> **📖 See [RELEASE.md](docs/RELEASE.md) for complete release documentation**

### 3. Workspace Dependencies

Internal dependencies use the `*` protocol:

```json
// packages/core/supabase-js/package.json
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

### 4. Affected-First Development

Always use `nx affected` commands to build/test only what changed, leveraging Nx's dependency graph intelligence.

### 5. Conventional Commits

Use conventional commit format for automated versioning:

- `fix(auth-js): resolve token refresh race condition` → Patch release
- `feat(realtime-js): add presence support` → Minor release
- `feat(auth)!: remove deprecated method` → Major release
- `chore(deps): update TypeScript to 5.8` → No version bump

**Always use the interactive commit tool:**

```bash
npm run commit
```

> **📖 See [CONTRIBUTING.md](CONTRIBUTING.md#commit-guidelines) for complete commit guidelines**

## Essential Commands Reference

### Building

```bash
nx run-many --target=build --all        # Build all packages
nx build auth-js                         # Build specific package
nx affected --target=build               # Build only affected
nx build auth-js --watch                 # Development mode
```

### Testing

```bash
nx run-many --target=test --all          # Test all packages
nx test auth-js                          # Test specific package
nx test postgrest-js                     # Test specific package
nx test functions-js                     # Test specific package
nx test realtime-js                      # Test specific package
nx test storage-js                       # Test specific package (may use special test:storage target)
nx test supabase-js                      # Test specific package
nx affected --target=test                # Test only affected (recommended)
nx test auth-js --watch                  # Watch mode
nx test supabase-js --coverage           # Test with coverage
```

**Docker Requirements:**

| Package      | Docker Required | Infrastructure                  | Special Commands                     |
| ------------ | --------------- | ------------------------------- | ------------------------------------ |
| auth-js      | ✅ Yes          | Auth Server + Postgres          | May use `nx test:auth auth-js`       |
| functions-js | ✅ Yes          | Deno relay (testcontainers)     | Standard `nx test functions-js`      |
| postgrest-js | ✅ Yes          | PostgREST + PostgreSQL          | Standard `nx test postgrest-js`      |
| storage-js   | ✅ Yes          | Storage API + PostgreSQL + Kong | May use `nx test:storage storage-js` |
| realtime-js  | ❌ No           | Mock WebSockets                 | Standard `nx test realtime-js`       |
| supabase-js  | ❌ No           | Unit tests only                 | Standard `nx test supabase-js`       |

> **📖 See [TESTING.md](docs/TESTING.md) for complete testing guide and troubleshooting**

### Code Quality

```bash
nx run-many --target=lint --all          # Lint all packages
nx lint storage-js                       # Lint specific package
nx format                                 # Auto-format all code
nx format:check                           # Check formatting
```

### Analysis

```bash
nx graph                                  # Interactive dependency graph
nx show projects                          # List all projects
nx affected --graph                       # Visualize affected projects
```

## Development Workflows

### Cross-Library Bug Fix Example

**Scenario**: Bug in supabase-js caused by realtime-js

**Monorepo Solution**:

1. Fix root cause in `packages/core/realtime-js/src/`
2. Add unit test in `packages/core/realtime-js/test/`
3. Add integration test in `packages/core/supabase-js/test/`
4. Run `nx affected --target=test` to verify both packages
5. Commit: `fix(realtime-js): resolve reconnection logic affecting supabase-js`
6. Single PR, single review, single release - all packages version together

### Adding New Features

1. Implement in appropriate library under `packages/core/[library]/src/`
2. Write comprehensive unit tests in `packages/core/[library]/test/`
3. If feature affects supabase-js, add integration tests there
4. Update TypeScript types if needed
5. Run `nx affected --target=test` before committing
6. Use conventional commit: `feat(storage-js): add resumable uploads`

### Quick Fix Workflow

```bash
# Even for single-library fixes:
git add .
git commit -m "fix(auth-js): correct session expiry calculation"
# → Automatic canary: 2.80.1-canary.0 published to 'canary' dist-tag
nx affected --target=test
# After validation, manual promotion:
nx release --tag=latest --yes  # Promotes to stable with same version for ALL packages
```

## TypeScript Configuration

### Workspace Settings

- **Target**: ES2022
- **Module**: NodeNext
- **Strict**: true
- **Isolated Modules**: true (faster compilation)
- **Composite**: true (incremental builds)

### Per-Library Configs

Each library has its own `tsconfig.json` extending the base configuration, allowing for library-specific adjustments while maintaining consistency.

### TypeScript Project References Setup

This repository uses TypeScript project references for incremental builds and better type checking across packages.

**What's Configured:**

1. **tsconfig.base.json** - Base configuration inherited by all projects:
   - `composite: true` - Enables project references
   - `declaration: true` - Required by composite
   - `moduleResolution: "bundler"` - Works with workspaces
   - `isolatedModules: true` - Inherited but overridden in core packages
   - `noImplicitOverride: true` - Inherited but overridden in core packages
   - **No `customConditions`** - Removed to avoid conflicts with CommonJS packages

2. **Root tsconfig.json** - References all projects in the monorepo:

   ```json
   {
     "extends": "./tsconfig.base.json",
     "files": [],
     "references": [
       { "path": "./packages/core/auth-js" },
       { "path": "./packages/core/realtime-js" }
       // ... all other packages
     ]
   }
   ```

3. **Core packages** (auth-js, realtime-js, postgrest-js, functions-js, storage-js):
   - Keep `module: "CommonJS"` for backward compatibility
   - Override `moduleResolution: "Node"` (required for CommonJS)
   - Override `isolatedModules: false` (existing code doesn't use `export type`)
   - Override `noImplicitOverride: false` (existing code doesn't use `override` keyword)
   - Add `references` array pointing to dependencies (managed by `nx sync`)

4. **Utils packages** (utils-fetch):
   - Inherit `moduleResolution: "bundler"` from base
   - Can optionally add `customConditions: ["@supabase-js/source"]` for source preference

**Key Principles:**

- ✅ **No Breaking Changes**: Build output is identical - only type-checking is affected
- ✅ **Incremental Builds**: TypeScript only recompiles changed projects
- ✅ **Better Performance**: Reduced memory usage during builds
- ✅ **Automatic References**: Nx sync automatically maintains project references
- ⚠️ **No `customConditions` in base**: Would conflict with `moduleResolution: "Node"`

**When Adding New Packages:**

1. Ensure `composite: true` and `declaration: true` are set
2. Add `references` array pointing to dependencies
3. If using CommonJS, override `moduleResolution: "Node"` and disable strict options
4. Run `nx sync` to update root tsconfig.json automatically

**Important Notes:**

- TypeScript project references work WITHOUT `customConditions` - it's optional
- `customConditions` only optimizes source file resolution during development
- Core packages use `moduleResolution: "Node"` which is incompatible with `customConditions`
- The `isolatedModules: false` override avoids requiring `export type` for type re-exports
- All build outputs remain identical to pre-project-references setup

## Testing Infrastructure

### Unit Tests (Jest)

- Location: `packages/core/[library]/test/`
- Pattern: Mirror source structure
- Principle: Test public APIs thoroughly
- Mocking: Mock external dependencies

### Integration Tests (Docker-based)

**Auth-JS & Storage-JS**:

```bash
cd packages/core/auth-js
npm run test:infra   # Start Docker containers
npm run test:suite   # Run tests
npm run test:clean   # Cleanup
```

### Cross-Platform Tests (supabase-js)

Tests run against multiple environments:

- Node.js (native)
- Next.js (SSR/React)
- Expo (React Native)
- Bun (alternative runtime)
- Deno (secure runtime)
- Browser (via Puppeteer)

## Library-Specific Considerations

### supabase-js

- Aggregates all other libraries
- Primary integration testing location
- Most complex cross-platform test suite (Node.js, Next.js, Expo, Bun, Deno, Browser)
- Users typically interact through this package
- Default branch: **master**

### auth-js

- Requires Docker for integration tests (GoTrue + PostgreSQL)
- Complex session management logic
- Security-critical - extra review care needed
- See [auth-js README](packages/core/auth-js/README.md) for details

### realtime-js

- WebSocket-based, timing-sensitive
- Mock time in tests when possible
- No Docker required (uses mock WebSockets)
- See [realtime-js README](packages/core/realtime-js/README.md) for details

### storage-js

- Requires Docker for integration tests (Storage API + PostgreSQL + Kong)
- File handling varies by platform
- See [storage-js README](packages/core/storage-js/README.md) for details

### postgrest-js

- Pure HTTP client, easiest to test
- Requires Docker for integration tests (PostgREST + PostgreSQL)
- See [postgrest-js README](packages/core/postgrest-js/README.md) for details

### functions-js

- Simplest library, minimal dependencies
- Uses testcontainers for Deno relay
- See [functions-js README](packages/core/functions-js/README.md) for details

## Code Style Guidelines

### Formatting

- Prettier handles all formatting (configured in `.prettierrc`)
- Run `nx format` before committing
- No formatting debates - Prettier decides

### Patterns

- Follow existing patterns in each library
- Extract shared code to packages/shared/ when identified
- Maintain consistency across monorepo

### Documentation

- JSDoc for all public APIs
- README per package with examples
- Update docs when changing APIs

## Important Context

### Branch Information

**Current Repository:**

- **Default branch**: `master` (confirmed current default)
- **Repository URL**: `github.com/supabase/supabase-js`

**Original Repository Branches** (for historical reference):

- **master**: auth-js, postgrest-js, realtime-js, supabase-js
- **main**: functions-js, storage-js

When referencing original repository history or comparing changes, be aware of these branch name differences.

### Package Publishing

- All packages publish to npm under `@supabase` scope
- Versions synchronized via fixed release mode (all packages always have same version)
- Changelogs generated per package from conventional commits
- "No user-facing changes" message for unchanged packages
- Three dist-tags: `latest` (stable), `canary` (pre-release), `next` (legacy)

### Docker Requirements

Integration tests for auth-js, functions-js, postgrest-js, and storage-js require Docker running locally:

- **macOS/Windows**: Ensure Docker Desktop is installed and running
- **Linux**: Ensure Docker daemon is running
- **CI**: Docker is automatically available in GitHub Actions

Check [TESTING.md](docs/TESTING.md) for port requirements and troubleshooting.

### Commit Message Validation

All commits are validated using commitlint with strict rules:

- **Type**: Required (feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert)
- **Scope**: Required (auth, functions, postgrest, realtime, storage, supabase, repo, deps, ci, release, docs, scripts, misc)
- **Subject**: Required, imperative mood, no period at end, max 100 characters
- **Interactive Tool**: Use `npm run commit` to ensure compliance

See [CONTRIBUTING.md](CONTRIBUTING.md#commit-guidelines) for complete details.

## Common Pitfalls & Solutions

### Pitfall 1: Hardcoding Internal Versions

❌ Wrong:

```json
"@supabase/auth-js": "3.5.0"
```

✅ Correct:

```json
"@supabase/auth-js": "*"
```

### Pitfall 2: Running npm Directly

❌ Wrong:

```bash
cd packages/core/auth-js && npm test
```

✅ Correct:

```bash
nx test auth-js
```

### Pitfall 3: Testing Everything

❌ Wrong:

```bash
nx run-many --target=test --all  # Slow, tests unchanged code
```

✅ Correct:

```bash
nx affected --target=test  # Fast, tests only changes
```

### Pitfall 4: Breaking Changes

❌ Wrong: Changing public API signatures without proper process

```typescript
// Don't just change existing method signatures
- signIn(email: string): Promise<void>
+ signIn(credentials: Credentials): Promise<void>
```

✅ Correct: Add new methods, deprecate old ones gradually, use proper commit format

```typescript
// Add new method
signIn(credentials: Credentials): Promise<void>

// Deprecate old method with backward compatibility
/** @deprecated Use signIn(credentials) instead */
signInWithEmail(email: string): Promise<void> {
  return this.signIn({ email })
}
```

Use breaking change commit format when necessary:

```bash
feat(auth)!: remove deprecated signInWithEmail method

BREAKING CHANGE: The deprecated signInWithEmail method has been removed.
Use signIn({ email }) instead.
```

### Pitfall 5: Running Commands Incorrectly

❌ Wrong: Running npm commands directly in library directories

```bash
cd packages/core/auth-js
npm test
npm run build
```

✅ Correct: Use Nx commands from repository root

```bash
nx test auth-js
nx build auth-js --watch
```

### Pitfall 6: Not Using the Commit Tool

❌ Wrong: Using git commit directly

```bash
git commit -m "fix auth bug"  # Missing scope, will fail validation
```

✅ Correct: Use the interactive commit tool

```bash
npm run commit  # Guides you through proper format
```

### Pitfall 7: Not Checking Documentation

❌ Wrong: Assuming you know how to run tests without checking

```bash
nx test storage-js  # Might fail if Docker isn't running
```

✅ Correct: Check library README and TESTING.md first

```bash
# Read docs first
cat packages/core/storage-js/README.md
cat docs/TESTING.md
# Then run tests with proper setup
```

## Pull Request Best Practices

> **📖 See [CONTRIBUTING.md](CONTRIBUTING.md#pull-request-process) for complete PR guidelines**

### Before Creating PR

1. **Ensure branch is up to date:**

   ```bash
   git checkout master
   git pull upstream master
   git checkout your-feature-branch
   git rebase master
   ```

2. **Run all necessary checks:**

   ```bash
   nx format                    # Format code
   nx affected --target=test    # Test affected packages
   nx affected --target=lint    # Lint affected packages
   nx affected --target=build   # Build affected packages
   ```

3. **Use interactive commit tool:**

   ```bash
   npm run commit
   ```

### PR Requirements

- ✅ At least 1 approving review from a code owner
- ✅ All status checks passing (CI/CD pipeline)
- ✅ No merge conflicts with the base branch
- ✅ Squash merge only (enforced by repository settings)

### PR Description Template

```markdown
## Description

Brief description of what this PR does

## Type of Change

- [ ] Bug fix (fix)
- [ ] New feature (feat)
- [ ] Breaking change (feat! or fix!)
- [ ] Documentation update (docs)
- [ ] Other (chore, refactor, etc.)

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated (if applicable)
- [ ] All tests passing locally

## Checklist

- [ ] Code formatted (`nx format`)
- [ ] Tests passing (`nx affected --target=test`)
- [ ] Builds passing (`nx affected --target=build`)
- [ ] Used conventional commits
- [ ] Documentation updated (if needed)
```

### Requesting Preview Releases

If you need to test your changes before merging:

1. Create your PR
2. Comment: "Can a maintainer add the preview label for testing?"
3. Wait for maintainer to add `trigger: preview` label
4. Follow instructions in automated comment to install preview packages

## Helpful Commands Reference

### Analysis & Debugging

```bash
# Visualize dependency graph
nx graph

# Show what's affected by changes
nx affected --graph

# List all projects
nx show projects

# See project details
nx show project auth-js --web

# Clear Nx cache
nx reset
```

### Development Workflow

```bash
# 1. Create feature branch
git checkout -b feat/your-feature

# 2. Make changes in packages/core/[library]/

# 3. Test continuously
nx test [library] --watch

# 4. Format before committing
nx format

# 5. Commit with tool
npm run commit

# 6. Before pushing
nx affected --target=test
nx affected --target=build
nx format:check

# 7. Push and create PR
git push origin feat/your-feature
```

### Troubleshooting

```bash
# Clear cache and rebuild
nx reset
nx run-many --target=build --all

# Clean install
rm -rf node_modules
npm install

# Check for errors
nx run-many --target=lint --all

# Run specific test file
nx test auth-js --testFile=GoTrueClient.test.ts
```

## Additional Resources

- **[README.md](README.md)** - Repository overview and quick start
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Complete contribution guide
- **[TESTING.md](docs/TESTING.md)** - Comprehensive testing documentation
- **[RELEASE.md](docs/RELEASE.md)** - Release workflows and automation
- **[MIGRATION.md](docs/MIGRATION.md)** - Migration context and history
- **[SECURITY.md](docs/SECURITY.md)** - Security policy and reporting
- **[Supabase Documentation](https://supabase.com/docs)** - Official Supabase docs
- **[Nx Documentation](https://nx.dev)** - Nx monorepo documentation
- **[Conventional Commits](https://www.conventionalcommits.org/)** - Commit format specification

### Pitfall 5: Incomplete Cross-Library Testing

❌ Wrong: Only testing in source library
✅ Correct: Test in source library AND integration tests in supabase-js

## Release Process

### Hybrid Release Flow

**Canary Releases (Automated)**:

```bash
# Triggered automatically on every commit to master
git commit -m "fix(auth): resolve token issue"
# → Automatic CI: nx release --tag=canary --yes
# → Published: 2.80.1-canary.0 to 'canary' dist-tag
```

**Stable Releases (Manual)**:

```bash
# 1. Validate canary version
nx affected --target=test

# 2. Preview stable promotion
nx release --dry-run

# 3. Promote canary to stable
nx release --tag=latest --yes

# Alternative: Promote specific canary
nx release --specifier=2.80.1 --tag=latest --yes
```

### What Happens During Canary Release

1. CI detects conventional commits
2. Determines version bump (patch/minor/major)
3. Generates prerelease version (e.g., 2.80.1-canary.0)
4. Updates all package.json files
5. Replaces `*` with actual versions
6. Publishes all packages to npm with `canary` dist-tag
7. Triggers dogfooding workflows (when configured)

### What Happens During Stable Release

1. Promotes validated canary to `latest` dist-tag
2. Generates curated per-package changelogs
3. Creates GitHub release with notes
4. All packages get identical stable version

### Nx Release Configuration

The workspace is configured for hybrid releases in `nx.json`:

```json
{
  "release": {
    "projectsRelationship": "fixed",
    "version": {
      "conventionalCommits": true
    },
    "changelog": {
      "projectChangelogs": true,
      "workspaceChangelog": true
    }
  }
}
```

### Release Command Reference

```bash
# Canary releases (automated in CI)
nx release --tag=canary --yes                    # Publish to 'canary' dist-tag
nx release --specifier=prerelease --tag=canary   # Force prerelease bump

# Stable releases (manual promotion)
nx release --tag=latest --yes                  # Promote to 'latest' dist-tag
nx release --specifier=2.80.1 --tag=latest     # Promote specific version

# Preview and debugging
nx release --dry-run                           # Preview changes
nx release --dry-run --verbose                 # Detailed preview
nx release --first-release --dry-run           # First release preview

# Version-specific releases
nx release --specifier=patch --tag=latest      # Force patch bump
nx release --specifier=minor --tag=latest      # Force minor bump
nx release --specifier=major --tag=latest      # Force major bump
```

### Changelog Example

```markdown
## @supabase/realtime-js 2.80.1 (2025-09-16)

- fix: correct reconnection logic (#123)

## @supabase/auth-js 2.80.1 (2025-09-16)

_No user-facing changes in this release._

## @supabase/supabase-js 2.80.1 (2025-09-16)

_No user-facing changes in this release._
```

## When Providing Code Suggestions

1. **Consider Monorepo Impact**: Changes might affect multiple packages - always check dependencies
2. **Use Nx Commands**: Always prefer `nx` over direct `npm` for workspace operations
3. **Suggest Affected Testing**: Use `nx affected --target=test` over full test suite for efficiency
4. **Respect Fixed Versioning**: All packages version together - no independent versioning
5. **Maintain Compatibility**: Never introduce breaking changes without proper process
6. **Check Testing Requirements**: Be aware of Docker requirements for integration tests
7. **Extract Shared Code**: Identify patterns that could be shared across packages
8. **Follow Conventions**: Use existing patterns and structures within each library
9. **Document Changes**: Update JSDoc and READMEs when changing public APIs
10. **Use Conventional Commits**: Always suggest proper commit format with scope

## Quick Decision Tree

**Q: Where does this code belong?**

- Authentication logic → auth-js
- Database queries → postgrest-js
- Real-time subscriptions → realtime-js
- File operations → storage-js
- Edge function calls → functions-js
- Integration of above → supabase-js
- Shared utilities → packages/shared/ (create if needed)

**Q: How to test this change?**

1. Unit test in source library
2. Integration test in supabase-js if affects it
3. Run `nx affected --target=test`
4. Check if Docker needed (auth-js, storage-js)

**Q: How will this release?**

- All packages version together in fixed mode
- Your commit triggers automatic canary release for ALL packages
- Weekly promotion of validated canary to stable
- Unchanged packages show "No user-facing changes"
- Single npm install updates entire SDK suite

Remember: This monorepo optimizes for developer experience and maintenance efficiency while ensuring zero breaking changes for the millions of developers using Supabase SDKs.
