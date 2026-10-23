# @supabase/postgrest-mapper

Private for now. The scanner of the postgrest builder planner (design v5 §4.2, §4.3): a syntax-only pass over TS/TSX that finds supabase/postgrest builder chains and records what must be planned. A library with a typed API: all I/O is injected or explicit, nothing reads `process.cwd` or prints.

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

- Converted: `type` (string or array), `enum`, `const`, `properties`, `required`, `additionalProperties`, `items` (schema or array form), `prefixItems`, `additionalItems`, `minItems` (tuples only), `anyOf` / `oneOf` (unions), `allOf` (intersections), `nullable: true`, local `$ref` (`#`, `#/$defs/...`, `#/definitions/...`, any JSON pointer), and the boolean schemas (`true` is `Json`, `false` is `never`).
- Objects: `additionalProperties: false` closes the object. Otherwise (absent, `true` or a schema) an index signature `[k: string]: V` is added, where `V` is the additional type (`Json` by default), plus every named property type that is not already a `Json`, plus `undefined` when a named property is optional, because TypeScript requires named properties to fit the index signature. A required name without a `properties` entry takes the open type. A closed object with no properties is `{ [k: string]: never }`.
- Widened to `unknown` at that position: `patternProperties` (the open positions of that object), a recursive, remote, malformed or unresolvable `$ref`, an unknown `type`, a non-schema value, nesting deeper than 64 levels.
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
- `catalog.relations`: per base relation `{ schema, name, kind, columns: [{ name, notNull, type? }] }`, columns in attribute order. `kind: 'table'` (partitioned tables too) uses `notNull`; `'view'` is traced from `definition` (`pg_get_viewdef`) or taken from `traced` (a previous result), so views over views compose; `'other'` (foreign tables, composite types) is all nullable. Views are traced recursively on demand, once per `trace` call, with a cycle guard (a view that reaches itself is all nullable); a view that cannot be traced is all nullable and never fails the caller.
- `catalog.searchPath`: schemas searched in order for an unqualified relation, default `['public']`. Use the search path the definitions were rendered under.
- `parameters` / `functionName` (function bodies): a name that is not a column of the query, `function_name.param` and `$n` resolve to a parameter, an expression of unknown nullability.

Output (`TraceResult`): `columns[i] = { nullable, source?, reason? }` and `error?`. `source` is `{ schema, relation, column }` and is set when the column is a plain pass-through of a base table column (through views, subqueries, CTEs, joins and set operations whose arms agree), whatever its nullability. `reason` is set when `nullable`. The tracer reports provenance and nullability only: the function's volatility and single-row composite returns (design v5 §4.3) are for the caller.

Rules (design v5 §6.2, conservative: anything not proven non-null is nullable):

- Set operations: `UNION` is non-null only when every arm is, `INTERSECT` when any arm is, `EXCEPT` follows the left arm. Each arm is judged by the rules below.
- `GROUPING SETS`, `ROLLUP`, `CUBE`: column references are nullable.
- Plain column: its base column's `NOT NULL`, unless its relation is the nullable side of a `LEFT` / `RIGHT` / `FULL` join. `INNER` and `CROSS` joins preserve it. `USING` / `NATURAL` merge columns (the left value, the right one for `RIGHT`, nullable for `FULL`).
- `count(...)` (also with `FILTER` or `OVER`) and non-null constants are non-null. `COALESCE` is non-null when an argument is. `VALUES` needs every row to prove the column.
- Every other expression is nullable: other aggregates, window functions, scalar subqueries, `CASE`, operators, function calls, whole-row references, functions in `FROM`.
- Beyond the flowchart: a cast of a non-null expression to a built-in type is non-null (`pg_get_viewdef` wraps many columns in one); a cast to any other type is nullable. A cast drops provenance.
- Subqueries in `FROM`, `LATERAL`, and `WITH` (including recursive: the self reference is nullable) are traced with the same rules.

## Node

Compiled to CommonJS like the planner. `oxc-parser` and `@supabase/pg-parser` load ESM (the latter through its wasm loader), so the CJS build relies on `require(esm)` (Node `^20.19.0 || >=22.12.0`). Jest cannot do that itself: `test/support/oxc-parser.cjs` and `test/support/pg-parser.cjs` map the imports to Node's real `require`.

## Development

```sh
pnpm nx build postgrest-mapper
pnpm nx test postgrest-mapper
```

`test/method-drift.test.ts` reads the postgrest-js builder sources and fails when the scanner's method lists drift from the builders' column-taking methods.
