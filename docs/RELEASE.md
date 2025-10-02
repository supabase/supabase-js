# Release Workflows

- [.github/workflows/main-ci-release.yml](.github/workflows/main-ci-release.yml) - Main CI & automated canary releases
- [.github/workflows/release-stable.yml](.github/workflows/release-stable.yml) - Manual stable releases
- [.github/workflows/preview-release.yml](.github/workflows/preview-release.yml) - PR preview releases

## Overview

This monorepo uses a fixed release model where all packages share a single version number and are released together. There are three types of releases:

1. **Canary Releases** - Automated pre-releases on every commit to master
2. **Stable Releases** - Manual releases for production use
3. **Preview Releases** - PR-specific releases for testing changes

## Workflows

### 🤖 Canary Releases (Automated)

**File:** `main-ci-release.yml`  
**Trigger:** Every push to `master` branch  
**Purpose:** Immediate feedback with pre-release versions

#### What it does

1. **CI Pipeline**: Runs all CI checks
2. **Version Bump**: Creates a new pre-release version using conventional commits

3. **NPM Publish**: Publishes all packages to npm with `canary` dist-tag
4. **GitHub Release**: Creates a pre-release tag on GitHub with changelog

#### Example flow

- Make a change

```bash
# Commit with conventional format
git commit -m "fix(auth): resolve token refresh issue"
```

- Open PR and get it merged to `master`

- Then:
  → CI runs and passes
  → Version bumped to e.g., 2.80.1-canary.0
  → Published to npm with 'canary' dist-tag
  → GitHub pre-release tag created
  → All packages versioned identically

#### Install canary versions

```bash
npm install @supabase/supabase-js@canary
# or install specific packages
npm install @supabase/auth-js@canary
npm install @supabase/storage-js@canary
```

### 👨‍💻 Stable Releases (Manual)

**File:** `release-stable.yml`  
**Trigger:** Manual workflow dispatch (repository owners only)  
**Purpose:** Production-ready releases for end users

#### How it works

1. **Version Specification**: Repository owner provides a version specifier
2. **Version Bump**: Nx applies the version change to all packages
3. **Changelog Update**: Generates changelogs from conventional commits
4. **NPM Publish**: Publishes all packages with `latest` dist-tag
5. **PR Creation**: Automatically creates a PR with changelog updates

#### Version Specifiers (for repo owners)

You can specify the version in two ways:

##### Semantic Version Keywords

- `patch` - Bump patch version (1.2.3 → 1.2.4)
- `minor` - Bump minor version (1.2.3 → 1.3.0)
- `major` - Bump major version (1.2.3 → 2.0.0)
- `prepatch` - Create patch pre-release (1.2.3 → 1.2.4-0)
- `preminor` - Create minor pre-release (1.2.3 → 1.3.0-0)
- `premajor` - Create major pre-release (1.2.3 → 2.0.0-0)
- `prerelease` - Bump pre-release version (1.2.3-0 → 1.2.3-1)

##### Explicit Version

- `v2.3.4` or `2.3.4` - Set exact version number

### 🔄 Preview Releases (PR-based)

**File:** `preview-release.yml`  
**Trigger:** PR with `trigger: preview` label  
**Purpose:** Test PR changes before merging

#### How it works

1. **Label Trigger**: Contributors request preview by asking maintainers to add label
2. **Build**: Builds all affected packages
3. **Publish**: Uses [pkg.pr.new](https://pkg.pr.new) to create preview packages
4. **Comment**: Adds installation instructions to PR

#### Example flow

```bash
# 1. Contributor creates PR with changes
# 2. Requests preview: "Can you add the preview label?"
# 3. Maintainer adds 'trigger: preview' label
# 4. Workflow publishes preview packages
# 5. Install with:
npm install https://pkg.pr.new/@supabase/supabase-js@[pr-number]
```

## Usage Instructions

### Running Canary Release

Canary releases are **fully automated**. Simply:

1. Make changes in your feature branch
2. Use conventional commits with type and scope (e.g., `fix(auth):`, `feat(realtime):`, `chore(repo):`)
3. Create and merge PR to `master` branch
4. Workflow automatically:
   - Runs CI checks
   - Creates pre-release version
   - Publishes to npm with `canary` tag
   - Creates GitHub pre-release

### Running Stable Release (repository owners only)

1. **Navigate to Actions tab** in GitHub repository
2. **Select "Release Stable"** workflow
3. **Click "Run workflow"**
4. **Enter version specifier:**
   - For patch release: `patch`
   - For minor release: `minor`
   - For major release: `major`
   - For specific version: `v2.81.0` or `2.81.0`
5. **Click "Run workflow"**
6. **Workflow automatically:**
   - Bumps version for all packages
   - Generates changelogs
   - Publishes to npm with `latest` tag
   - Creates release branch and PR
   - Enables auto-merge on PR

### Requesting Preview Release (contributors)

1. **Create your PR** with changes
2. **Request preview** in PR comment: "Can a maintainer add the preview label for testing?"
3. **Wait for label** - Maintainer adds `trigger: preview` label
4. **Install preview** - Follow instructions in automated PR comment

## Workflow Features

### 📦 Fixed Versioning

- All packages share identical version numbers
- Internal dependencies automatically updated using workspace protocol (`*`)
- Version synchronization handled by Nx
- Single source of truth for versioning

### 📝 Automatic Changelogs

- Generated from conventional commits
- Per-package CHANGELOG.md files
- Unchanged packages show "No user-facing changes in this release"
- GitHub releases created automatically

### 🔐 Security & Permissions

- Canary releases use GitHub App token for automation
- Stable releases restricted to repository owners
- NPM publishing uses secure tokens
- All releases signed and traceable

### Nx Release Configuration

The workflows rely on `nx.json` release configuration:

### Release Scripts

- **`scripts/release-canary.ts`** - Handles canary releases with `canary` preid
- **`scripts/release-stable.ts`** - Handles stable releases with version specifier input

## Best Practices

### For Contributors

1. **Use conventional commits** with scope and type for automatic versioning
   - `fix(auth):` for bug fixes (patch release)
   - `feat(realtime):` for new features (minor release)
   - `feat(repo)!:` or `BREAKING CHANGE:` for breaking changes (major release)
2. **Request preview releases** for complex PRs
3. **Monitor canary releases** to verify your changes

### For Repository Owners

1. **Release cadence**:
   - Canary: Automatic on every `master` commit
   - Stable: Weekly or as needed
   - Major: Coordinate with team and users
2. **Version strategy**:
   - Use `patch` for bug fixes
   - Use `minor` for new features
   - Use `major` for breaking changes
3. **Monitor package health** after releases
4. **Review PR auto-merge** from release workflow

### For Emergency Releases

1. **Fix in `master` first** - Apply fix and let canary release
2. **Test canary** - Verify fix works in canary version
3. **Release stable** - Use stable workflow with `patch`
4. **Document incident** - Update changelog with details
