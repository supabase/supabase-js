# Migration notes for `@supabase/functions-js`

Each file in this directory describes one migration theme — what changed in `@supabase/functions-js`, who is affected, and what callers need to do.

Files are shipped with the npm package, so the migration notes you see here are pinned to the version of `@supabase/functions-js` you have installed. Upgrading the package brings the relevant migration notes along with it.

## How agents should use this directory

When helping a developer upgrade `@supabase/functions-js`:

1. Read the migration files in `node_modules/@supabase/functions-js/migrations/` for the version they have installed.
2. Cross-reference against the version they are upgrading to.
3. Apply the migration steps described in each relevant file.

## How humans should use this directory

Browse the files for the migration theme you care about. Each file is self-contained and explains its own scope, audience, and steps.

## File naming

One file per migration theme, named by topic rather than version (e.g. `<theme>.md`, kebab-case). A single version can ship multiple theme files; a single theme can span multiple versions. Each file documents its own `Since` / `Will require action by` version range internally.

## Cross-cutting migration notes

Migrations that span multiple Supabase packages (e.g. Node.js version drops, monorepo restructures) live in [`docs/MIGRATION.md`](../../../../docs/MIGRATION.md) at the repository root, not here. This directory is scoped to `@supabase/functions-js` only.
