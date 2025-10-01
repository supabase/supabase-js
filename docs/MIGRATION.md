# Migration Guide: From Separate Repos to the Supabase JS Monorepo

> 🚀 **Welcome to the Supabase JS monorepo!** This guide will help you transition from the old separate repository structure to our new Nx monorepo.

## 📋 Table of Contents

- [Why We Migrated](#why-we-migrated)
- [What Changed](#what-changed)
- [Repository Mapping](#repository-mapping)
- [Migration Steps](#migration-steps)
- [Common Scenarios](#common-scenarios)
- [Command Reference](#command-reference)
- [FAQ](#faq)
- [Getting Help](#getting-help)

## Why We Migrated

The `supabase-js` repository has been converted into a Nx monorepo and the other js client libraries have been absorbed into it to solve several critical challenges:

### Problems with Separate Repos

- **Version Drift**: Libraries could have incompatible versions in production
- **Manual Dependency Updates**: Updating internal dependencies required coordinated PRs across repos
- **Duplicated CI/CD**: Each repo maintained its own pipeline configuration
- **Complex Testing**: Integration testing across libraries was difficult
- **Inconsistent Tooling**: Different repos used different build and test setups
- **Release Coordination**: Coordinating releases across dependent packages was error-prone

### Benefits of the Monorepo

- **Fixed Versioning**: All packages share a single version number
- **Automatic Dependency Updates**: Internal dependencies update automatically
- **Unified CI/CD**: Single pipeline with intelligent affected detection
- **Simplified Testing**: Easy integration testing across all libraries
- **Consistent Tooling**: One build system, one test runner, one format
- **Atomic Changes**: Make coordinated changes across multiple packages in one PR
- **Better DX**: Nx provides powerful caching, affected commands, and dependency visualization

## What Changed

### Repository Structure

**Before:** 6 separate repositories

```tree
github.com/supabase/supabase-js
github.com/supabase/auth-js
github.com/supabase/postgrest-js
github.com/supabase/realtime-js
github.com/supabase/storage-js
github.com/supabase/functions-js
```

**After:** The Supabase JS monorepo (absorbed all client libraries)

```tree
github.com/supabase/supabase-js
├── packages/
│   └── core/
│       ├── supabase-js/
│       ├── auth-js/
│       ├── postgrest-js/
│       ├── realtime-js/
│       ├── storage-js/
│       └── functions-js/
```

### Development Workflow

| Task                     | Old Workflow                     | New Workflow                                  |
| ------------------------ | -------------------------------- | --------------------------------------------- |
| **Clone & Setup**        | Clone each repo individually     | Clone once: `git clone supabase/supabase-js`  |
| **Install Dependencies** | `npm install` in each repo       | Single `npm install` at root                  |
| **Build a Library**      | `npm run build` in specific repo | `npx nx build auth-js`                          |
| **Test a Library**       | `npm test` in specific repo      | `npx nx test postgrest-js`                      |
| **Format Code**          | Various tools per repo           | `npx nx format`                                 |
| **Release**              | Individual releases per repo     | Single coordinated release                      |

### Versioning Strategy

- **Before**: Each package had independent versions (e.g., auth@2.1.0, storage@1.5.3)
- **After**: All packages share the same version (e.g., everything at 2.5.0)
- **Benefit**: No more compatibility matrices or version conflicts

Read more about the release process in [RELEASE.md](./RELEASE.md).

## Repository Mapping

Here's where to find your familiar code in the new structure:

| Old Repository          | New Location                  | Package Name (unchanged!) |
| ----------------------- | ----------------------------- | ------------------------- |
| `supabase/supabase-js`  | `packages/core/supabase-js/`  | `@supabase/supabase-js`   |
| `supabase/auth-js`      | `packages/core/auth-js/`      | `@supabase/auth-js`       |
| `supabase/postgrest-js` | `packages/core/postgrest-js/` | `@supabase/postgrest-js`  |
| `supabase/realtime-js`  | `packages/core/realtime-js/`  | `@supabase/realtime-js`   |
| `supabase/storage-js`   | `packages/core/storage-js/`   | `@supabase/storage-js`    |
| `supabase/functions-js` | `packages/core/functions-js/` | `@supabase/functions-js`  |

### Important Files

Each library maintains its structure, but some files are now centralized:

- **Root `package.json`**: Workspace configuration and shared dev dependencies
- **Root `nx.json`**: Nx workspace configuration
- **Root `.github/`**: Unified CI/CD workflows
- **Library `package.json`**: Still exists for each library with its specific dependencies
- **Library `tsconfig.json`**: Extends from root but maintains library-specific settings

## Migration Steps

### For Contributors with Existing Work

If you have uncommitted changes or an active branch in an old repository, you'll need to manually port your work to the new monorepo:

#### Step 1: Set up the new monorepo

```bash
# Fork github.com/supabase/supabase-js on GitHub, then:
git clone https://github.com/YOUR_USERNAME/supabase-js.git
cd supabase-js
npm install

# Add upstream remote
git remote add upstream https://github.com/supabase/supabase-js.git
git fetch upstream

# Create your feature branch
git checkout -b feature/your-feature-name
```

#### Step 2: Manually port your changes

1. **Open your old repository** in another window/tab
2. **Copy your modified files** to the new structure:
   - Old: `auth-js/src/GoTrueClient.ts`
   - New: `packages/core/auth-js/src/GoTrueClient.ts`
3. **Commit using the interactive tool**:

   ```bash
   npm run commit
   ```

### For Active Pull Requests

We're working with contributors who have open PRs to handle the migration case-by-case. If you have an open PR:

- **Reach out to maintainers** in your existing PR
- We'll help you either merge it quickly or assist with porting to the monorepo

### For Projects Depending on Supabase Libraries

No changes needed for end users! The published npm packages remain the same:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "@supabase/auth-js": "^2.0.0"
  }
}
```

## Common Scenarios

### Scenario 1: "I was working on a bug fix in postgrest-js"

```bash
# make changes to packages/core/postgrest-js/src/PostgrestClient.ts
npm run commit  # Use interactive commit tool
# Select: fix > postgrest > "resolve filter issue"
```

### Scenario 2: "I need to update auth-js and test it with supabase-js"

```bash
# This was complex before - required npm link or multiple PRs
# Now it's simple:

# Make changes to auth-js
edit packages/core/auth-js/src/GoTrueClient.ts

# Test auth-js alone
npx nx test auth-js

# Test with supabase-js integration
npx nx test supabase-js

# Build both to ensure compatibility
npx nx run-many --target=build --projects=auth-js,supabase-js

# Commit both changes atomically
npm run commit
# feat(auth): add new auth feature with supabase-js integration
```

### Scenario 3: "I want to add a feature that touches multiple packages"

```bash
# Create your feature branch
git checkout -b feature/multi-package-update

# Make changes across packages
edit packages/core/auth-js/src/lib/feature.ts
edit packages/core/supabase-js/src/SupabaseClient.ts
edit packages/core/realtime-js/src/RealtimeClient.ts

# Build all affected packages
npx nx affected --target=build

# Commit with appropriate scope
npm run commit
# feat(supabase): add cross-package feature for X functionality
```

### Scenario 4: "I need to run integration tests"

```bash
# Old way: Complex Docker setup per repo

# New way: Integrated Docker management
npx nx test auth-js        # Automatically sets up GoTrue
npx nx test storage-js     # Automatically sets up Storage server

# Run all integration tests
npx nx run-many --target=test:integration --all
```

## Command Reference

### Quick Command Conversion Table

| Purpose              | Old Command (in individual repo) | New Command (in monorepo)              |
| -------------------- | -------------------------------- | -------------------------------------- |
| **Install deps**     | `npm install`                    | `npm install` (at root)                |
| **Build library**    | `npm run build`                  | `npx nx build [library-name]`          |
| **Test library**     | `npm test`                       | `npx nx test [library-name]`           |
| **Test with watch**  | `npm test -- --watch`            | `npx nx test [library-name] --watch`   |
| **Lint**             | `npm run lint`                   | `npx nx lint [library-name]`           |
| **Format code**      | Various per repo                 | `npx nx format`                        |
| **Type check**       | `npm run type-check`             | `npx nx build [library-name]`          |
| **Build all**        | Run in each repo                 | `npx nx run-many --target=build --all` |
| **Test all**         | Run in each repo                 | `npx nx run-many --target=test --all`  |
| **Test affected**    | Not available                    | `npx nx affected --target=test`        |
| **See dependencies** | Manual inspection                | `npx nx graph`                         |

### Library Name Reference

Use these names with Nx commands:

- `auth-js` - Auth library
- `functions-js` - Functions library
- `postgrest-js` - PostgREST library
- `realtime-js` - Realtime library
- `storage-js` - Storage library
- `supabase-js` - Main client library

### Useful New Commands

Commands that weren't available in separate repos:

```bash
# Visualize project dependencies
npx nx graph

# Build only what changed since main
npx nx affected --target=build --base=main

# Test only what changed
npx nx affected --target=test

# Run test/build for a specific project
npx nx test auth-js
npx nx build auth-js

# See what would be affected by your changes
npx nx show projects --affected

# Run multiple targets in parallel
npx nx run-many --target=build,test --all --parallel=3

# Generate documentation
npx nx run-many --target=docs --all
```

## FAQ

### Q: Why fixed versioning instead of independent versions?

**A:** Fixed versioning ensures all Supabase JS libraries are always compatible with each other. Users don't need to worry about compatibility matrices or which version of auth-js works with which version of supabase-js.

### Q: Can I still work on just one library?

**A:** Absolutely! The monorepo structure doesn't mean you have to work on everything. You can focus on a single library:

```bash
npx nx build auth-js --watch
npx nx test auth-js --watch
```

### Q: How do releases work now?

**A:** All packages are released together with the same version number. When we release v2.5.0, all six packages get v2.5.0. This is automated through Nx Release and semantic-release. Read more on [`RELEASE.md`](./RELEASE.md).

### Q: Will old issues and PRs be migrated?

**A:** Open issues are being triaged and migrated as appropriate. For open PRs, we'll work with contributors individually. Check the old repo for a migration notice.

### Q: How do I know which files to edit?

**A:** The structure within each package is the same as before. If you edited `src/GoTrueClient.ts` in the old auth-js repo, you'll now edit `packages/core/auth-js/src/GoTrueClient.ts`.

### Q: Do I need to learn Nx?

**A:** Not really! Basic commands are enough for most contributions. Nx handles the complexity behind the scenes. The main commands you need are `nx build`, `nx test`, and `nx affected`.

### Q: What about my Git history?

**A:** The Git history from all individual repos has been preserved during the migration. You can still see the history of individual files using:

```bash
git log --follow packages/core/auth-js/src/GoTrueClient.ts
```

### Q: Can I still install packages individually?

**A:** Yes! End users still install packages individually from npm:

```bash
npm install @supabase/auth-js
npm install @supabase/supabase-js
```

### Q: What if I find a bug in the migration?

**A:** Please [open an issue](https://github.com/supabase/supabase-js/issues) and tag it with `migration`. We're actively monitoring these during the transition period.

## Getting Help

### Migration Support

- **Migration Issues**: Tag with `migration` label in [GitHub Issues](https://github.com/supabase/supabase-js/issues)
- **Questions**: [GitHub Discussions](https://github.com/supabase/supabase/discussions) with "Monorepo Migration" topic
- **Discord**: [Supabase Discord](https://discord.supabase.com) in #contributing channel

### Resources

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Detailed contribution guidelines
- **[README.md](./README.md)** - Repository overview and quick start

### Important Links

- **Supabase JS Monorepo**: https://github.com/supabase/supabase-js
- **Old Repos** (archived/read-only):
  - https://github.com/supabase/auth-js
  - https://github.com/supabase/postgrest-js
  - https://github.com/supabase/realtime-js
  - https://github.com/supabase/storage-js
  - https://github.com/supabase/functions-js

---

## Welcome to the Monorepo

This migration represents a significant improvement in our development workflow. While change can be challenging, we believe this new structure will make contributing to Supabase JS libraries more enjoyable and productive.

Thank you for your patience during this transition, and thank you for contributing to Supabase! 💚

> **Note**: This document will be updated as we learn from the migration process.
