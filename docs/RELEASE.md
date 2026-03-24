# Release Workflows

- [.github/workflows/publish.yml](.github/workflows/publish.yml) - Canary, beta, and stable releases
- [.github/workflows/preview-release.yml](.github/workflows/preview-release.yml) - PR preview releases
- [.github/workflows/sync-develop.yml](.github/workflows/sync-develop.yml) - Automated master→develop backport
- [docs/BRANCHES.md](./BRANCHES.md) - Branch roles, contributor workflow, v3 path

## Overview

This monorepo uses a `develop`/`master` model. All feature PRs go to `develop`; `master` is always releasable and only receives patches and stable merges. See [BRANCHES.md](./BRANCHES.md) for the full branch strategy.

All packages share a single version number and are released together. There are four types of releases:

1. **Canary Releases** - Automated pre-releases on every conventional commit to `develop`
2. **Beta Releases** - Manual pre-releases from feature branches for testing before merge
3. **Stable Releases** - Manual releases for production use (requires maintainer permission)
4. **Preview Releases** - PR-specific releases for testing changes

## Workflows

### 🤖 Canary Releases (Automated)

**Workflow:** `publish.yml`
**Trigger:** Every push to `develop` branch (after CI passes)
**Script:** `scripts/release-canary.ts`
**Purpose:** Immediate feedback with pre-release versions

#### What it does

1. **Checks for conventional commits** - Only releases if commits warrant a version bump
2. **Version Bump** - Derives the correct `prepatch`/`preminor`/`premajor` specifier from conventional commits (a `feat:` commit produces a minor canary, not a patch canary), then applies it with `canary` preid
3. **Build** - Rebuilds all packages with updated versions
4. **Changelog** - Generates changelogs from conventional commits
5. **NPM Publish** - Publishes all packages to npm with `canary` dist-tag (marked as prerelease)
6. **Legacy Package** - Publishes `@supabase/gotrue-js` as legacy mirror of `auth-js`

#### Version bump logic

Canary versions respect conventional commits:

| Commit type                  | Canary version             |
| ---------------------------- | -------------------------- |
| `fix:`                       | `2.100.1-canary.0` (patch) |
| `feat:`                      | `2.101.0-canary.0` (minor) |
| `feat!:` / `BREAKING CHANGE` | `3.0.0-canary.0` (major)   |

#### Example flow

```bash
# Commit with conventional format
git commit -m "feat(realtime): add broadcast presence"
# Merge PR to master
# → CI runs and passes
# → Version bumped to e.g., 2.101.0-canary.0 (minor, not patch)
# → Published to npm with 'canary' dist-tag
```

#### Install canary versions

```bash
npm install @supabase/supabase-js@canary
# or install specific packages
npm install @supabase/auth-js@canary
npm install @supabase/storage-js@canary
```

**Note:** Canary releases are skipped if no conventional commits are detected that warrant a release.

---

### 🚀 Beta Releases (Manual, from feature branches)

**Workflow:** `publish.yml` (manual trigger)
**Script:** `scripts/release-rc.ts`
**Trigger:** Manual workflow dispatch by maintainers
**Permission:** Members of `@supabase/admin` or `@supabase/sdk` teams only
**Purpose:** Test a specific feature or set of changes before committing to a stable release

#### When to use

Use RC releases when you have a feature that needs testing/dogfooding before it's merged to master and released as stable. Develop on a feature branch, publish RCs from there, and only merge to master when ready for stable.

This keeps master clean and prevents RC tags from polluting the canary/stable changelog.

#### How it works

1. **Checkout your feature branch** in the workflow trigger UI (select branch at the top of the Run Workflow dialog)
2. **Provide an explicit version** like `2.101.0-rc.0`
3. **Version Bump** - Nx applies the exact version to all packages
4. **Build** - Rebuilds all packages
5. **Changelog** - Generated from commits since the last stable tag (not affected by other RC tags)
6. **NPM Publish** - Publishes all packages with `rc` dist-tag
7. **GitHub Pre-release** - Creates a GitHub pre-release automatically

#### Example flow

```bash
# 1. Develop feature on a branch
git checkout -b feat/my-feature

# 2. When ready for RC, trigger workflow from GitHub UI:
#    - Select branch: feat/my-feature
#    - RC version: 2.101.0-rc.0

# 3. Iterate as needed
#    - Fix issues, push to feat/my-feature
#    - Trigger again with: 2.101.0-rc.1

# 4. When stable, merge to master and run stable release with 'minor'
```

#### Install RC versions

```bash
npm install @supabase/supabase-js@rc
# or specific version
npm install @supabase/supabase-js@2.101.0-rc.0
```

#### Running via CLI (locally)

```bash
npm run release-rc -- --version 2.101.0-rc.0
```

---

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
4. **Changelog Update**: Generates changelogs from conventional commits (since last stable tag — RC tags are ignored)
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

---

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

---

## Usage Instructions

### Running Canary Release

Canary releases are **fully automated**. Simply:

1. Make changes in your feature branch
2. Use conventional commits with type and scope (e.g., `fix(auth):`, `feat(realtime):`, `chore(repo):`)
3. Create and merge PR to `develop` branch
4. Workflow automatically:
   - Runs CI checks (`ci-core` and `ci-supabase-js`)
   - Checks for conventional commits that warrant a release
   - Creates pre-release version with correct bump type (minor for `feat:`, patch for `fix:`)
   - Publishes to npm with `canary` tag
   - Creates GitHub changelog entries

### Running RC Release (maintainers only)

Use this when a feature needs testing/dogfooding before it's ready for stable. **Keep the feature on its own branch** — do not merge to master until you're ready for a stable release. This way canary and stable changelogs are never polluted by RC tags.

1. **Navigate to Actions tab** in GitHub repository
2. **Select "Publish releases"** workflow
3. **Click "Run workflow"**
4. **⚠️ Select your feature branch** from the branch dropdown at the top — this is what gets checked out and published
5. **Fill in the `rc_version` field**: e.g. `2.101.0-rc.0`
6. **Leave `version_specifier` empty**
7. **Click "Run workflow"**
8. **Workflow automatically:**
   - Validates you're a member of `@supabase/admin` or `@supabase/sdk`
   - Bumps version for all packages to the specified RC version
   - Generates changelog since last stable tag (unaffected by previous RC tags)
   - Publishes to npm with `rc` tag (never touches `latest`)
   - Creates GitHub pre-release
   - Sends Slack notifications

To iterate, push more commits to your feature branch and re-trigger with the next RC version (`rc.1`, `rc.2`, etc.). When ready for stable, merge the branch to master and run the stable workflow with the appropriate specifier (`minor`, `patch`, etc.).

### Running Stable Release (maintainers only)

1. **Navigate to Actions tab** in GitHub repository
2. **Select "Publish releases"** workflow
3. **Click "Run workflow"**
4. **Enter version specifier** in the version_specifier field:
   - For patch release: `patch`
   - For minor release: `minor`
   - For major release: `major`
   - For specific version: `v2.81.0` or `2.81.0`
5. **Leave rc_version empty**
6. **Click "Run workflow"**
7. **Workflow automatically:**
   - Validates you're a member of `@supabase/admin` or `@supabase/sdk`
   - Bumps version for all packages
   - Generates changelogs since last stable tag (RC tags don't affect this)
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

---

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
- Stable and RC releases generate changelogs from last stable tag (RC tags never pollute the range)

### 🔐 Security & Permissions

- Canary releases use GitHub App token for automation
- Stable and RC releases restricted to `@supabase/admin` or `@supabase/sdk` team members
- NPM publishing uses OIDC trusted publishing
- All releases signed and traceable

### Release Scripts

- **`scripts/utils.ts`** - Shared helpers (`getLastStableTag`, `getArg`)
- **`scripts/release-canary.ts`** - Handles canary releases, derives correct bump type from conventional commits
- **`scripts/release-rc.ts`** - Handles RC releases with explicit version, publishes under `rc` tag, creates GitHub pre-release
- **`scripts/release-stable.ts`** - Handles stable releases with version specifier input, creates release branch and PR

---

## Best Practices

### For Contributors

1. **Use conventional commits** with scope and type for automatic versioning
   - `fix(auth):` for bug fixes (patch canary)
   - `feat(realtime):` for new features (minor canary)
   - `feat(repo)!:` or `BREAKING CHANGE:` for breaking changes (major canary)
2. **Request preview releases** for complex PRs
3. **Monitor canary releases** to verify your changes work as expected

### For Maintainers

1. **Release cadence**:
   - Canary: Automatic on every `master` commit (if conventional commits present)
   - RC: As needed from feature branches before stable
   - Stable: Weekly or as needed based on canary/RC feedback
   - Major: Coordinate with team and users
2. **RC workflow**:
   - Keep feature on a branch until RC is validated
   - Use `rc.0`, `rc.1`, etc. for iterations
   - Merge to master only when ready for stable
3. **Version strategy**:
   - Use `patch` for bug fixes
   - Use `minor` for new features
   - Use `major` for breaking changes
4. **Monitor package health** after releases
5. **Review PR auto-merge** from release workflow (changelog updates)
6. **Verify documentation** updates after stable releases

### For Emergency Releases

1. **Fix in `master` first** - Apply fix and let canary release
2. **Test canary** - Verify fix works in canary version
3. **Release stable** - Use stable workflow with `patch` specifier
4. **Document incident** - Update changelog with details if needed
