# How planner types work

This document explains how postgrest-js and supabase-js v3 type database queries. It is written for SDK maintainers. For a
hands-on tour, open the example project at
[`packages/core/supabase-js/example/planner-types`](../packages/core/supabase-js/example/planner-types/README.md) and hover the
queries.

## The idea in one sentence

TypeScript no longer parses select strings. A tool finds every query in the project, asks the **real PostgREST planner**
what each one returns, and writes the answers into a declaration file. The builders then look up their result type by key.

## Why change

In v2, the type of `select('id, author(name)')` came from a parser written in TypeScript's type system. It re-implemented
PostgREST's select grammar, embedding rules and nullability rules in types. It was:

- **Hard to maintain.** Every PostgREST feature (spreads, aggregates, JSON paths, computed fields, `!inner`, casts) had to be
  written a second time in type-level code.
- **Never quite right.** The type parser guessed from the generated `Database` type. It could not see foreign key
  validity, view definitions, function bodies or JSON Schema CHECKs, and filters never changed the result type.
- **Costly to type-check.** Every select string was parsed again by the type checker, character by character, and large
  schemas hit instantiation depth limits.

In v3 the answer comes from PostgREST itself. The planner (the code that turns a request into SQL) is compiled from upstream
PostgREST v16.4 to WebAssembly. Whatever PostgREST decides, the types say.

[Compared with v2](#compared-with-v2) sums up what this gains and costs: features, type-check performance and the day-to-day
workflow.

## Big picture

```mermaid
flowchart LR
  subgraph project["Your project"]
    code["src/**/*.ts<br/>supabase.from('posts').select('title, author(name)')"]
    tsconfig["tsconfig.json<br/>contentMappers options"]
  end

  subgraph db["Database schema"]
    snap["postgrest-schema.json<br/>(snapshot)"]
    live["or a live database<br/>(supabase-local / postgrest)"]
  end

  subgraph mapper["@supabase/postgrest-mapper"]
    scan["Scanner<br/>finds builder chains"]
    acquire["Schema acquisition<br/>dump + supplementary catalog"]
    plan["Planner host"]
    extra["Tracer (views, SQL functions)<br/>JSON Schema to TS"]
    print["Printers"]
  end

  wasm["@supabase/postgrest-planner<br/>PostgREST v16.4 planner (wasm)"]

  out["supabase.types.d.ts<br/>declare global { SupabaseSelects, ... }"]

  subgraph sdk["@supabase/postgrest-js (used through supabase-js)"]
    builder["Builders look up<br/>SupabaseSelects[key]"]
  end

  code --> scan
  tsconfig --> scan
  snap --> acquire
  live --> acquire
  scan -- "keys + requests" --> plan
  acquire --> plan
  plan <--> wasm
  acquire --> extra
  plan -- "result shapes" --> print
  extra --> print
  print --> out
  out --> builder
  code --> builder
```

Four packages take part:

| Package                       | Role                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@supabase/postgrest-planner` | The PostgREST planner compiled to wasm, with a small JS API: `load` a schema, `plan` a request.                        |
| `@supabase/postgrest-mapper`  | Everything else: scanner, schema acquisition, tracer, printers, the `postgrest-mapper` CLI, the TS 7.1 content mapper. |
| `@supabase/postgrest-js`      | The query builders. Their types read the generated globals; there is no select parser left.                            |
| `@supabase/supabase-js`       | `createClient()`, with no type argument needed. It forwards to postgrest-js.                                           |

The mapper is a library first. The CLI and the content mapper are thin wrappers around the same functions
(`generate`, `check`, `watch`, `refresh`, `snapshot`, `init`), so other tools, such as the Supabase CLI, can call them
directly.

## A query, step by step

Take this query from the example project:

```ts
const { data } = await supabase
  .from('posts')
  .select('title, author:authors!author_id(name), editor:authors!editor_id(name)')
```

The schema has `posts.author_id` and `posts.editor_id`, both `NOT NULL`. The `author_id` foreign key is validated. The
`editor_id` foreign key is `NOT VALID`, so Postgres does not promise that the editor row exists.

### 1. The scanner finds the chain

The scanner parses every source file with oxc-parser. It only looks at syntax and never type-checks. It finds
`from('posts').select('…')` and builds a **key**:

```
r|public|posts|title, author:authors!author_id(name), editor:authors!editor_id(name)
│ │      │     └─ the select string, exactly as written
│ │      └─ the relation
│ └─ the schema (from .schema('…') or the defaultSchema option)
└─ the kind: r = read, w = mutation followed by .select(), f = rpc
```

### 2. The planner answers

The mapper turns the key into the request postgrest-js would send:

```
GET /posts?select=title,author:authors!author_id(name),editor:authors!editor_id(name)
Accept-Profile: public
```

The planner returns a **result shape**: every output field with its type and nullability, every embed with its
cardinality and join type. In this case the planner says `author` is a to-one embed that is never null (validated FK on a
`NOT NULL` column), while `editor` may be null (the FK is `NOT VALID`).

### 3. The printer writes an entry

```ts
// src/supabase.types.d.ts (generated, abridged)
declare global {
  interface SupabaseSelects {
    'r|public|posts|title, author:authors!author_id(name), editor:authors!editor_id(name)': {
      row: {
        title: SupabaseColumnType<'public.posts.title', string>
        author: { name: SupabaseColumnType<'public.authors.name', string> }
        editor: { name: SupabaseColumnType<'public.authors.name', string> } | null
      }
      sources: { title: 'title' }
      embeds: {
        author: { path: ['author']; outputs: [['author']]; join: 'left'; cardinality: 'one' }
        editor: { path: ['editor']; outputs: [['editor']]; join: 'left'; cardinality: 'one' }
      }
    }
  }
}
```

- `row` is the result row.
- `SupabaseColumnType<'schema.table.column', T>` is `T` unless the user overrides that column (see
  [Overrides](#overrides)).
- `sources` and `embeds` describe where each field comes from. Filters use them to adjust the row (see
  [Filters](#filters-change-nullability)).

### 4. The builder looks it up

`from('posts')` records the kind, schema and relation in the builder's type state. `.select(q)` adds the select string.
The result type is then a plain indexed access:

```mermaid
flowchart LR
  a["from('posts')"] --> b["state: kind r,<br/>schema public,<br/>relation posts"]
  b --> c[".select(q)"]
  c --> d["key = r|public|posts|q"]
  d --> e{"key in<br/>SupabaseSelects?"}
  e -- yes --> f["row type from the entry,<br/>then filters, .single(), count…"]
  e -- "no: unplanned" --> g{"SupabasePgrstStatus<br/>unplanned"}
  g -- loose --> h["loose rows<br/>(unknown)"]
  g -- error --> i["type error:<br/>run postgrest-mapper"]
```

What the editor shows on hover:

```ts
const data:
  | {
      title: string
      author: { name: string }
      editor: { name: string } | null
    }[]
  | null
```

There is no recursion over the string and no parsing, so the cost does not grow with the length of the select.

## The generated globals

Everything the builders need lives in global interfaces in one generated file. Global interfaces are why
`createClient()` needs no type argument.

| Global                | Content                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SupabaseDatabase`    | Per schema: `Tables` / `Views` (`Row`, `Insert`, `Update`), `Functions`, `Enums`. Used for `select('*')`, write payloads and plain-column filters.                                 |
| `SupabaseSelects`     | One entry per select key the project uses: reads, mutations with `.select()`, and rpc calls.                                                                                       |
| `SupabaseOperands`    | Filter targets that are not plain columns of the row: embedded columns (`author.name`), JSON paths, embeds tested with `is null`. Keyed by the select key followed by the operand. |
| `SupabasePgrstStatus` | `state`, the `unplanned` policy (`'loose'` or `'error'`) and feature flags.                                                                                                        |
| `SupabaseColumnTypes` | **User-owned.** Never generated. Overrides the type of a column by `schema.table.column`.                                                                                          |

A bare `select('*')` has no entry: the builder takes the `Row` from `SupabaseDatabase`.

## Two ways to deliver the declarations

Both use the same options, read from the `contentMappers` entry in `tsconfig.json`:

```jsonc
{
  "include": ["src"],
  "contentMappers": [
    {
      "package": "@supabase/postgrest-mapper",
      "extensions": [".pgrst-index"],
      "options": {
        "postgrest": "16.4",
        "defaultSchema": "public",
        "schema": { "source": "snapshot", "path": "postgrest-schema.json" },
      },
    },
  ],
}
```

`postgrest-mapper init` writes this entry, the `src/supabase.pgrst-index` stub and the `include` changes for you.

### A. Generated file (TypeScript 5.1 and later, Deno)

This is the path that works today in every editor.

```bash
postgrest-mapper generate --project tsconfig.json --out src/supabase.types.d.ts           # once
postgrest-mapper generate --project tsconfig.json --out src/supabase.types.d.ts --watch   # on every save
postgrest-mapper generate --project tsconfig.json --out src/supabase.types.d.ts --check   # CI: fail if stale
postgrest-mapper refresh --project tsconfig.json --out src/supabase.types.d.ts            # clear the cache, regenerate
```

```mermaid
sequenceDiagram
  actor Dev as Developer
  participant Editor as Editor (tsserver)
  participant Watch as postgrest-mapper --watch
  participant Planner as Planner (wasm worker)

  Dev->>Editor: types .select('title, excerpt') and saves
  Editor-->>Dev: hover: loose (key not generated yet)
  Watch->>Watch: file changed: scan, derive keys
  Watch->>Watch: cache lookup (node_modules/.cache/postgrest-mapper)
  Watch->>Planner: plan the new keys only
  Planner-->>Watch: result shapes
  Watch->>Editor: rewrites src/supabase.types.d.ts
  Editor-->>Dev: hover: { title: string; excerpt: string | null }[]
```

Plans are cached per schema, so a regeneration only plans keys it has not seen (see
[Caching](#caching-offline-use-and-freshness)).

### B. TypeScript 7.1 content mapper (no generated file)

TypeScript 7.1 (typescript-go) can run a **content mapper**: a process that supplies the contents of files with a given
extension. The mapper package registers itself for `.pgrst-index`. When the compiler opens the stub
`src/supabase.pgrst-index`, it asks the mapper for its contents, and the mapper answers with the same declarations,
in memory.

```mermaid
sequenceDiagram
  participant TSC as tsc 7.1 / LSP
  participant CM as postgrest-mapper content mapper
  participant Planner as Planner (wasm worker)

  TSC->>CM: initialize, openProject(tsconfig, options)
  CM->>CM: scan files, acquire schema
  CM->>Planner: plan keys missing from the cache
  Planner-->>CM: result shapes
  CM-->>TSC: declarations text + files to watch
  TSC->>CM: transform(src/supabase.pgrst-index)
  CM-->>TSC: the declarations, as a virtual module
  Note over TSC,CM: a watched file changes: openProject again
```

This runs external code, so the compiler requires opt-in: `tsc --runExternalCode`, or
`initializationOptions.runExternalCode` for the language server. The command line and the 7.1 language server work in the
example project. Editor extension support is still being verified, so path A is the default for now.

#### Why an index file?

A content mapper can only supply the contents of a file that is already in the program. The compiler finds files
through `include`, and asks the mapper for the TypeScript of each file whose extension is registered. It has no hook for
adding a module out of nothing. Our declarations do not belong to any one source file: they are globals built from every
query in the project. So the project needs one placeholder file whose only job is to be included with the registered
extension. Its content is ignored.

- **Its own extension**, so that only this file triggers the mapper. TypeScript 5.x and Deno (path A) skip it because
  `.pgrst-index` is not a TypeScript extension. The CLI reads only the options of the `contentMappers` entry.
- **One per project**, because the globals must be declared exactly once. Any other `.pgrst-index` file gets diagnostic
  2001 and an empty module.
- **Where errors show up**: the compiler reports problems in the generated declarations at the top of this file.

## Where the schema comes from

The planner needs the same inputs PostgREST loads at startup, plus facts PostgREST's schema dump does not keep. The
`schema` option says where to read them:

| `schema.source`  | What runs                                                                                                                             | Needs                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `snapshot`       | Reads a committed `postgrest-schema.json`.                                                                                            | Nothing: no Docker, no database, no network. |
| `supabase-local` | `supabase status` finds the local stack. `docker exec` runs `postgrest --dump-schema` and `--dump-config` in its PostgREST container. | `supabase start` running, Docker.            |
| `postgrest`      | `docker run` of the pinned `supabase/postgrest:v16.4` image with `--dump-schema` against the database URL in `schema.dbUrlEnv`.       | Docker, a reachable database.                |

Each acquisition has three parts:

1. **The PostgREST schema dump and config**: exactly what PostgREST itself uses to plan. The config is stored without
   `db-uri`.
2. **The supplementary catalog**: read-only SQL for what the dump lacks. That includes column order, foreign key validity
   (`convalidated`), function return and `OUT` types, view definitions, SQL function bodies, JSON Schema CHECK constraints,
   enums, casts, and aggregate overloads. It runs in a `READ ONLY` transaction that is rolled back.
3. **Versions**: the PostgREST release and the Postgres version. The mapper refuses a schema from another PostgREST
   `major.minor` line than the planner's (diagnostic 2006), because the planner's answers would not describe that server.
   A different patch release is only a warning.

```mermaid
flowchart LR
  live["supabase-local / postgrest<br/>(Docker + database)"] -- "postgrest-mapper snapshot" --> snap["postgrest-schema.json<br/>(commit it)"]
  live -- "or read directly" --> gen["generate / watch /<br/>content mapper"]
  snap --> gen
  gen --> cache[("node_modules/.cache/<br/>postgrest-mapper")]
  gen --> out["declarations"]
```

### Caching, offline use and freshness

**Offline.** `postgrest-mapper snapshot` reads a live source once and writes everything above into one JSON file. With
`schema.source: "snapshot"`, generating needs no Docker, no database and no network: the planner and the tracer are wasm
inside the npm packages. This is the recommended setup for CI and for teammates who only change queries. The example
project works this way.

**What is cached.**

- **Plans.** Each result shape is cached on disk in `node_modules/.cache/postgrest-mapper/`, in one file per schema. The
  file name comes from a hash of the whole acquired schema. An entry is reused only when the schema hash, the planner
  build and the generator version all match. Change the schema and every key is planned again. Add a query and only
  that key is planned.
- **The schema itself is not cached on disk.** Every run reads it first, even when every plan is in the cache. With a
  snapshot that is a file read. With a live source, Docker and the database must be up. A long-running process (`--watch`,
  the content mapper) reads a live schema once and keeps it in memory. It also keeps the planner loaded with that schema,
  so a regeneration only plans the new keys.
- `postgrest-mapper refresh` clears the cache and reads the schema again. It is rarely needed: use it to force a reload,
  when polling is turned off, or in a one-shot run.

**When the database changes.** With a live source, `--watch` and the content mapper check the database for schema
changes every 2 seconds (`pollIntervalMs` on the source, `0` or `false` to turn it off). The check is one read-only query
over a connection they keep open. It hashes the catalog rows PostgREST's schema cache is built from, so `CREATE`, `ALTER`,
`DROP` and `GRANT` change the hash while `ANALYZE`, `VACUUM`, `TRUNCATE` and `REFRESH MATERIALIZED VIEW` don't. When the
hash moves, the poller writes it to a stamp file in the cache directory. The watcher sees the stamp change and reads the
schema again, and so does the content mapper, which asks `tsc` to watch the same stamp. A migration therefore
regenerates the types within a couple of seconds, with no command to run. The hash covers the whole database, so DDL in a
schema PostgREST doesn't expose also triggers a regeneration, which re-reads the schema but leaves the output unchanged.
A failed check keeps the last state, warns once and is retried at the next interval. One-shot commands (`generate`,
`--check`, `snapshot`, `refresh`) never poll.

With a snapshot, nothing polls: run `postgrest-mapper snapshot` again after a migration and commit the file. The watcher
sees the new file and regenerates.

## What the mapper adds on top of the planner

The planner decides structure: which embeds exist, their cardinality and join type, field names, spreads, aggregates and
casts. The mapper adds facts the planner does not track.

**View and SQL function tracer.** Postgres reports every view column and every function result column as nullable. The
tracer reads view definitions and `LANGUAGE sql` function bodies and follows each column back to its table:

```sql
create view post_summaries as
  select p.title, a.name as author_name, e.name as editor_name
  from posts p
  join authors a on a.id = p.author_id       -- inner join: keeps NOT NULL
  left join authors e on e.id = p.editor_id; -- left join: nullable
```

```ts
// select('title, author_name, editor_name') on the view
{
  title: string
  author_name: string
  editor_name: string | null
}
;[]
```

A function body it cannot trace keeps every column nullable, which is what Postgres promises.

**JSON Schema CHECKs.** A validated `CHECK (jsonb_matches_schema('{…}', metadata))` (pg_jsonschema) becomes the column's
TypeScript type. JSON paths into it are typed too:

```ts
.select('title, metadata, seo_title:metadata->seo->>title, tags:metadata->tags')
// metadata:  { tags: string[]; featured?: boolean; theme?: 'light' | 'dark'; seo?: {…} } | null
// seo_title: string | null
// tags:      string[] | null
```

## Filters change nullability

Filters do not change the planned entry, but they can change what the response may contain. The builder applies those
changes to the row type, using `embeds` and `SupabaseOperands`.

```ts
// author is non-null in a plain select (validated FK)
supabase.from('posts').select('title, author:authors!author_id(name)')
// → { title: string; author: { name: string } }[]

// a filter on a left-joined embed can null it out: PostgREST keeps the post, with author: null
supabase
  .from('posts')
  .select('title, author:authors!author_id(name)')
  .eq('author.name', 'Ada Lovelace')
// → { title: string; author: { name: string } | null }[]

// testing the embed itself narrows it back
supabase.from('posts').select('title, editor:authors!editor_id(name)').not('editor', 'is', null)
// → { title: string; editor: { name: string } }[]
```

Filter values are checked against the column type:

```ts
supabase.from('posts').select('title').eq('status', 'published') // ok: an enum label
supabase.from('posts').select('title').eq('status', 'announced') // error: not a post_status
supabase.from('posts').select('title').eq('views', 'many') // error: views is an integer
```

## RPC

An rpc entry has one `calls` element per set of argument keys and HTTP method the project actually uses. The builder
picks the call by the **keys** of the argument object, just like PostgREST picks an overload:

```ts
// find_posts(term text) returns setof posts
// find_posts(author_id bigint, status post_status) returns table(id, title, views)
await supabase.rpc('find_posts', { term: 'compiler' }) // posts rows
await supabase.rpc('find_posts', { author_id: 1, status: 'published' }) // { id, title, views } rows
await supabase.rpc('find_posts', { author_id: 'one' }) // error: bigint expected
```

A function returning rows accepts `.select()`, embeds and filters, like a table. With `{ get: true }`, arguments travel in
the query string. An argument the query string cannot carry, such as an object for a `jsonb` parameter, is a type error
that names the key. At runtime the same call returns the error `PGRSTJS01` instead of sending the request.

## Writes

`Insert` requires exactly the columns that are `NOT NULL` with no default. It leaves out identity and generated
columns. `Update` makes every column optional. A `.select()` after a write is planned like a read, under a `w|` key:

```ts
const { data } = await supabase
  .from('posts')
  .insert({ author_id: 1, editor_id: 2, title: 'Hello', slug: 'hello' })
  .select('id, title, status')
  .single()
// data: { id: number; title: string; status: 'draft' | 'published' | 'archived' } | null
```

`.single()`, `.maybeSingle()`, `{ count: 'exact', head: true }`, `.csv()` and `.throwOnError()` reshape the response
around the planned row as before.

## When there is no plan

A chain is **unplanned** when the generated file has no entry for its key. That happens when:

- the select string is not a literal (`select(columns.join(','))`). No tool can know it before the program runs.
- the code is new and `generate` has not run yet. `--watch` closes this gap within a moment of saving.

Unplanned chains follow the `unplanned` option:

- `'loose'` (default): rows are loosely typed (`unknown` / `Record<string, unknown>`), and the code still compiles.
- `'error'`: an unplanned chain is a type error. Use this in CI together with `generate --check`.

A select the planner **rejects** (an unknown column, an ambiguous relationship) gets an `{ error }` entry. The builder
shows the PostgREST error message, for example `PGRST200: Could not find a relationship …`, as a type error at the call.

## Overrides

**`SupabaseColumnTypes`** sets the type of a column the database does not describe, such as a plain `jsonb` column or an
array that may hold nulls. It applies everywhere the column appears: selects, filters and write payloads. The column's
own nullability is kept.

```ts
declare global {
  interface SupabaseColumnTypes {
    'public.authors.socials': { github?: string; mastodon?: string }
  }
}
// select('name, socials') → { name: string; socials: { github?: string; mastodon?: string } | null }[]
```

**`.cast<T>()`** replaces the row type of one call and keeps the response shape (array, single row, count). It replaces
v2's `.returns<T>()` and `.overrideTypes<T>()`.

```ts
const { data } = await supabase
  .from('posts')
  .select('id, title')
  .cast<{ id: number; title: string; note?: string }>()
```

## Compared with v2

### What v3 types that v2 did not

Both versions type embeds, aliases, `!inner`, foreign key hints, spreads, aggregates, casts, JSON paths, computed fields,
rpc overloads and filter values. The difference is in how right the answer is, and in what the type parser could not
know:

| Case                                                    | v2 (type-level parser)                                                            | v3 (planner)                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| To-one embed through a `NOT VALID` foreign key          | Non-null when the FK column is `NOT NULL`, though the row may not exist           | Nullable: the FK is not validated                                                     |
| View columns                                            | Whatever the generated `Database` type says                                       | Traced to the base table: `NOT NULL` through inner joins, nullable through left joins |
| `LANGUAGE sql` function results                         | Whatever the generated `Database` type says                                       | Traced like a view                                                                    |
| `jsonb` column with a JSON Schema CHECK (pg_jsonschema) | `Json`                                                                            | The TypeScript type of the schema, and JSON paths into it                             |
| `sum`, `avg`, `min`, `max`                              | `number`                                                                          | `number \| null`: they are null on an empty set                                       |
| A filter on an embedded column, `.eq('author.name', …)` | Result type unchanged, so `author` stays non-null though PostgREST returns `null` | `author` becomes nullable                                                             |
| `.not('editor', 'is', null)` on an embed                | Root columns only                                                                 | Narrows the embed to non-null                                                         |
| rpc `{ get: true }` with an object argument             | Not checked                                                                       | Type error naming the key                                                             |
| Unknown column or relationship                          | A parser error type                                                               | PostgREST's own error, e.g. `PGRST200: Could not find a relationship …`               |
| Select string that is not a literal                     | Error type                                                                        | Loose rows, or an error with `unplanned: 'error'`                                     |
| Column type the database does not describe              | `.returns<T>()` / `.overrideTypes<T>()` per call                                  | `SupabaseColumnTypes` once per column, or `.cast<T>()` per call                       |

More generally, any PostgREST behaviour the parser did not reimplement was wrong or missing in v2. In v3 it is right by
construction, and a new PostgREST release is a rebuild of the wasm, not new type-level code.

### Performance

The same queries were type-checked with each version: 500 chains over the example project's schema (selects with
embeds, aliases, casts, spreads and `!inner`, filters, writes, rpc calls, and some long nested selects). v2 is
`@supabase/supabase-js` 2.118.0 with a `Database` type from postgres-meta, the generator behind `supabase gen types`. v3
is this branch with the generated file. Both compile with zero errors. Results are the median of 7 runs of
`tsc --noEmit --extendedDiagnostics` on an Apple M3.

| TypeScript | v2 check time | v3 check time | v2 instantiations | v3 instantiations | v2 peak memory | v3 peak memory |
| ---------- | ------------- | ------------- | ----------------- | ----------------- | -------------- | -------------- |
| 5.8        | 6.12 s        | 0.56 s        | 14.6 M            | 473 k             | 906 MB         | 383 MB         |
| 6.0        | 3.99 s        | 0.56 s        | 5.5 M             | 381 k             | 1222 MB        | 383 MB         |
| 7.0        | 0.86 s        | 0.09 s        | 5.8 M             | 429 k             | 693 MB         | 183 MB         |
| 7.1 beta   | 0.67 s        | 0.09 s        | 5.7 M             | 429 k             | not measured   | not measured   |

- **7 to 11 times faster** to check, with 13 to 31 times fewer type instantiations, on every TypeScript version.
- **Each extra query** costs about 12 ms in v2 and 1 ms in v3 (TypeScript 5.8). In v3 the cost does not depend on the
  length of the select string.
- **Hover in the editor** (TypeScript 5.8 language service, a long select in a 200-query project): 136 ms in v2 and 4 ms in
  v3 once warm, 185 ms and 21 ms right after an edit.
- **Generating the types** with the mapper, from a snapshot: 0.68 s for 500 queries from an empty cache, 0.19 s after
  editing one select. The generated file is 365 KB.

The schema is small (three tables and a view). v2's cost also grows with the size of the `Database` type, which v3's
lookup does not depend on, so on a real project the gap is likely wider. 412 of the 500 result types are identical in both
versions. The other 88 differ because v3 is more precise (the `NOT VALID` foreign key, view columns, filters, write
responses).

### Developer experience

|                            | v2                                               | v3, TypeScript 5.1 to 7.0, Deno                                       | v3, TypeScript 7.1                       |
| -------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------- |
| Setup                      | `supabase gen types`, `createClient<Database>()` | `postgrest-mapper init` once, no type argument                        | Same, plus `--runExternalCode`           |
| A new or edited select     | Typed as you type                                | Loose until you save, then typed a moment later by `generate --watch` | Typed by the compiler itself, no watcher |
| Schema change              | Run `supabase gen types` again                   | Automatic with a live source; `snapshot` again for a snapshot         | Same                                     |
| Generated file in the repo | `database.types.ts`                              | `supabase.types.d.ts`                                                 | None, only the `.pgrst-index` stub       |
| CI                         | `tsc`                                            | `generate --check`, then `tsc` with `unplanned: 'error'`              | `tsc --runExternalCode`                  |
| Errors                     | Parser error types                               | PostgREST's messages at the call                                      | Same                                     |

The main cost is the watcher. Below TypeScript 7.1, the generated file only knows the queries that existed at the last
generation, so `generate --watch` has to run during development (the example's `pnpm types:watch`). Between a keystroke
and the next save, a new select is loosely typed rather than wrong, and `--check` with `unplanned: 'error'` keeps a stale
file out of CI. TypeScript 7.1 removes the watcher and the generated file. Its editor support is still being verified,
which is why the generated file is the default for now.

## Known limits

- **Arrays** are typed as one-dimensional with non-null elements (`int4[]` is `number[]`). Postgres enforces neither
  property; use `SupabaseColumnTypes` when a column holds null elements or nested arrays.
- **Aggregates** assume Postgres' builtin `count`, `sum`, `avg`, `min` and `max`. A user function of the same name that
  Postgres would pick instead is only detected in the common cases.
- **Dynamic select strings** are always unplanned (see above).
- **Untraceable function bodies** (anything but a single-query `LANGUAGE sql` function, or a `search_path` with `$user`)
  keep their result columns nullable.

The package READMEs list the precise limits:
[postgrest-mapper](../packages/tooling/postgrest-mapper/README.md),
[postgrest-planner](../packages/tooling/postgrest-planner/README.md) and
[postgrest-js](../packages/core/postgrest-js/README.md#typing).

## Where to look in the code

| Concern                         | Location                                                      |
| ------------------------------- | ------------------------------------------------------------- |
| Planner wasm and JS API         | `packages/tooling/postgrest-planner/`                         |
| Scanner and key derivation      | `packages/tooling/postgrest-mapper/src/scanner.ts`, `keys.ts` |
| Schema acquisition and snapshot | `packages/tooling/postgrest-mapper/src/schema/`               |
| Planner host (worker, timeouts) | `packages/tooling/postgrest-mapper/src/host/`                 |
| View and function tracer        | `packages/tooling/postgrest-mapper/src/tracer/`               |
| JSON Schema to TypeScript       | `packages/tooling/postgrest-mapper/src/jsonschema/`           |
| Generator, cache and printers   | `packages/tooling/postgrest-mapper/src/generate/`, `printer/` |
| CLI and library operations      | `packages/tooling/postgrest-mapper/src/cli/`, `operations/`   |
| TS 7.1 content mapper           | `packages/tooling/postgrest-mapper/src/content-mapper/`       |
| Builder lookup and filter facts | `packages/core/postgrest-js/src/types/planner/`               |
| End-to-end example              | `packages/core/supabase-js/example/planner-types/`            |
