# Branch Strategy

## Overview

This repo uses a `develop`/`master` model that keeps `master` always releasable, allowing patches to ship immediately without cherry-pick gymnastics.

```
feature/*  →  develop  →  (when ready)  →  master
                ↑                              |
               beta                      auto-backport
             releases                    (hourly sync)
```

---

## Branch Roles

| Branch | Purpose | Who merges here | npm tag |
|--------|---------|-----------------|---------|
| `develop` | All feature/fix PRs, staging baseline | Everyone (via PR) | `canary` |
| `master` | Production-ready only — patches & stable releases | Maintainers only (hotfix PRs or merge from develop) | `latest` |
| `feature/*` | In-flight feature work, beta testing before merge | Author | `beta` |
| `release/2.x` _(future)_ | 2.x maintenance after v3 split | Maintainers | `latest` |

---

## Day-to-day Flow

### Normal feature/fix development

```
1. Branch off develop:   git checkout -b feat/my-feature develop
2. Open PR targeting:    develop
3. Merge to develop  →   canary auto-publishes
4. When ready for stable: maintainer runs stable release workflow_dispatch
```

### Hotfix (urgent patch to production)

```
1. Branch off master:   git checkout -b fix/urgent-fix master
2. Open PR targeting:   master
3. Merge to master   →  run stable patch release (workflow_dispatch)
4. Auto-backport     →  sync-develop workflow merges master → develop within the hour
```

No cherry-pick needed. The sync workflow handles it automatically.

### Beta / pre-merge testing

```
1. Keep feature on its branch
2. Trigger "Publish releases" workflow → select your branch → fill in beta version (e.g. 2.101.0-beta.0)
3. Iterate: beta.1, beta.2 as needed
4. Merge to develop when validated
```

---

## Automated Sync: master → develop

`.github/workflows/sync-develop.yml` runs on every push to `master` and hourly. It merges master into develop automatically. If there's a merge conflict, it fires a Slack notification to `#client-libs` for manual resolution — no silent failures.

---

## v3 Path (future)

When v3 work diverges from 2.x (API removals/renames):

```
Phase 1 (now):
  develop → all PRs, canaries
  master  → stable 2.x

Phase 2 (when v3 diverges):
  release/2.x → 2.x PRs, canaries, patches (latest tag)
  develop     → v3 features (next canary)
  master      → v3 stable (next tag)
```

Critical hotfixes that apply to both 2.x and v3 get cherry-picked from `release/2.x` to `master`.

---

## Branch Protection Summary

| Branch | Direct push | PR required | CI required |
|--------|------------|-------------|-------------|
| `develop` | ❌ | ✅ | ✅ |
| `master` | ❌ (maintainers only for hotfixes) | ✅ | ✅ |
| `feature/*` | ✅ | — | — |
