# Agent instructions

Entry point for AI/LLM agents working in or with this repository. Pointers below; nothing canonical lives in this file.

## Repository overview

- [`README.md`](./README.md) — what this repo is, package list, quick start
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution guidelines, commit format, PR process
- [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) — development conventions, Nx commands, testing matrix, library-specific notes (read by Claude Code; the canonical development-conventions doc)
- [`.cursor/.cursorrules`](./.cursor/.cursorrules) — same conventions for Cursor (read by Cursor IDE)

## Agent skills

Reusable agent skills for working in this Nx workspace (Nx-related: `nx-workspace`, `nx-generate`, `nx-import`, `nx-plugins`, `nx-run-tasks`, `link-workspace-packages`) live at:

- [`.agents/skills/`](./.agents/skills/) — vendor-neutral location (Agent Skills spec)
- [`.claude/skills/`](./.claude/skills/) — mirrored copy read by Claude Code by literal path

Both directories currently hold the same content. Treat `.agents/skills/` as the source of truth; the `.claude/skills/` copy is kept in sync until Claude Code can discover skills from `.agents/skills/` directly.

## Per-package usage

Each package has its own README with usage examples and API notes:

- [`packages/core/supabase-js/README.md`](./packages/core/supabase-js/README.md) — `@supabase/supabase-js` (main isomorphic client)
- [`packages/core/auth-js/README.md`](./packages/core/auth-js/README.md) — `@supabase/auth-js`
- [`packages/core/postgrest-js/README.md`](./packages/core/postgrest-js/README.md) — `@supabase/postgrest-js`
- [`packages/core/realtime-js/README.md`](./packages/core/realtime-js/README.md) — `@supabase/realtime-js`
- [`packages/core/storage-js/README.md`](./packages/core/storage-js/README.md) — `@supabase/storage-js`
- [`packages/core/functions-js/README.md`](./packages/core/functions-js/README.md) — `@supabase/functions-js`

## Migration notes

Migration notes live close to the code they describe, so they ship via npm alongside the package.

- **Per-package migrations**: `packages/core/<package>/migrations/<theme>.md` — one file per migration theme (e.g. `<new-feature-adoption>.md`). Each file describes what changed, who is affected, and what callers need to do.
- **Cross-cutting migrations** (affecting the whole repo or all packages): [`docs/MIGRATION.md`](./docs/MIGRATION.md) — one H2 section per theme (e.g. Node.js version drops). Low-frequency by design; split into a directory only if the file grows past a handful of themes.

When helping a user upgrade a `@supabase/*` package, check `node_modules/@supabase/<package>/migrations/` for migration notes shipped with the installed version. They are version-pinned by virtue of being inside the package.

## Other documentation

- [`docs/TESTING.md`](./docs/TESTING.md) — testing guide with Docker requirements per package
- [`docs/RELEASE.md`](./docs/RELEASE.md) — release workflows and versioning strategy
- [`docs/SECURITY.md`](./docs/SECURITY.md) — security policies and responsible disclosure
- [`docs/JSR_PUBLISHING.md`](./docs/JSR_PUBLISHING.md) — JSR registry publishing
