# postgrest-planner-example

Hover over a supabase-js query in your editor and see the type the real PostgREST planner derived for it.

This is supabase-js v3: its builders (`from().select()`, `insert()`, `rpc()`, filters, ...) are typed from declarations that
`@supabase/postgrest-mapper` generates. The mapper finds every query in `src/`, asks the PostgREST v16.4 planner (compiled to
wasm) what each one returns against your database schema, and writes the answers to `src/supabase.types.d.ts`. Embeds,
nullability, aggregates, JSON paths, computed fields and rpc overloads are decided by the planner, not guessed by TypeScript.

This folder is a pnpm workspace package of the supabase-js monorepo: the packages it uses are the ones in this repository (see "How it is wired").

## Quick start

Needs Node >= 22.12, pnpm 11 (`corepack enable` picks the one pinned by the repository root) and, for the database steps,
Docker with the standalone `docker-compose` binary. No database is needed to see the hovers: the generated types and the schema
snapshot are committed.

1. `pnpm install`, from anywhere in the repository (the example is a workspace package).
2. `pnpm build:packages`, from this folder (`packages/core/supabase-js/example/planner-types`): builds the packages the example uses
   (`@supabase/postgrest-js`, `@supabase/supabase-js`, `@supabase/postgrest-mapper`, `@supabase/postgrest-planner`) through nx. They resolve
   to their `dist/`, so the editor shows no types before this step. The planner build uses the committed wasm, so no Haskell toolchain
   is needed. (Once a pull request exists, preview packages from pkg.pr.new will replace this step.)
3. Open this folder in VS Code or Cursor and pick the workspace TypeScript when asked (`.vscode/settings.json` points
   `typescript.tsdk` at `node_modules/typescript/lib`, TypeScript 5.8).
4. Open `src/select.ts` and hover the variable on the left of each `await` (`embeds`, `toMany`, `aggregates`, ...).

To go further, with Docker:

5. `pnpm db:up`: starts Postgres (`localhost:55432`) and PostgREST v16.4 (`localhost:53000`) with the schema and seed of `db/`.
6. `pnpm types:watch`: generates `src/supabase.types.d.ts` and regenerates it whenever you save a file in `src/`.
   (`pnpm types` generates once, and needs neither Docker nor a network.) Then edit a select string in `src/select.ts`, for example
   add `body` to `'title, excerpt'`, save, and watch the type follow a moment later.

Also: `pnpm check` (`tsc --noEmit`; it passes only if every `@ts-expect-error` is a real rejection), `pnpm demo` (runs every
query against PostgREST and prints the rows, so you can compare them to the types) and `pnpm hover src/select.ts` (prints what
the editor would show for each variable of a file, without an editor).

## Tour

Every chain is commented with what to hover and what it shows.

- `src/select.ts`: a to-one embed that is non-null through a validated foreign key (`author`) next to one that is nullable through a
  NOT VALID foreign key (`editor`); a to-many embed, aliases, a spread, `!inner`; aggregates (`count()`, `sum`, `avg`); casts; a JSON
  path into a column typed by its JSON Schema CHECK (pg_jsonschema); a computed field (`excerpt`); a view.
- `src/filters.ts`: `.eq` typed by the column (an enum, an integer) with the wrong types rejected; filters on an embed, and what they do
  to nullability (`.eq('author.name', ...)` makes `author` nullable, `.not('editor', 'is', null)` makes it non-null);
  `referencedTable`.
- `src/mutations.ts`: `insert` / `update` / `upsert` with the right required columns and `.select()` on the result; `.single()`,
  `.maybeSingle()`, `{ count: 'exact', head: true }`, `.csv()`.
- `src/rpc.ts`: a SETOF rpc with `.select()`; a scalar rpc; an overloaded rpc dispatched by argument keys; and a `{ get: true }` call whose
  object argument cannot travel in a query string, rejected by the planner (PGRSTJS01).
- `src/overrides.ts`: `SupabaseColumnTypes` (state the shape of a plain jsonb column), `.cast<Row>()`, and the loose fallback of a
  select the mapper cannot plan.
- `src/client.ts`: the client. It takes no type argument: the types are global declarations from the generated file.
- `db/schema.sql`, `db/seed.sql`: the schema (tables, a NOT VALID foreign key, a view, an enum, a domain, a JSON Schema CHECK, a computed
  field, rpc functions, grants) and the data.

### What the hover shows

A plain column shows as `SupabaseColumnType<'public.posts.title', string>`: that is `string`, wrapped so that a
`SupabaseColumnTypes` override (see `src/overrides.ts`) can replace it by column key. `pnpm hover` prints the resolved types
(`title: string`). Embeds, nullability, arrays and aggregates are shown as they are.

### The loose fallback

A chain the generated file has no entry for is typed loosely (rows are `unknown` / `Record<string, unknown>`), because the mapper
sets `unplanned: 'loose'` in the file it generates (set the option `unplanned: 'error'` in the `contentMappers` options of
`tsconfig.json` to make an unplanned chain a type error instead). That happens in two cases: the select is not a string literal
(`dynamic` in `src/overrides.ts`: no tool can know it), or you just wrote a new literal and `pnpm types` has not run yet.
Add a chain to any file of `src/`, hover it (loose), save with `pnpm types:watch` running, hover again (precise).

## The schema snapshot

The mapper needs the database schema. `postgrest-schema.json` is a snapshot of it, committed, which `tsconfig.json` points at
(`schema.source: "snapshot"`), so generating needs neither Docker nor a network.

After changing `db/schema.sql`, reacquire the schema and regenerate:

```sh
pnpm db:down && pnpm db:up   # the schema runs when the database is created
pnpm snapshot                # reads the schema from the running database with PostgREST's own introspection (docker run)
pnpm types                   # or: pnpm exec postgrest-mapper refresh --project tsconfig.json --out src/supabase.types.d.ts
```

`postgrest-mapper refresh` clears the mapper's cache (`node_modules/.cache/postgrest-mapper`) and regenerates; use it when the
types look stale even though the snapshot did not change. `pnpm types:check` verifies the committed file is up to date without
writing anything.

## TypeScript 7.1 content mapper (no generated file)

The same mapper is also a TypeScript 7.1 content mapper (typescript-go#4712): the compiler runs it itself and gets the declarations
in memory from `src/supabase.pgrst-index`, so there is no generated `.d.ts` to keep up to date.
`tsconfig.content-mapper.json` is the project for that path (the `contentMappers` entry is in `tsconfig.json`, shared with the CLI).

```sh
pnpm check:content-mapper    # tsc 7.1.0-beta --runExternalCode: the same checks as `pnpm check`, with no generated file
```

What works today, tested here:

- The command line works: `typescript@7.1.0-beta` (installed as `typescript-7.1`) with `--runExternalCode` type-checks the project with
  the planner's types and every `@ts-expect-error` holds. Without the flag it refuses (TS18068), and the loose types make every
  `@ts-expect-error` unused.
- The 7.1 language server works too: `tsc --lsp -stdio` answers a hover on `embeds` with the planner's type once the client sends
  `initializationOptions: { "runExternalCode": true }` in `initialize`; without that option, the hover is `Record<string, unknown>[] | null` and
  the tsconfig reports TS18068. There is no command line flag for the server, only that option.
- `@typescript/native-preview` from npm (`tsgo`, `7.0.0-dev.20260707.2`) does not know content mappers: `--runExternalCode` is an unknown
  option, so it only sees the loose types. TypeScript 7.0.2 (`latest` on npm) does not either. 7.1 is on npm as the `beta` tag.
- Editors: the VS Code extension "TypeScript 7" (`TypeScriptTeam.native-preview`, 1.0.1) has a setting `js/ts.contentMappers.enabled` (default on,
  experimental) and `js/ts.tsdk.path` / `typescript.native-preview.tsdk` to choose the compiler. That is what an editor needs, but
  **it was not verified in an editor here** (no GUI session): pointing it at `./node_modules/typescript-7.1` and at
  `tsconfig.content-mapper.json` is the experiment to run, and whether the extension sends `runExternalCode` is the open question.
  Until then, the generated file (primary path) is what works in a stock VS Code / Cursor with the TypeScript 5.8 of this project.

## How it is wired

- `package.json` depends on four workspace packages (`workspace:*`): `@supabase/supabase-js`, `@supabase/postgrest-js` (the builders and
  their types), `@supabase/postgrest-mapper` (the CLI, the generator, the content mapper) and `@supabase/postgrest-planner` (the wasm
  planner). The other `@supabase/*` packages that `supabase-js` depends on are workspace packages too, so none comes from npm.
  TypeScript and `@types/node` come from the root `catalog:`.
- The packages are used as built (`dist/`). After pulling, or after changing their sources, run `pnpm build:packages` again, then `pnpm types`.
  `pnpm build:packages` is `pnpm nx run-many -t build -p @supabase/postgrest-js @supabase/supabase-js postgrest-mapper postgrest-planner`; nx builds
  the other workspace dependencies first.
- This folder is under `packages/core/supabase-js/example`, which `.nxignore` hides from nx: it is not an nx project, so no CI target (`build`,
  `lint`, `test`) runs for it.
- The database: `docker-compose.yml` (project `postgrest-planner-example`) runs `supabase/postgres` (pg_jsonschema) and PostgREST v16.4, the
  version the planner models. `db:up` waits until PostgREST answers. The PostgREST image has no shell, so there is no compose health
  check for it.
- `src/client.ts` strips `/rest/v1` from the URL, because supabase-js speaks to the Supabase API gateway and this example runs PostgREST bare.
- `pnpm check` calls `node_modules/typescript/bin/tsc` by path: the `typescript-7.1` alias also ships a `tsc`, and pnpm links the last one into `node_modules/.bin`.
- `docker-compose` (the standalone binary) is used instead of `docker compose`. On a machine with Docker context `orbstack`, run
  `DOCKER_CONTEXT=orbstack pnpm db:up`.
