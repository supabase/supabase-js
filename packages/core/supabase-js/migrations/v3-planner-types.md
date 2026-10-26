# v3: planner-typed queries

**Since:** v3.0.0
**Applies to:** anyone using `createClient` with TypeScript

`createClient` now types queries with the PostgREST planner, through declarations that `@supabase/postgrest-mapper` generates.

- Your v2 code keeps compiling. A query without generated declarations is typed from the `Database` you pass to `createClient<Database>()`.
- `createClient<Database, { PostgrestVersion: '12' }>()` and the schema-name forms are accepted. The options object is ignored.
- Once declarations are generated, call `createClient(url, key)` with no type arguments. It reads the global `SupabaseDatabase`.
- Set `SupabasePgrstStatus['unplanned'] = 'error'` to turn an ungenerated query into a type error.
- `.returns<T>()`, `.overrideTypes<T>()`, `.single<T>()`, `.maybeSingle<T>()` and the `foreignTable` option still work but are deprecated. Use `.cast<Row>()` and `referencedTable`.
- The `DatabaseWithoutInternals` type is still exported, and deprecated. Use `Omit<Database, '__InternalSupabase'>`.
- An explicit row type on writes (`.insert<Row>(values)`, and the same on `upsert` and `update`) still compiles.
- TypeScript 5.1 or later is required. The 4th and 5th type parameters of `SupabaseClient` and `UnstableGetResult` are removed. `QueryData`, `QueryResult` and `QueryError` are still exported.

See the [postgrest-js migration guide](../../postgrest-js/migrations/v3-planner-types.md) for setup, diffs and the full list of breaking changes.
