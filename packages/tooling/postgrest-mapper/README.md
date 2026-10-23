# @supabase/postgrest-mapper

Private for now. The scanner and TypeScript content mapper of the postgrest builder planner (design v5 §4.2, §4.3): a syntax-only pass over TS/TSX that finds supabase/postgrest builder chains and records what must be planned. A library with a typed API: all I/O is injected or explicit, nothing reads `process.cwd` or prints.

## Usage

```ts
import { scanFiles, scanSource, selectKey } from '@supabase/postgrest-mapper'

const result = scanSource('app.ts', `supabase.from('todos').select('id, title').eq('done', false)`)
// result.selects  -> [{ target: { kind: 'r', schemas: 'exposed', relation: 'todos' }, select: 'id, title', locations }]
// result.operands -> [{ target: ..., select: 'id, title', operand: 'done', via: 'column', locations }]

scanFiles(files, { exposedSchemas: ['public'] }) // many files, one deduplicated result
```

`ScanResult` lists, deduplicated and sorted (the result does not depend on file order):

- `selects`: one per relation or function target and select value. Kind `r` is a read (GET/HEAD), `w` a mutation's `.select()` representation, `f` an rpc (`keys` is its sorted argument key set or `null` when not a literal, `method` is `GET`, `HEAD` or `POST`).
- `operands`: filter and order columns against a select (`via: 'column'`), or `@table` for a `referencedTable` / `foreignTable` option (`via: 'referencedTable'`).
- `fallbacks`: per file, every select that is not connected to a chain (a helper taking a builder) paired with each relation and function the file names, at most 64 per file.
- `unresolved`: selects, relations, functions and schemas that did not resolve to a finite string set.
- `files`: per-file parse error count and whether the fallback was truncated.

Every request carries `locations` (UTF-16 offsets, 1-based line and column). The select strings are raw cooked strings: no normalisation. `selectKey` / `operandKey` / `requestKeys` build the keys of postgrest-js `src/types/planner/lookup.ts`.

Resolution is lexical: string literals, templates without substitutions, unannotated same-file `const`s, conditionals whose branches both resolve, `as const` and parentheses. Builders resolve through the same `const`s. `let`, parameters and annotated consts are not followed.

## JSON Schema to TypeScript

`jsonSchemaToTs(schema, { jsonType? })` turns a parsed `pg_jsonschema` schema (design v5 §6.1) into a one-line TypeScript type expression. Pure and deterministic: members keep the schema's order, duplicates are dropped, property names are quoted only when they are not identifiers. `jsonType` (default `Json`) names the "any JSON value" type.

The result is always a superset of what the schema accepts. Nothing is guessed narrower.

- Converted: `type` (string or array), `enum`, `const`, `properties`, `required`, `additionalProperties`, `items` (schema or array form), `additionalItems`, `minItems` (tuples only), `anyOf` / `oneOf` (unions), `allOf` (intersections), `nullable: true`, local `$ref` (`#`, `#/$defs/...`, `#/definitions/...`, any JSON pointer), and the boolean schemas (`true` is `Json`, `false` is `never`).
- Objects: `additionalProperties: false` closes the object. Otherwise (absent, `true` or a schema) an index signature `[k: string]: V` is added, where `V` is the additional type (`Json` by default), plus every named property type that is not already a `Json`, plus `undefined` when a named property is optional, because TypeScript requires named properties to fit the index signature. A required name without a `properties` entry takes the open type. A closed object with no properties is `{ [k: string]: never }`.
- Widened to `unknown` at that position: `patternProperties` (the open positions of that object), a recursive, remote, malformed or unresolvable `$ref`, an unknown `type`, a non-schema value, nesting deeper than 64 levels.
- Arrays: only the array form of `items` (with `additionalItems`) is a tuple. `prefixItems` is ignored, whatever `$schema` says: pg_jsonschema (checked against 0.3.3) does not implement it under any dialect, so it never constrains an element, and `{ prefixItems: [...], items: true }` is `Json[]`. For the same reason a 2020-12 document's array-form `items` still counts as a tuple.
- Ignored (they only narrow): `pattern`, `format`, `minimum` and friends, `minLength`, `maxItems`, `uniqueItems`, `not`, `if` / `then` / `else`, `dependent*`, `contains`, titles and descriptions. Type-specific keywords without a `type` constrain nothing the converter can use, so the schema stays `Json`. A `$ref` ignores its siblings.

## View and SQL function tracer

```ts
import { createTracer } from '@supabase/postgrest-mapper'

const tracer = await createTracer() // loads libpg_query (wasm); options: { pgVersion: 15 | 16 | 17 }, default 17
const result = await tracer.trace({
  sql: `SELECT u.username, p.id AS pid FROM (users u LEFT JOIN user_profiles p ON ((p.username = u.username)))`,
  columns: ['username', 'pid'],
  catalog: {
    searchPath: ['public'], // default
    relations: [
      {
        schema: 'public',
        name: 'users',
        kind: 'table',
        columns: [{ name: 'username', notNull: true }],
      },
      {
        schema: 'public',
        name: 'user_profiles',
        kind: 'table',
        columns: [
          { name: 'id', notNull: true },
          { name: 'username', notNull: false },
        ],
      },
    ],
  },
})
// result.columns -> [
//   { nullable: false, source: { schema: 'public', relation: 'users', column: 'username' } },
//   { nullable: true, source: { schema: 'public', relation: 'user_profiles', column: 'id' }, reason: 'nullable side of a LEFT JOIN' },
// ]
```

Plain data in, plain data out: no database, file or console access. `trace` is async only because libpg_query's parse call is; it never rejects for SQL it cannot handle, it returns every column nullable with `error` set.

Input (`TraceInput`):

- `sql`: `pg_get_viewdef` text, or the `prosrc` of a single-query `LANGUAGE sql` function (SETOF / RETURNS TABLE). Exactly one `SELECT` (set operations, `VALUES` and `WITH` included).
- `columns`: the output column names in order. Only their count matters; the result is positional.
- `catalog.relations`: per base relation `{ schema, name, kind, columns: [{ name, notNull, type? }] }`, columns in attribute order. `kind: 'table'` (partitioned tables too) uses `notNull`; `'view'` is traced from `definition` (`pg_get_viewdef`) or taken from `traced` (a previous result), so views over views compose; `'other'` (foreign tables, composite types, materialized views) is all nullable: a materialized view is traced like a view only when it is a view (`relkind 'v'`), because its stored rows can lag its definition. Views are traced recursively on demand, once per `trace` call, with a cycle guard (a view that reaches itself is all nullable); a view that cannot be traced is all nullable and never fails the caller.
- `catalog.searchPath`: schemas searched in order for an unqualified relation, default `['public']`. Use the search path the definitions were rendered under.
- `parameters` / `functionName` (function bodies): a name that is not a column of the query, `function_name.param` and `$n` resolve to a parameter, an expression of unknown nullability.

Output (`TraceResult`): `columns[i] = { nullable, source?, reason? }` and `error?`. `source` is `{ schema, relation, column }` and is set when the column is a plain pass-through of a base table column (through views, subqueries, CTEs, joins and set operations whose arms agree), whatever its nullability. `reason` is set when `nullable`. The tracer reports provenance and nullability only: the function's volatility and single-row composite returns (design v5 §4.3) are for the caller.

Rules (design v5 §6.2, conservative: anything not proven non-null is nullable):

- Set operations: `UNION` is non-null only when every arm is, `INTERSECT` when any arm is, `EXCEPT` follows the left arm. Each arm is judged by the rules below.
- `GROUPING SETS`, `ROLLUP`, `CUBE`: column references are nullable.
- Plain column: its base column's `NOT NULL`, unless its relation is the nullable side of a `LEFT` / `RIGHT` / `FULL` join. `INNER` and `CROSS` joins preserve it. `USING` / `NATURAL` merge columns (the left value, the right one for `RIGHT`, nullable for `FULL`).
- `count(...)` (also with `FILTER` or `OVER`) and non-null constants are non-null. `COALESCE` is non-null when an argument is. `VALUES` needs every row to prove the column.
- Every other expression is nullable: other aggregates, window functions, scalar subqueries, `CASE`, operators, function calls, whole-row references, functions in `FROM`.
- Beyond the flowchart: a cast of a non-null expression to a type in `pg_catalog` is non-null (`pg_get_viewdef` wraps many columns in one); a cast to any other type (a domain, whose constraint can reject, or a custom type) or of an expression whose own type is outside `pg_catalog` is nullable. This needs the column `type` (`format_type`, schema qualified outside `pg_catalog`); a column without one is treated as non-built-in, so a cast of it is nullable. A cast drops provenance.
- Subqueries in `FROM`, `LATERAL`, and `WITH` (including recursive: the self reference is nullable) are traced with the same rules.

## Content mapper (TypeScript 7.1)

The package is a TypeScript 7.1 content mapper (microsoft/typescript-go#4712) for one `.pgrst-index` file per project (design v4 §4.1). The `typescript.contentMapper` field of `package.json` tells `tsc` to run `node bin/content-mapper.cjs` (`dynamicConfig: true`, so `openProject` returns the identity and the watch set).

```jsonc
// tsconfig.json; run `tsc --runExternalCode`
{
  "contentMappers": [
    {
      "package": "@supabase/postgrest-mapper",
      "extensions": [".pgrst-index"],
      "options": { "postgrest": "14.4", "schema": { "source": "supabase-local" } },
    },
  ],
}
```

`createContentMapperServer({ input, output, logger, generator })` is the whole server: JSON-RPC 2.0 with `Content-Length` framing over any pair of streams (`bin/content-mapper.cjs` passes stdio). It answers `initialize`, `openProject`, `transform` and `closeProject` (and `shutdown` / `exit`), turns every bad request into a JSON-RPC error, and logs only through the injected logger (`createStreamLogger(process.stderr, process.env)`: verbose when `TS_CONTENT_MAPPER_DEBUG` is set, like `tsc`'s own tracing).

- **Options** are shape-checked by `validateOptions` (`postgrest`, `schema`, optional `defaultSchema`, `scan`, `unplanned`); problems are returned as `optionDiagnostics` and `tsc` reports them at the value in `tsconfig.json`. With invalid options the generator is not called and the index file transforms to an empty module.
- **The generator** (`ProjectGenerator`) does all the work of `openProject`: `({ configFileName, projectHandle, options, compilerOptions }) => { identity, watchedFiles, text, diagnostics, optionDiagnostics }`. `transform` returns the stored `text` for the project's index file, with no span mappings: `tsc` reports the virtual module's diagnostics at the top of the index file. A generator is shared by all projects and owns every cache that should outlive `closeProject`; the server only keeps the last result per project handle and drops it on `closeProject`.
- **Index file**: the first file transformed in a project is its index file; any other file with the extension gets diagnostic 2001 and an empty module.
- `bin/content-mapper.cjs` runs the real generator (`createProjectGenerator`, see "Project generator" below). `stubGenerator` stays exported as a protocol fixture: it declares one `SupabaseSelects` entry (`'r|public|stub|*'`). `POSTGREST_PLANNER_WASM` makes the process use another build of the planner wasm; it exists for this package's own tests, which pin the planner they were written against.

## Schema acquisition

`src/schema/` acquires everything the planner and the mapper need about a database (design v3 §4.2). It is a library: typed functions with every effect injected (`exec`, database `connect`, `fs`, `logger`), so a CLI, the content mapper or tests drive it the same way.

```ts
const schema = await acquireSchema({ source: 'supabase-local', workdir: '.' })
// { dump, config, pgVersionNum, postgrestVersion, supplementary }
planner.load({ config: schema.config, schema: schema.dump /* , supplementary */ })
```

| Source           | How                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase-local` | `supabase status -o json` for the database URL (or `dbUrl`); `docker exec supabase_rest_<project_id> postgrest --dump-config / --dump-schema / --version`. `project_id` comes from `projectId`, `supabase/config.toml`, or the one running stack.      |
| `postgrest`      | `docker run` of a pinned image (`DEFAULT_POSTGREST_IMAGE`, the planner's upstream release) with `PGRST_DB_URI` and `config` as `PGRST_*` variables, all in the child's environment. A loopback host in `dbUrl` is rewritten to `host.docker.internal`. |
| `snapshot`       | A committed JSON file. Nothing is executed or connected.                                                                                                                                                                                               |

The first two share one deadline (`timeoutMs` in the deps, `DEFAULT_ACQUIRE_TIMEOUT_MS` = 5 minutes, `Infinity` for none; a snapshot read is not bounded). Each child process gets what is left of it and is sent SIGTERM when it runs out (`docker run` forwards it to its container; `docker exec` does not stop the process it started inside the container), the `pg` connection gets the same budget as `statement_timeout` and `query_timeout`, and the call rejects with a `SchemaAcquisitionError` of code `'timeout'`. A custom `exec` receives `options.timeoutMs` and must reject with `ExecTimeoutError` after killing the child; one that ignores it is still abandoned when the deadline passes, and its connection is closed.

For the first two the supplementary catalog and `server_version_num` are read over `pg` (`connectPg`, or any `DbClient`) inside `BEGIN READ ONLY` ... `ROLLBACK` with an empty `search_path`; the connection must be a single session, not a pool.

**Snapshot** (`writeSnapshot`, `readSnapshot`, `checkSnapshot`): `{ format: 1, postgrest: { release, commit? }, pgVersionNum, config, supplementaryFormat: 1, supplementary, dump }`. Key order is fixed at the top level and sorted below it, so the same data is the same bytes. `checkSnapshot` returns `{ ok }` or `{ reason: 'missing' | 'invalid' | 'drift', differences }` and never writes. The config is redacted (`db-uri`, `jwt-secret` and any key naming a secret or `app.settings.*` are dropped; the planner ignores them), and every error and log line is scrubbed of connection-string passwords, `PGPASSWORD`, `PGRST_*` values and the password of the given URL. Errors are `SchemaAcquisitionError` with a `code`.

**Supplementary catalog** (`Supplementary`): the planner's format-1 document (`relations` with column ordinals, `composites`, `foreignKeys`, `functions`; `plannerSupplementary` projects exactly that part, and a test keeps it equal to the planner's fixture) plus mapper-only keys the planner ignores:

- per relation: `kind`, `viewDefinition` (`pg_get_viewdef`), `updatable` (`pg_relation_is_updatable`), and per column `type`, `notNull`, `hasDefault`, `identity`, `generated`;
- per function: `language`, `source` (`prosrc` of a `LANGUAGE sql` function) and `argNames`;
- `enums`, and `jsonSchemaChecks` (every CHECK that mentions `json(b)_matches_schema`, with `convalidated`);
- `referencedRelations`: relations outside the exposed schemas that an exposed view selects from, transitively (through `pg_rewrite` / `pg_depend`), so the tracer can follow a view into a private schema. A relation mentioned only inside a function body is not tracked (Postgres records no dependency for it), so the tracer sees it as unknown and its columns as nullable. `pg_catalog`, `information_schema` and `pg_toast` are never included.

Everything else covers exactly the exposed schemas (`db-schemas` of the config dump).

Pure builders turn it into the other components' inputs: `buildTraceCatalog` and `buildFunctionTraceInputs` for the tracer, and `buildJsonSchemaInput` for `jsonSchemaToTs`. The last is asynchronous (it parses constraint definitions with libpg_query) and reports only validated constraints that are plain conjunctions of `json(b)_matches_schema('<constant>', col)` terms, each optionally guarded by `col IS NULL OR` where `col` is the same plain column the call validates (a guard on an expression or another column makes the constraint ignored); several constraints on a column become an `allOf`, and everything else lands in `ignored` with its reason.

## Project generator

The whole pipeline behind the content mapper, as a library (a CLI `generate` command will call the same functions):

```ts
const { text, identity, watchedFiles, diagnostics, optionDiagnostics, keys, cache } =
  await generateDeclarations({
    projectDir: '.', // or { configFileName: './tsconfig.json' }
    options: { postgrest: '14.4', schema: { source: 'supabase-local' }, defaultSchema: 'public' },
    deps: { logger }, // GeneratorDeps, all optional
  })
```

`createGenerator(deps)` returns `{ generate({ configFileName, options }), close() }` and keeps the planner host and the acquired schemas for as long as it lives; `createProjectGenerator(deps)` is the same behind the content mapper's `ProjectGenerator` contract. `deps`: `fs`, `schema` (acquisition deps), `env`, `cwd`, `wasmPath`, `createHost`, `createTracer`, `plannerStamp`, `cacheDirectory` (a function, or `false` for no disk cache), `importFrom`, `logger`. Invalid options give `optionDiagnostics` and `export {}`; a missing snapshot or database URL is an option diagnostic at `schema.path` / `schema.dbUrlEnv`; other acquisition failures are diagnostic 2002, a planner that cannot start 2003, a scan failure 2004, anything unexpected 2005 (all with `start: 0, length: 0`, so `tsc` shows them at the top of the index file).

Steps of one `generate`:

1. **Files**: `resolveProjectFiles` reads the tsconfig (`files`, `include`, `exclude`, `extends`; JSONC) and keeps the TypeScript/JavaScript sources, or the files matching `options.scan`.
2. **Scan** the files for builder chains (`scanFiles`) and **derive keys** (`planKeysOf`). A key is `${kind}|${schema}|${relation}|${select}` where `kind` is `r` for reads and `w` for mutations followed by `.select()`, and `select` is the string as written, not normalised, exactly what the consumer's lookup builds. The planner request carries `normalizeSelect(select)` (whitespace removed outside double quotes), which is what postgrest-js sends. A bare `*` select has no entry (the consumer derives it from `SupabaseDatabase`). A chain that may live in several schemas gets a key per candidate schema; a relation missing from one of them is not an error. Pairs the scanner could not connect to a chain are planned speculatively and printed only when they plan. An RPC chain's key is `f|${schema}|${function}|${select}` (a bare `*` too: it dispatches the call) and carries neither the key set nor the method: those are the `calls` of the entry. An operand's key is the select's key plus `|${operand}`. Both are planned too, with one id each in `keys` and in the cache: `call|${schema}|${function}|${select}|${JSON keys}|${method}` per call, `op|${operand key}` per relation operand and `rpcop|${operand key}|${JSON keys}|${method}` per call of an RPC operand.
3. **Schema**: acquired per `options.schema` (a snapshot is re-read on every run and watched; live sources are memoised per process). The schema id is the hash of the acquired schema.
4. **Plan** the keys the cache lacks with `planMany` (`GET` with `Accept-Profile` for `r`; `POST` with body `{}`, `Content-Profile` and `Prefer: return=representation` for `w`; an RPC call is `POST /rpc/fn` with the key set as a JSON body or, for `GET` and `HEAD`, as query parameters; an operand is the select plus `operand=is.null`). A planner failure becomes an `{ error }` entry (`CODE: message`, then `Hint: ...`), except a failure of a speculative pair, or a missing relation when the chain could be in several schemas, which are dropped. `HOST_*` failures are never cached.
5. **Print** `printSelects` + `printDatabase`, spliced by `printModule`.

`identity` is the hash of the schema id, the sorted keys, `GENERATOR_REVISION`, the planner build, the options and `importFrom`: it changes when anything the text depends on changes, and only then. `watchedFiles` are the scanned files plus the snapshot.

**Entries** (`printSelects`): a planned key is `{ row, sources, embeds }`: `row` has every source-backed leaf as `SupabaseColumnType<'schema.relation.column', T>` (nullability outside the wrapper, base-column key through views; aggregates, casts and JSON paths are plain types), to-many embeds are arrays, a nullable embed is `| null`, spreads are merged into the parent per `outputs`; `sources` maps each output name to its column fact; `embeds` maps the dotted embed path to `{ path, outputs, join, cardinality }`.

```ts
'r|public|users|username, messages(id, channels(id))': {
  row: { username: SupabaseColumnType<'public.users.username', string>; messages: { id: SupabaseColumnType<'public.messages.id', number>; channels: { id: SupabaseColumnType<'public.channels.id', number> } }[] }
  sources: { username: 'username' }
  embeds: {
    messages: { path: ['messages']; outputs: [['messages']]; join: 'left'; cardinality: 'many' }
    'messages.channels': { path: ['messages', 'channels']; outputs: [['messages', 'channels']]; join: 'left'; cardinality: 'one' }
  }
}
```

A rejected key is `{ error: "PGRST200: Could not find a relationship ..." }`, which the consumer shows as the builder's error.

**Cache**: `<projectDir>/node_modules/.cache/postgrest-mapper/postgrest-mapper-<first 32 hex of the schema id>.json`, one file per schema: `{ format, generator, planner, schema, context: { plans, traces, jsonSchemas, diagnostics }, entries: { [id]: { shape, degraded } | { call: { form, shape, rpc, returns, filters, degraded } } | { error, code } } }`. A run whose keys are all cached (`cache: 'hit'`) starts no planner and loads no schema; with some keys cached the run is `'partial'` and plans the rest. A stale, unreadable or differently-versioned file is a miss.

**RPC entries** (`printRpcEntry`): `{ calls: [...] }`, one call per (key set, method) the project sends, sorted. The key sets are the consumer's: the literal keys of the `args` object, plus (because the consumer also looks up the key sets of optional keys, or keys whose type includes `undefined`, left out) every strict subset that drops only keys some overload takes as optional; an `args` that is not an object literal is planned per overload (required keys plus every subset of up to 6 optional ones). Overloads are the planner's to resolve: an ambiguous key set (`PGRST203`) or one no function takes (`PGRST202`) is a call `{ keys, method, error }`; a failure of a subset the project does not send is dropped. A function no candidate schema defines gets no entry (the consumer reports it). A call is `{ keys, method, form, row, source }` plus, for a projected select, `sources` and `embeds`: `form` is `'rows'` (a table, a composite or a scalar returned as a set), `'single-row'` or `'single-scalar'`; `row` comes from the plan's `shape`, and for a scalar from the function's return type (`routine.returnType`, which the planner reports untyped): `T | null` for one value, `T` per element of a set, `null` for `void`. The root fields of a function's rows are nullable (`reason: 'function-rows'`) and typed by the column's own type, not its JSON Schema. `source` is the select-`*` plan of the same call (`never` for a scalar).

```ts
'f|public|function_returning_set_of_rows|username, messages(id)': {
  calls: [
    {
      keys: never
      method: 'POST'
      form: 'rows'
      row: { username: SupabaseColumnType<'public.users.username', string> | null; messages: { id: SupabaseColumnType<'public.messages.id', number> }[] }
      source: { row: { ... }; sources: { ... } }
      sources: { username: 'username' }
      embeds: {
        messages: { path: ['messages']; outputs: [['messages']]; join: 'left'; cardinality: 'many' }
      }
    },
  ]
}
```

**Operands** (`printOperands`, `interface SupabaseOperands`): the key of every filter or order operand the scanner reports that is not a plain column of the row (the consumer reads those from the builder's row), planned as `select=<select>&<operand>=is.null` and typed from the planner's `filters`: `{ type, embed? }` (`type` is `SupabaseColumnType<key, T>` of the column the filter reaches, through views; `PgrstJson` / `PgrstJsonText` of it for a JSON path; `embed` is the embed path of the column), `{ type: unknown; embed: [...] }` for a tested embed (`.not('channels', 'is', null)`), `{ error }` when the planner rejects the request. An RPC's entry is `{ calls: [{ keys, method, type, embed? } | { keys, method, error }] }`, one per call of the chain. An operand through a `referencedTable` option has no entry: its key is never looked up. A column the planner cannot resolve because the catalog does not describe it (a computed field, the columns of an RPC returning a table type) is `unknown`.

```ts
'r|public|messages|id, channels(id, slug)|channels.slug': { type: SupabaseColumnType<'public.channels.slug', string>; embed: ['channels'] }
```

## Planner host and database declarations

The acquire, plan, print pipeline for the `SupabaseDatabase` global (design v5 §5.1). Pure and typed; I/O is injected.

```ts
const acquired = await acquireSchema({ source: 'supabase-local', workdir: '.' })
const host = createPlannerHost() // { wasmPath?, loadTimeoutMs = 20000, planTimeoutMs = 2000, logger? }
const tracer = await createTracer()
const { text, diagnostics } = await buildDatabaseDeclarations({ acquired, host, tracer, logger })
await host.close()
```

**`createPlannerHost`** (`src/host/`) runs `@supabase/postgrest-planner` in a `worker_threads` worker, because the wasm runtime cannot be interrupted. Calls are serialised. A `load` over 20 s or a `plan` over 2 s terminates the worker; the next call starts a new one and reloads the cache from the inputs the host kept. `load(acquired)`, `plan(request)` and `planMany(requests)` never throw for planner failures: the result is the planner's own `PlannerError` value, or one with a `HOST_ERROR` code (`HOST_TIMEOUT`, `HOST_WORKER_FAILED` for a crash or a missing wasm, `HOST_NOT_LOADED`, `HOST_CLOSED`). `wasmPath` defaults to the planner package's copy.

**`buildDatabaseDeclarations`** (`src/generate/`) loads the schema into the host, plans `GET /<relation>?select=*` for every exposed relation (the printed `ResultShape` is `Row`), traces views for nullability, converts JSON Schema CHECKs, and calls the printer. Relations outside the PostgREST schema cache (partitions) are left out with an `info` diagnostic; a load failure is an `error` diagnostic with an empty `text`. `module: { selects, operands, unplanned, importFrom }` passes through to `printModule`.

**Printer** (`src/printer/`): `printDatabase` emits the members of `interface SupabaseDatabase` per exposed schema, `printModule` wraps them in the declaration file (`Json` / `JsonIn`, `declare global`, `SupabasePgrstStatus`). `selects` and `operands` are the extension point for the select index: complete `interface SupabaseSelects { ... }` / `interface SupabaseOperands { ... }` text spliced verbatim into the same `declare global`.

- Every source column value is `SupabaseColumnType<'schema.relation.column', Derived>`, the column's own nullability outside the wrapper. A view column traced to a base column uses the base column's key and the traced nullability. A validated JSON Schema CHECK is the `Derived` type of its column.
- `Insert` requires a column only when it is `NOT NULL` with no default and no identity; generated columns and `GENERATED ALWAYS` identities are left out of `Insert` and `Update`. Views get `Insert` / `Update` only when `pg_relation_is_updatable` says so (every column optional).
- `FactColumns`: plain columns that are not `json(b)`, composite or row types. `Relationships` come from the PostgREST schema dump (many-to-one and one-to-one children).
- Functions: `Args` / `Returns` with overloads as a union; arguments with a default are optional; trigger functions are left out.
- Type mapping (`tsTypeOf`, `src/printer/pg-types.ts`): `bool` is `boolean`; `int2` `int4` `int8` `float4` `float8` `numeric` are `number`; `text`, `varchar`, `bpchar`, `uuid`, `bytea`, the date and time types, `citext` and `vector` are `string`; `json` / `jsonb` are `Json` (`JsonIn` in function arguments); `void` is `undefined`; enums are label unions, composites objects with nullable attributes, relation types their `Row`, domains resolve to their base type; arrays append `[]`; anything else (ranges, `tsvector`, `inet`, ...) is `unknown`.

## CLI

`postgrest-mapper` (`bin/postgrest-mapper.cjs`) is a thin front end: it parses arguments, builds the injected dependencies and calls the library. `runCli(argv, { stdout, stderr, fs?, env?, cwd?, deps?, signal?, watch?, debounceMs?, version? })` (`src/cli/`) is the whole program and resolves to the exit code (0 success, 1 failure, 2 usage error), so it runs in-process in tests.

```sh
postgrest-mapper generate --project tsconfig.json --out src/supabase.types.d.ts [--check | --watch]
postgrest-mapper print --project tsconfig.json
postgrest-mapper refresh --project tsconfig.json [--out src/supabase.types.d.ts]
postgrest-mapper init --project tsconfig.json [--out src/supabase.types.d.ts]
postgrest-mapper snapshot --out supabase/postgrest-schema.json [--check] [--workdir dir] [--schema-source postgrest --db-url-env NAME]
```

- The mapper options come from the tsconfig's `contentMappers` entry for `.pgrst-index`; `--schema-source`, `--snapshot` and `--db-url-env` replace the matching part of its `schema` option. Diagnostics print as `file:line:col code message` (option problems at the value in the tsconfig) and exit 1; nothing is written then.
- `generate --check` never writes and prints the first differing lines when the file is stale. `--watch` regenerates (debounced) when a scanned file, the snapshot or the tsconfig changes, and stops on SIGINT. It watches the directories of those files without recursing, so a file in a new directory is picked up at the next run.
- `init` adds the file to the tsconfig's `include` (or `files`), and to `compilerOptions.types` of a `deno.json(c)` beside it. It edits the text in place, so comments and formatting stay (a new property is inserted in the style of the neighbouring ones); a second run changes nothing. It does not add the `contentMappers` entry.
- `refresh` removes `node_modules/.cache/postgrest-mapper` of the project and regenerates.

## Node

Compiled to CommonJS like the planner. `oxc-parser` and `@supabase/pg-parser` load ESM (the latter through its wasm loader), so the CJS build relies on `require(esm)` (Node `^20.19.0 || >=22.12.0`). Jest cannot do that itself: `test/support/oxc-parser.cjs` and `test/support/pg-parser.cjs` map the imports to Node's real `require`.

## Development

```sh
pnpm nx build postgrest-mapper
pnpm nx test postgrest-mapper
```

`test/method-drift.test.ts` reads the postgrest-js builder sources and fails when the scanner's method lists drift from the builders' column-taking methods.
