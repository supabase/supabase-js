# Release Workflows

- [.github/workflows/publish.yml](.github/workflows/publish.yml) - Canary and stable releases
- [.github/workflows/preview-release.yml](.github/workflows/preview-release.yml) - PR preview releases

## Overview

This monorepo uses a fixed release model where all packages share a single version number and are released together. There are three types of releases:

1. **Canary Releases** - Automated pre-releases on every conventional commit to `master`
2. **Stable Releases** - Manual releases for production use (requires maintainer permission)
3. **Preview Releases** - PR-specific releases for testing changes

## Workflows

### 🤖 Canary Releases (Automated)

**Workflow:** `publish.yml`  
**Trigger:** Every push to `master` branch (after CI passes)  
**Script:** `scripts/release-canary.ts`  
**Purpose:** Immediate feedback with pre-release versions

#### What it does

1. **Checks for conventional commits** - Only releases if commits warrant a version bump
2. **Version Bump** - Creates a new pre-release version using `prerelease` specifier with `canary` preid
3. **Build** - Rebuilds all packages with updated versions
4. **Changelog** - Generates changelogs from conventional commits
5. **NPM Publish** - Publishes all packages to npm with `canary` dist-tag (marked as prerelease)
6. **Legacy Package** - Publishes `@supabase/gotrue-js` as legacy mirror of `auth-js`

#### Example flow

```bash
# Commit with conventional format
git commit -m "fix(auth): resolve token refresh issue"
# Merge PR to master
# → CI runs and passes
# → Version bumped to e.g., 2.80.1-canary.0
# → Published to npm with 'canary' dist-tag
# → All packages versioned identically
```

#### Install canary versions

```bash
npm install @supabase/supabase-js@canary
# or install specific packages
npm install @supabase/auth-js@canary
npm install @supabase/storage-js@canary
```

**Note:** Canary releases are skipped if no conventional commits are detected that warrant a release.

### 👨‍💻 Stable Releases (Manual)

**Workflow:** `publish.yml` (manual trigger)  
**Script:** `scripts/release-stable.ts`  
**Trigger:** Manual workflow dispatch by maintainers  
**Permission:** Members of `@supabase/admin` or `@supabase/sdk` teams only  
**Purpose:** Production-ready releases for end users

#### How it works

1. **Version Specification**: Maintainer provides a version specifier via workflow input
2. **Version Bump**: Nx applies the version change to all packages
3. **Build**: Rebuilds all packages with updated versions
4. **Changelog Update**: Generates changelogs from conventional commits (since last stable tag)
5. **NPM Publish**: Publishes all packages with `latest` dist-tag
6. **Legacy Package**: Publishes `@supabase/gotrue-js` as legacy mirror
7. **Release Branch**: Creates a release branch with changelog updates
8. **PR Creation**: Automatically creates and auto-merges a PR with changelog updates
9. **Documentation**: Triggers documentation update workflow

#### Version Specifiers

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

**Workflow:** `preview-release.yml`  
**Trigger:** PR with `trigger: preview` label  
**Purpose:** Test PR changes before merging

#### How it works

1. **Label Trigger**: Contributors request preview by asking maintainers to add `trigger: preview` label
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
   - Runs CI checks (`ci-core` and `ci-supabase-js`)
   - Checks for conventional commits that warrant a release
   - Creates pre-release version (skips if no commits warrant release)
   - Publishes to npm with `canary` tag
   - Creates GitHub changelog entries

### Running Stable Release (maintainers only)

1. **Navigate to Actions tab** in GitHub repository
2. **Select "Publish releases"** workflow
3. **Click "Run workflow"**
4. **Enter version specifier:**
   - For patch release: `patch`
   - For minor release: `minor`
   - For major release: `major`
   - For specific version: `v2.81.0` or `2.81.0`
5. **Click "Run workflow"**
6. **Workflow automatically:**
   - Validates you're a member of `@supabase/admin` or `@supabase/sdk`
   - Bumps version for all packages
   - Generates changelogs since last stable tag
   - Publishes to npm with `latest` tag
   - Creates release branch and PR with changelog updates
   - Enables auto-merge on PR
   - Triggers documentation update workflow
   - Sends Slack notifications

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
- Stable releases generate changelogs from last stable tag

### 🔐 Security & Permissions

- Canary releases use GitHub App token for automation
- Stable releases restricted to `@supabase/admin` or `@supabase/sdk` team members
- NPM publishing uses OIDC trusted publishing
- All releases signed and traceable

### Release Scripts

- **`scripts/release-canary.ts`** - Handles canary releases with `canary` preid, skips if no conventional commits
- **`scripts/release-stable.ts`** - Handles stable releases with version specifier input, creates release branch and PR

## Best Practices

### For Contributors

1. **Use conventional commits** with scope and type for automatic versioning
   - `fix(auth):` for bug fixes (patch release)
   - `feat(realtime):` for new features (minor release)
   - `feat(repo)!:` or `BREAKING CHANGE:` for breaking changes (major release)
2. **Request preview releases** for complex PRs
3. **Monitor canary releases** to verify your changes work as expected

### For Maintainers

1. **Release cadence**:
   - Canary: Automatic on every `master` commit (if conventional commits present)
   - Stable: Weekly or as needed based on canary feedback
   - Major: Coordinate with team and users
2. **Version strategy**:
   - Use `patch` for bug fixes
   - Use `minor` for new features
   - Use `major` for breaking changes
3. **Monitor package health** after releases
4. **Review PR auto-merge** from release workflow (changelog updates)
5. **Verify documentation** updates after stable releases

### For Emergency Releases

1. **Fix in `master` first** - Apply fix and let canary release
2. **Test canary** - Verify fix works in canary version
3. **Release stable** - Use stable workflow with `patch` specifier
4. **Document incident** - Update changelog with details if needed
