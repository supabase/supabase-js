# Release Workflows

**TL;DR:** Two branches — `develop` (default, v3 features, publishes `@next`) and `master` (v2 fixes, publishes `@canary` and `@latest`). Fixes on master auto-sync to develop. Features on develop can be cherry-picked to master via the `patchback-master` label. Stable releases are manual from master.

---

## Branch Model

This repo uses a two-branch model to support parallel v2 maintenance and v3 development:

| Branch    | Role                           | Default? | PR target for                     |
| --------- | ------------------------------ | -------- | --------------------------------- |
| `develop` | v3 features, next prereleases  | Yes      | All features (`feat:`, `feat!:`)  |
| `master`  | v2 stable + canary prereleases | No       | Fixes (`fix:`), chores (`chore:`) |

> **Feature workflow:** Non-breaking features (`feat:`) land on `develop` and are patchbacked to `master` as needed for v2 minor releases. Breaking features (`feat!:`) stay on `develop` until v3 ships.

```mermaid
graph LR
  subgraph Branches
    master["master (v2)"]
    develop["develop (v3)"]
  end

  subgraph "npm dist-tags"
    latest["latest (stable)"]
    canary["canary"]
    next["next"]
    beta["beta"]
  end

  master -- "auto on push" --> canary
  master -- "manual workflow_dispatch" --> latest
  develop -- "auto on push" --> next
  feature["feature/*"] -- "manual workflow_dispatch" --> beta
```

### How branches stay in sync

Fixes merged to `master` are automatically merged into `develop` by the `sync-develop.yml` workflow (triggered on every push to `master`). This keeps v3 development up to date with all v2 fixes. The sync is **skipped** when the push comes from a patchback merge (detected by `[patchback]` in the commit message), since that commit already exists on develop.

Features on `develop` that also need to ship as a v2 release can be cherry-picked to `master` using the **patchback** workflow (label a merged PR with `patchback-master`).

```mermaid
graph LR
  master -- "sync-develop.yml<br/>(auto merge)" --> develop
  develop -- "patchback.yml<br/>(cherry-pick PR)" --> master
```

---

## Release Types

All packages share a single version number (fixed versioning) and are released together.

| Type        | Trigger     | Branch      | npm tag  | Version format   | Script              |
| ----------- | ----------- | ----------- | -------- | ---------------- | ------------------- |
| **Next**    | Auto (push) | `develop`   | `next`   | `3.0.0-next.X`   | `release-canary.ts` |
| **Canary**  | Auto (push) | `master`    | `canary` | `2.x.x-canary.X` | `release-canary.ts` |
| **Stable**  | Manual      | `master`    | `latest` | `2.x.x`          | `release-stable.ts` |
| **Beta**    | Manual      | `feature/*` | `beta`   | `x.x.x-beta.X`   | `release-beta.ts`   |
| **Preview** | Auto (PR)   | any         | -        | -                | pkg.pr.new          |

---

## Automatic Releases

### Next Prereleases (from `develop`)

**Workflow:** `publish.yml`
**Trigger:** Every push to `develop` (after CI passes)

```mermaid
flowchart TD
  A[PR merged to develop] --> B[CI runs]
  B --> C{CI passes?}
  C -- No --> D[Slack notification]
  C -- Yes --> E["Read .next-base-version (3.0.0)"]
  E --> F["Find highest v3.0.0-next.X tag"]
  F --> G["Publish 3.0.0-next.(X+1)"]
  G --> H[npm: @supabase/supabase-js@next]
  G --> I[JSR + gotrue-js legacy]
```

The base version for next prereleases is stored in **`.next-base-version`** at the repo root (currently `3.0.0`). The script always publishes — it does not check for conventional commits since every push to develop should produce a new prerelease.

```bash
# Install next prerelease
npm install @supabase/supabase-js@next
```

### Canary Prereleases (from `master`)

**Workflow:** `publish.yml`
**Trigger:** Every push to `master` (after CI passes)

```mermaid
flowchart TD
  A[PR merged to master] --> B[CI runs]
  B --> C{CI passes?}
  C -- No --> D[Slack notification]
  C -- Yes --> E{Conventional commits<br/>since last stable tag?}
  E -- No --> F[Skip release]
  E -- Yes --> G[Parse commit types]
  G --> H["Determine bump: patch/minor/major"]
  H --> I["Find highest canary tag for that base"]
  I --> J["Publish 2.x.x-canary.(X+1)"]
  J --> K[npm: @supabase/supabase-js@canary]
  J --> L[JSR + gotrue-js legacy]
```

Canary versions respect conventional commits:

| Commit type                  | Canary version             |
| ---------------------------- | -------------------------- |
| `fix:`                       | `2.104.1-canary.0` (patch) |
| `feat:`                      | `2.105.0-canary.0` (minor) |
| `feat!:` / `BREAKING CHANGE` | `3.0.0-canary.0` (major)   |

Canary releases are **skipped** if no conventional commits are detected since the last stable tag.

```bash
# Install canary
npm install @supabase/supabase-js@canary
```

---

## Manual Releases

### Stable Releases (from `master`)

**Workflow:** `publish.yml` (manual trigger)
**Script:** `scripts/release-stable.ts`
**Permission:** `@supabase/admin` or `@supabase/sdk` team members only

```mermaid
flowchart TD
  A["Maintainer triggers workflow_dispatch<br/>on master with version_specifier"] --> B[Validate team membership]
  B --> C[Validate version specifier]
  C --> D[Bump version for all packages]
  D --> E[Build all packages]
  E --> F[Generate changelogs since last stable tag]
  F --> G["Publish to npm with 'latest' tag"]
  G --> H[Create release branch + PR with changelogs]
  H --> I[Auto-merge PR]
  I --> J[Generate TypeDoc documentation]
  J --> K["Trigger supabase/supabase docs update"]
  J --> L[Trigger dogfood workflow]
  I --> M[Slack notification]
```

#### Version specifiers

**Keywords:** `patch`, `minor`, `major`, `prepatch`, `preminor`, `premajor`, `prerelease`

**Explicit:** `v2.105.0` or `2.105.0`

#### How to run

1. Go to **Actions** > **Publish releases** > **Run workflow**
2. Select `master` branch
3. Enter version specifier (e.g., `patch`)
4. Leave beta_version empty
5. Click **Run workflow**

### Beta Releases (from `feature/*` branches)

**Workflow:** `publish.yml` (manual trigger)
**Script:** `scripts/release-beta.ts`
**Permission:** `@supabase/admin` or `@supabase/sdk` team members only

Use beta releases to test features on a branch before merging. Each beta changelog is cumulative from the last stable tag.

#### How to run

1. Go to **Actions** > **Publish releases** > **Run workflow**
2. Select your **feature branch**
3. Enter beta version (e.g., `2.105.0-beta.0`)
4. Leave version_specifier empty
5. Click **Run workflow**

```bash
# Install beta
npm install @supabase/supabase-js@beta
```

### Preview Releases (PR-based)

**Workflow:** `preview-release.yml`
**Trigger:** Every PR that touches package code (automatic, no label needed)

1. PR is opened or updated with changes to `packages/core/**`
2. Workflow builds all packages and publishes via [pkg.pr.new](https://pkg.pr.new)
3. Integration tests run against the preview packages

```bash
npm install https://pkg.pr.new/@supabase/supabase-js@[commit-hash]
```

---

## Branch Sync Workflows

### sync-develop.yml (master -> develop)

Keeps `develop` up to date with v2 fixes merged to `master`.

**Trigger:** Every push to `master` + manual `workflow_dispatch`
**Skipped when:** The commit message contains `[patchback]` (the commit already exists on develop)

```mermaid
flowchart TD
  A[Push to master] --> B{"Commit message<br/>contains [patchback]?"}
  B -- Yes --> C[Skip — already on develop]
  B -- No --> D[Checkout develop]
  D --> E{"master already<br/>ancestor of develop?"}
  E -- Yes --> F[Already up to date]
  E -- No --> G["git merge origin/master"]
  G --> H{Conflict?}
  H -- No --> I[Push to develop]
  H -- Yes --> J["Slack #team-sdk<br/>with compare link"]
  J --> K[Human resolves manually]
```

The workflow uses a GitHub App token to push directly to the protected `develop` branch.

### patchback.yml (develop -> master)

Cherry-picks merged PRs from `develop` to `master` when labeled `patchback-master`.

**Trigger:** PR on `develop` closed (merged) or labeled, with `patchback-master` label

```mermaid
flowchart TD
  A["Merged PR on develop<br/>labeled patchback-master"] --> B[Checkout master]
  B --> C["Cherry-pick merge commit"]
  C --> D{Conflict?}
  D -- No --> E["Push patchback/PR-NUMBER branch"]
  E --> F["Open PR to master:<br/>[patchback] Original Title"]
  F --> G[Request review from original author]
  G --> H[Human reviews + merges]
  H --> I["Triggers canary (sync-develop skipped)"]
  D -- Yes --> J["Slack #team-sdk<br/>with conflict details"]
  J --> K[Human resolves manually]
```

---

## Day-to-Day Scenarios

### v2 bug fix

```mermaid
flowchart LR
  A["fix PR -> master"] --> B["canary 2.x.x-canary.X"]
  A --> C["sync-develop merges to develop"]
  C --> D["next 3.0.0-next.X"]
  B --> E["release-stable --specifier=patch"]
  E --> F["stable 2.x.x with latest tag"]
```

1. Open fix PR targeting `master`
2. Review + merge
3. Canary auto-publishes from master
4. sync-develop brings fix into develop (next prerelease auto-publishes)
5. When ready: trigger stable release with `patch`

### v3 feature

```mermaid
flowchart LR
  A["feat PR -> develop"] --> B["next 3.0.0-next.X"]
```

1. Open feature PR targeting `develop` (default)
2. Review + merge
3. Next prerelease auto-publishes for dogfooding
4. No effect on master or v2 releases

### v3 feature that also ships as v2 minor

```mermaid
flowchart LR
  A["feat PR -> develop"] --> B["next 3.0.0-next.X"]
  A -- "add patchback-master label" --> C["patchback PR -> master"]
  C --> D["canary 2.x.x-canary.X"]
  D --> E["release-stable --specifier=minor"]
  E --> F["stable 2.x.x with latest tag"]
```

1. Feature PR merged to `develop` (next prerelease publishes)
2. Add `patchback-master` label to the merged PR
3. Patchback workflow opens cherry-pick PR to `master`
4. Review + merge patchback PR
5. Canary auto-publishes from master (sync-develop is skipped — commit already on develop)
6. Trigger stable release with `minor`

### Emergency v2 fix

1. Open fix PR directly to `master`
2. Merge (canary auto-publishes)
3. Immediately trigger stable release with `patch`
4. sync-develop brings fix into develop automatically

### v3 ships

1. Open PR `develop` -> `master` (merge commit, not squash)
2. Review + merge
3. Trigger stable release with `major` -> publishes `3.0.0` with `latest`
4. Update `.next-base-version` for whatever comes next

---

## Configuration

- **`.next-base-version`** — contains `3.0.0`, read by `publish.yml` for next prereleases from `develop`
- **`scripts/release-canary.ts`** — handles both canary and next prereleases (optional `--base-version`, `--preid`, `--tag` flags)
- **`scripts/release-stable.ts`** — stable releases, creates changelog PR
- **`scripts/release-beta.ts`** — beta releases from feature branches

---

## Permissions & Security

- Automated releases (canary, next, sync) use a **GitHub App token** — the app must be a **bypass actor** in branch protection for `develop` and `master`
- Manual releases (stable, beta) are restricted to **`@supabase/admin`** or **`@supabase/sdk`** team members
- npm publishing uses **OIDC trusted publishing** (provenance)
- Slack notifications go to **`#team-sdk`** on failures

---

## Best Practices

### For contributors

1. **Target the right branch**: features -> `develop`, fixes/chores -> `master`
2. **Use conventional commits** with scope: `fix(auth):`, `feat(realtime):`, `chore(repo):`
3. **Preview releases** are automatic on every PR that touches package code

### For maintainers

1. **v2 patch release**: merge fix to master, verify canary, trigger stable with `patch`
2. **v2 minor release**: patchback features from develop to master, trigger stable with `minor`
3. **Patchback**: add `patchback-master` label to any merged develop PR that should also ship in v2
4. **Monitor sync-develop**: if Slack reports a conflict, resolve it promptly to keep develop current
5. **Beta workflow**: use feature branches + beta releases for experimental work that isn't ready for develop yet

### For emergency releases

1. Open fix PR directly to `master` (bypass develop)
2. Merge (canary auto-publishes for immediate testing)
3. Trigger stable release with `patch`
4. sync-develop brings the fix to develop automatically
