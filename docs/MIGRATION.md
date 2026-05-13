# Migration Guide: Transitioning to the Supabase JS Monorepo

> **This repository has been restructured.** If you contributed to `supabase-js`, `auth-js`, `postgrest-js`, or any other Supabase JS library, this guide explains what changed and how to work with the new structure.

> **📦 Note for Package Users:** If you install and use these packages via npm, **nothing changed**. This guide is for contributors who develop and maintain these libraries.

---

## 🔴 Node.js 18 Support Dropped

**Effective Date:** October 31, 2025

### What Changed

Starting with version `2.79.0`, all Supabase JavaScript libraries require **Node.js 20 or later**. The `@supabase/node-fetch` polyfill has been removed, and native fetch support is now required.

### Why?

Node.js 18 reached end-of-life on April 30, 2025, and no longer receives security updates or critical fixes. Node.js 20+ includes native fetch support, eliminating the need for polyfills and reducing bundle size.

### Affected Libraries

- `@supabase/supabase-js`
- `@supabase/auth-js`
- `@supabase/postgrest-js`
- `@supabase/realtime-js`
- `@supabase/storage-js`
- `@supabase/functions-js`

### Migration Guide

**1. Upgrade Node.js** to version 20 or later:

```bash
# Check your current version
node --version

# If < 20.0.0, upgrade Node.js
# Via nvm (recommended):
nvm install 20
nvm use 20

# Or download from https://nodejs.org/
```

**2. Update your package.json** to use the latest version:

```bash
npm install @supabase/supabase-js@latest
# Or for individual packages:
npm install @supabase/auth-js@latest
```

**3. No code changes required** - The APIs remain unchanged. Your existing code will work as-is once you upgrade Node.js.

### Supported Environments

- **Node.js 20+** - Native fetch support
- **Modern browsers** - All modern browsers
- **Deno 2.x** - Native fetch built-in
- **Bun 0.1+** - Native fetch built-in
- **React Native** - With fetch polyfill provided by the framework
- **Expo** - With fetch polyfill provided by the framework

### Troubleshooting

**Error: `fetch is not defined`**

This means you're running Node.js < 20. Solutions:

1. Upgrade to Node.js 20+ (recommended)
2. If you absolutely cannot upgrade, use an older version of the libraries (see below)

**Using Node.js 18 (Not Recommended)**

If you must use Node.js 18, install the last version that supported it:

```bash
npm install @supabase/supabase-js@2.78.0
```

⚠️ **Warning:** Using Node.js 18 is not recommended as it no longer receives security updates.

### Discussion

For more details, see the [deprecation announcement](https://github.com/orgs/supabase/discussions/37217).

---

## 🎯 Who This Guide Is For

**This guide is for contributors**, including:

- Contributors to the old `supabase-js` repository (even supabase-js moved)
- Contributors to separate libraries (`auth-js`, `postgrest-js`, `realtime-js`, `storage-js`, `functions-js`)
- Anyone with open PRs in any of the old repositories
- New contributors who want to understand the architecture

**Not a contributor?** You can skip this guide. Packages are still installed and used the same way.

## ⚠️ What Changed: The Big Picture

### The Repository URL Stayed the Same, But Everything Inside Changed

The repository is still at `github.com/supabase/supabase-js`.

**OLD Structure:**

```tree
github.com/supabase/supabase-js/
├── src/              ← supabase-js code was here
├── test/
├── package.json
└── README.md

github.com/supabase/auth-js/        ← Separate repo
github.com/supabase/postgrest-js/   ← Separate repo
github.com/supabase/realtime-js/    ← Separate repo
github.com/supabase/storage-js/     ← Separate repo
github.com/supabase/functions-js/   ← Separate repo
```

**NEW Structure** (what you'll see now):

```tree
github.com/supabase/supabase-js/    ← Same URL, different structure!
├── packages/
│   └── core/
│       ├── supabase-js/     ← YOUR supabase-js code is HERE now
│       │   ├── src/
│       │   ├── test/
│       │   └── package.json
│       ├── auth-js/         ← auth-js moved here
│       ├── postgrest-js/    ← postgrest-js moved here
│       ├── realtime-js/     ← realtime-js moved here
│       ├── storage-js/      ← storage-js moved here
│       └── functions-js/    ← functions-js moved here
├── nx.json              ← New: Nx workspace config
├── package.json         ← New: Root workspace config
└── README.md
```

### Key Point: EVERYTHING Moved

All six libraries, including `supabase-js` itself, now live under `packages/core/`. All libraries were reorganized into a shared monorepo structure.

### 📦 Important: This Only Affects Contributors

**If you use these packages, nothing changed.**

The monorepo restructure is a **development workflow change** for maintainers and contributors. If you install these packages via npm, your experience is unchanged:

```bash
# Still works the same
npm install @supabase/supabase-js
npm install @supabase/auth-js
npm install @supabase/storage-js
```

What stayed the same:

- Packages are still published independently to npm
- You can still install only what you need
- Your existing code does not need any changes
- Package names remain the same (`@supabase/package-name`)

The only difference is that all packages now share the same version number for compatibility across the ecosystem.

This guide is for contributors who need to understand where code moved and how to develop and test these packages.

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

We converted the `supabase-js` repository into a monorepo and absorbed the other js SDKs to solve several challenges:

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
- **Atomic Changes**: Coordinated changes across multiple packages in one PR
- **Better DX**: Nx provides caching, affected commands, and dependency visualization

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

**After:** The Supabase JS monorepo (absorbed all SDKs)

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

| Task                     | Old Workflow                     | New Workflow                                 |
| ------------------------ | -------------------------------- | -------------------------------------------- |
| **Clone & Setup**        | Clone each repo individually     | Clone once: `git clone supabase/supabase-js` |
| **Install Dependencies** | `npm install` in each repo       | Single `pnpm install` at root                |
| **Build a Library**      | `npm run build` in specific repo | `pnpm nx build auth-js`                      |
| **Test a Library**       | `npm test` in specific repo      | `pnpm nx test postgrest-js`                  |
| **Format Code**          | Various tools per repo           | `pnpm nx format`                             |
| **Release**              | Individual releases per repo     | Single coordinated release                   |

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
corepack enable
pnpm install

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
   pnpm commit
   ```

### For Active Pull Requests

If you have an open PR, reach out to maintainers in your existing PR. We will help you merge it quickly or assist with porting to the monorepo.

### For Projects Depending on Supabase Libraries

**Zero changes for package users.** If you use these packages in your project, everything works as before. The monorepo is an internal development change.

Packages are still published independently.

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "@supabase/auth-js": "^2.0.0",
    "@supabase/storage-js": "^2.0.0"
  }
}
```

Your application code, imports, and usage patterns remain unchanged. The monorepo structure only affects how contributors develop and maintain these libraries.

## Common Scenarios

### Scenario 1: "I was working on a bug fix in postgrest-js"

```bash
# make changes to packages/core/postgrest-js/src/PostgrestClient.ts
pnpm commit  # Use interactive commit tool
# Select: fix > postgrest > "resolve filter issue"
```

### Scenario 2: "I need to update auth-js and test it with supabase-js"

```bash
# Before: required npm link or multiple PRs
# Now: simple

# Make changes to auth-js
edit packages/core/auth-js/src/GoTrueClient.ts

# Test auth-js alone
pnpm nx test auth-js

# Test with supabase-js integration
pnpm nx test supabase-js

# Build both to ensure compatibility
pnpm nx run-many --target=build --projects=auth-js,supabase-js

# Commit both changes atomically
pnpm commit
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
pnpm nx affected --target=build

# Commit with appropriate scope
pnpm commit
# feat(supabase): add cross-package feature for X functionality
```

## Command Reference

### Quick Command Conversion Table

| Purpose              | Old Command (in individual repo) | New Command (in monorepo)               |
| -------------------- | -------------------------------- | --------------------------------------- |
| **Install deps**     | `npm install`                    | `pnpm install` (at root)                |
| **Build library**    | `npm run build`                  | `pnpm nx build [library-name]`          |
| **Test library**     | `npm test`                       | `pnpm nx test [library-name]`           |
| **Test with watch**  | `npm test -- --watch`            | `pnpm nx test [library-name] --watch`   |
| **Lint**             | `npm run lint`                   | `pnpm nx lint [library-name]`           |
| **Format code**      | Various per repo                 | `pnpm nx format`                        |
| **Type check**       | `npm run type-check`             | `pnpm nx build [library-name]`          |
| **Build all**        | Run in each repo                 | `pnpm nx run-many --target=build --all` |
| **Test all**         | Run in each repo                 | `pnpm nx run-many --target=test --all`  |
| **Test affected**    | Not available                    | `pnpm nx affected --target=test`        |
| **See dependencies** | Manual inspection                | `pnpm nx graph`                         |

### Library Name Reference

Use these names with Nx commands:

- `auth-js` - Auth library
- `functions-js` - Functions library
- `postgrest-js` - PostgREST library
- `realtime-js` - Realtime library
- `storage-js` - Storage library
- `supabase-js` - Main SDK

### Useful New Commands

Commands that weren't available in separate repos:

```bash
# Visualize project dependencies
pnpm nx graph

# Build only what changed since master
pnpm nx affected --target=build --base=master

# Test only what changed
pnpm nx affected --target=test

# Run test/build for a specific project
pnpm nx test auth-js
pnpm nx build auth-js

# See what would be affected by your changes
pnpm nx show projects --affected

# Run multiple targets in parallel
pnpm nx run-many --target=build,test --all --parallel=3

# Generate documentation
pnpm nx run-many --target=docs --all
```

## FAQ

### Q: I contributed to the old supabase-js repo. Where did my code go?

**A:** Your code is now in `packages/core/supabase-js/`. The repository URL (`github.com/supabase/supabase-js`) stayed the same, but the internal structure changed. What used to be in the root (`src/`, `test/`, etc.) is now nested under `packages/core/supabase-js/`.

Example:

- **Old:** `src/SupabaseClient.ts`
- **New:** `packages/core/supabase-js/src/SupabaseClient.ts`

This structure accommodates all the libraries in one repository.

### Q: Why does it say supabase-js "absorbed" other libraries if supabase-js also moved?

**A:** What happened:

- The `supabase-js` **repository URL** stayed the same (`github.com/supabase/supabase-js`)
- All libraries (including supabase-js itself) moved into a `packages/core/` structure
- Other library repositories (`auth-js`, `postgrest-js`, etc.) were archived
- The repository now contains all libraries, but supabase-js code also relocated

The **repository** absorbed other libraries. The **supabase-js package code** also moved.

### Q: Why fixed versioning instead of independent versions?

**A:** Fixed versioning ensures all Supabase JS libraries are compatible with each other. You do not need to worry about compatibility matrices or which version of auth-js works with which version of supabase-js.

### Q: Can I still work on just one library?

**A:** Yes. The monorepo structure does not mean you have to work on everything. You can focus on a single library:

```bash
pnpm nx build auth-js --watch
pnpm nx test auth-js --watch
```

### Q: How do releases work now?

**A:** All packages are released together with the same version number. When we release v2.5.0, all six packages get v2.5.0. This is automated through Nx Release and semantic-release. Read more on [`RELEASE.md`](./RELEASE.md).

### Q: Will old issues and PRs be migrated?

**A:** Open issues are being triaged and migrated as appropriate. For open PRs, we will work with contributors individually. Check the old repo for a migration notice.

### Q: How do I know which files to edit?

**A:** The structure within each package is the same as before. Examples:

- **Old auth-js repo:** `src/GoTrueClient.ts` → **New:** `packages/core/auth-js/src/GoTrueClient.ts`
- **Old supabase-js repo:** `src/SupabaseClient.ts` → **New:** `packages/core/supabase-js/src/SupabaseClient.ts`

The internal structure of each library is unchanged. Only the top-level location changed.

### Q: Do I need to learn Nx?

**A:** No. Basic commands are enough for most contributions. Nx handles the complexity behind the scenes. The main commands you need are `nx build`, `nx test`, and `nx affected`.

### Q: What about my Git history?

**A:** The Git history from all individual repos has been preserved during the migration. You can still see the history of individual files:

```bash
git log --follow packages/core/auth-js/src/GoTrueClient.ts
```

### Q: Can I still install packages individually?

**A:** Yes. **Nothing changed for package users.** Each package is still published independently to npm. The monorepo structure is only for contributor development.

You can install any package individually:

```bash
npm install @supabase/auth-js
npm install @supabase/supabase-js
npm install @supabase/storage-js
```

The monorepo is an internal development tool. It makes it easier for contributors to work across packages. It does not affect package distribution or how you use them.

### Q: What if I find a bug in the migration?

**A:** [Open an issue](https://github.com/supabase/supabase-js/issues/new/choose) and add `[migration]` in the title. We are actively monitoring these during the transition period.

## Getting Help

### Migration Support

- **Migration Issues**: Create a [new GitHub issue](https://github.com/supabase/supabase-js/issues/new/choose) and add `[migration]` in the title
- **Questions**: Check out the [GitHub Discussion](https://github.com/orgs/supabase/discussions/39197) on the monorepo transition
- **Discord**: [Supabase Discord](https://discord.supabase.com) in #contributing channel

### Resources

- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Detailed contribution guidelines
- **[README.md](../README.md)** - Repository overview and quick start

### Important Links

- **Supabase JS Monorepo**: <https://github.com/supabase/supabase-js>
- **Old Repos** (archived/read-only):
  - <https://github.com/supabase/auth-js>
  - <https://github.com/supabase/postgrest-js>
  - <https://github.com/supabase/realtime-js>
  - <https://github.com/supabase/storage-js>
  - <https://github.com/supabase/functions-js>

---

## Welcome to the Monorepo

Thank you for your patience during this transition, and thank you for contributing to Supabase! 💚

> **Note**: We will update this document as we learn from the migration process.
