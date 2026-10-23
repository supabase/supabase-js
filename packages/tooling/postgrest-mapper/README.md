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

## Node

Compiled to CommonJS like the planner. `oxc-parser` is ESM-only, so the CJS build relies on `require(esm)` (Node `^20.19.0 || >=22.12.0`). Jest cannot do that itself: `test/support/oxc-parser.cjs` maps the import to Node's real `require`.

## Development

```sh
pnpm nx build postgrest-mapper
pnpm nx test postgrest-mapper
```

`test/method-drift.test.ts` reads the postgrest-js builder sources and fails when the scanner's method lists drift from the builders' column-taking methods.
