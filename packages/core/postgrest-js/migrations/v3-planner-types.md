# v3: planner-typed builders

**Since:** v3.0.0
**Applies to:** anyone using `@supabase/postgrest-js` (or `@supabase/supabase-js`) with TypeScript

## Your code keeps working

In the common case, v2 code compiles on v3 unchanged.

A chain that the generated declarations don't cover types its rows from the `Database` you pass, for example `createClient<Database>()` with a `supabase gen types` Database:

- A query gets the relation's `Row`. Its own keys keep their types, and any other key is `any`, because the select may alias or embed.
- An rpc result comes from the function's `Returns`. An array `Returns` gives rows.
- A Database without named columns, or no Database at all, gives `Record<string, unknown>` rows.

```ts
// notes: { id: number; body: string | null; owner: string }
const { data } = await supabase.from('notes').select('id, body, mine:owner')
// data: ({ id: number; body: string | null; owner: string } & { [k: string]: any })[]
// data[0].id is number, data[0].mine is any
```

## What's new

The real PostgREST planner (upstream PostgREST compiled to wasm) now types your queries. Results, filter operands, order columns, rpc arguments and results, and insert and update payloads all come from declarations that the `@supabase/postgrest-mapper` generator writes. A query PostgREST would reject becomes a type error in strict mode.

See [How planner types work](../../../../docs/PLANNER_TYPES.md) for the details.

## Step 1: set up generation

Run the mapper's `init` command in your project:

```sh
npx postgrest-mapper init
```

It configures the project, writes the schema snapshot `supabase/postgrest-schema.json` from your running local stack, generates the declarations once, and adds the `postgrest:watch`, `postgrest:check` and `postgrest:snapshot` package scripts. A step that cannot run (for example, the stack is down) is reported as skipped. `--skip-snapshot`, `--skip-generate` and `--skip-scripts` turn a step off.

Then:

- Commit the snapshot, and re-run `postgrest:snapshot` after each migration.
- In CI, run `postgrest:check`. It reads the committed snapshot and needs no database.
- During development, run `postgrest:watch`. It polls the live schema and regenerates on change.

The `@supabase/postgrest-mapper` package must be a dependency of the project, because the scripts call its binary.

Once declarations exist, you can drop the type arguments. `createClient(url, key)` reads the global `SupabaseDatabase`:

```diff
- const supabase = createClient<Database>(url, key)
+ const supabase = createClient(url, key)
```

## Step 2: opt into strictness

The Database fallback lasts until a chain is generated. Once every chain is generated, make an ungenerated chain a type error. This also disables the fallback:

```ts
declare global {
  interface SupabasePgrstStatus {
    unplanned: 'error'
  }
}
export {}
```

## Step 3: replace deprecated forms

These forms still work. Move to the new ones when convenient.

### `.returns<T>()`

It still replaces the whole `data`: an array for rows, one object after `.single()`. Prefer `.cast<Row>()`, which takes the type of one row.

```diff
- .select('id, name').returns<Foo[]>()
+ .select('id, name').cast<Foo>()
```

### `.overrideTypes<T, { merge?: boolean }>()`

It keeps its v2 semantics, applied on top of the planner's result: it merges by default, and `{ merge: false }` replaces. Prefer `.cast<T>()`, or `SupabaseColumnTypes` to override a column everywhere it appears.

```diff
- .select('id, status').overrideTypes<{ id: number }[], { merge: false }>()
+ .select('id, status').cast<{ id: number }>()
```

```ts
declare global {
  interface SupabaseColumnTypes {
    'public.readings.samples': (number | null)[]
  }
}
export {}
```

### `foreignTable`

The `foreignTable` option on `.order()`, `.limit()`, `.range()`, `.or()` and `.filter()` is an alias of `referencedTable`. When both are given, `referencedTable` wins.

```diff
- .order('name', { foreignTable: 'instruments', ascending: false })
+ .order('name', { referencedTable: 'instruments', ascending: false })
```

### Client generics

These forms are accepted, and the options object is ignored:

- `createClient<Database, { PostgrestVersion: '12' }>()`
- `createClient<Database, { PostgrestVersion: '12' }, 'schema'>()`
- `createClient<Database, 'schema'>()`

The `PostgrestClientOptions` type is still exported, and deprecated.

The v3 form takes no type arguments once declarations are generated.

```diff
- createClient<Database, { PostgrestVersion: '12' }>(url, key)
+ createClient(url, key)
```

## Step 4: rare breaking changes

- **TypeScript 5.1 or later is required.** The builders use `const` type parameters, and the argument checks rely on template literal inference that TypeScript 5.0 doesn't do.
- **Builder type arguments changed shape.** If you wrote `PostgrestFilterBuilder<...>` or another builder type by hand, let inference work instead. With `@supabase/supabase-js`, `QueryData<typeof query>`, `QueryResult<typeof query>` and `QueryError` give the result types.
- **`UnstableGetResult` is removed.** It wrapped the v2 type-level select parser, which no longer exists.
- **The 4th and 5th type parameters of v2 `SupabaseClient` (`Schema`, `ClientOptions`) are removed.**
- **`overrideTypes<T, {}>()` now merges.** v2 replaced when you passed an explicit empty options object. Pass `{ merge: false }` to replace.
- **`.rpc(fn, args, { get: true })` can fail with `PGRSTJS01`.** `GET` and `HEAD` send the arguments in the query string, so the client refuses a call it can't encode faithfully, before any network call. The result is `{ data: null, error }` with `error.code === 'PGRSTJS01'` (it throws after `.throwOnError()`). It happens for:
  - a reserved key: `select`, `columns`, `on_conflict`, or a key ending in `.order`, `.limit`, `.offset`, `.and` or `.or`
  - an object value, or an array containing one
  - a string value PostgREST would read as a filter, such as `'eq.x'` or `'in.(1,2)'`

  Use `POST` (no `get`) for those calls. The same refusal applies to `head: true`.
