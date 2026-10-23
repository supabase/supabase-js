import PostgrestBuilder from './PostgrestBuilder'
import type PostgrestFilterBuilder from './PostgrestFilterBuilder'
import { normalizeSelect } from './normalizeSelect'
import type { InvalidMethodError } from './PostgrestFilterBuilder'
import type { Gate, HasRef, RefFacts } from './types/planner/facts'
import type { PgrstFeature } from './types/planner/globals'
import type {
  BS,
  BState,
  ColArg,
  Desc,
  Descs,
  MState,
  SetM,
  Validate,
} from './types/planner/lookup'
import type {
  KeepHead,
  OrCount,
  RefOpts,
  SelCount,
  SelOp,
  SelectOptions,
} from './types/planner/options'

/** Options of `order()`. */
export type OrderOptions = RefOpts & { ascending?: boolean; nullsFirst?: boolean }

/** Options of `explain()`. */
export type ExplainOptions = {
  analyze?: boolean
  verbose?: boolean
  settings?: boolean
  buffers?: boolean
  wal?: boolean
  format?: 'json' | 'text'
}

// the formats `explain()` may ask for, per member of a union of option bags: an absent bag, an absent, optional or
// `undefined` format is the default, text
type ExplainFormats<O> = O extends unknown
  ? 'format' extends keyof O
    ? [O['format']] extends [undefined]
      ? 'text'
      : Exclude<O['format'], undefined> | (undefined extends O['format'] ? 'text' : never)
    : 'text'
  : never
// the body per possible format: the text plan, or the JSON plan, an array that `maybeSingle()` unwraps at runtime
type ExplainBody<O, M extends MState> =
  ExplainFormats<O> extends infer Fm
    ? Fm extends 'json'
      ? M['card'] extends 'maybe'
        ? Record<string, unknown>
        : Record<string, unknown>[]
      : string
    : never

export default class PostgrestTransformBuilder<
  B extends BState,
  E,
  F,
  M extends MState,
> extends PostgrestBuilder<B, E, F, M> {
  /**
   * Perform a SELECT on the query result.
   *
   * By default, `.insert()`, `.update()`, `.upsert()`, and `.delete()` do not
   * return modified rows. By calling this method, modified rows are returned in
   * `data`.
   *
   * @param columns - The columns to retrieve, separated by commas
   *
   * @category Database
   * @subcategory Using modifiers
   *
   * @example With `upsert()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .upsert({ id: 1, name: 'Han Solo' })
   *   .select()
   * ```
   *
   * @exampleSql With `upsert()`
   * ```sql
   * create table
   *   characters (id int8 primary key, name text);
   *
   * insert into
   *   characters (id, name)
   * values
   *   (1, 'Han');
   * ```
   *
   * @exampleResponse With `upsert()`
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "name": "Han Solo"
   *     }
   *   ],
   *   "status": 201,
   *   "statusText": ""
   * }
   * ```
   */
  select<const Q extends string = '*', const O extends SelectOptions | undefined = {}>(
    columns?: Validate<B, Q>,
    // a rest tuple: an optional parameter would drop `undefined` from the inferred `O`, and a bag that may be absent is
    // one more possible request
    ...rest: [] | [options: O]
  ): PostgrestFilterBuilder<
    BS<B['k'], B['s'], B['r'], B['row'], B['st'], Q, B['km']>,
    Descs<B, Q>,
    F,
    SetM<M, { op: SelOp<B, M, O>; ret: true; count: OrCount<M['count'], SelCount<O>> }>
  >
  select(columns?: string, options?: SelectOptions): any {
    const cleanedColumns = normalizeSelect(columns ?? '*')
    this.url.searchParams.set('select', cleanedColumns)
    this.headers.append('Prefer', 'return=representation')
    if (options?.count) {
      this.headers.append('Prefer', `count=${options.count}`)
    }
    if (options?.head && this.method === 'GET') {
      this.method = 'HEAD'
    }
    return this as any
  }

  /**
   * Order the query result by `column`.
   *
   * You can call this method multiple times to order by multiple columns.
   *
   * You can order referenced tables, but it only affects the ordering of the
   * parent table if you use `!inner` in the query.
   *
   * @param column - The column to order by
   * @param options - Named parameters
   * @param options.ascending - If `true`, the result will be in ascending order
   * @param options.nullsFirst - If `true`, `null`s appear first. If `false`,
   * `null`s appear last.
   * @param options.referencedTable - Set this to order a referenced table by
   * its columns
   *
   * @category Database
   * @subcategory Using modifiers
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select('id, name')
   *   .order('id', { ascending: false })
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   characters (id int8 primary key, name text);
   *
   * insert into
   *   characters (id, name)
   * values
   *   (1, 'Luke'),
   *   (2, 'Leia'),
   *   (3, 'Han');
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 3,
   *       "name": "Han"
   *     },
   *     {
   *       "id": 2,
   *       "name": "Leia"
   *     },
   *     {
   *       "id": 1,
   *       "name": "Luke"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @exampleDescription On a referenced table
   * Ordering with `referencedTable` doesn't affect the ordering of the
   * parent table.
   *
   * @example On a referenced table
   * ```ts
   *   const { data, error } = await supabase
   *     .from('orchestral_sections')
   *     .select(`
   *       name,
   *       instruments (
   *         name
   *       )
   *     `)
   *     .order('name', { referencedTable: 'instruments', ascending: false })
   *
   * ```
   *
   * @exampleSql On a referenced table
   * ```sql
   * create table
   *   orchestral_sections (id int8 primary key, name text);
   * create table
   *   instruments (
   *     id int8 primary key,
   *     section_id int8 not null references orchestral_sections,
   *     name text
   *   );
   *
   * insert into
   *   orchestral_sections (id, name)
   * values
   *   (1, 'strings'),
   *   (2, 'woodwinds');
   * insert into
   *   instruments (id, section_id, name)
   * values
   *   (1, 1, 'harp'),
   *   (2, 1, 'violin');
   * ```
   *
   * @exampleResponse On a referenced table
   * ```json
   * {
   *   "data": [
   *     {
   *       "name": "strings",
   *       "instruments": [
   *         {
   *           "name": "violin"
   *         },
   *         {
   *           "name": "harp"
   *         }
   *       ]
   *     },
   *     {
   *       "name": "woodwinds",
   *       "instruments": []
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @exampleDescription Order parent table by a referenced table
   * Ordering with `referenced_table(col)` affects the ordering of the
   * parent table.
   *
   * @example Order parent table by a referenced table
   * ```ts
   *   const { data, error } = await supabase
   *     .from('instruments')
   *     .select(`
   *       name,
   *       section:orchestral_sections (
   *         name
   *       )
   *     `)
   *     .order('section(name)', { ascending: true })
   *
   * ```
   *
   * @exampleSql Order parent table by a referenced table
   * ```sql
   * create table
   *   orchestral_sections (id int8 primary key, name text);
   * create table
   *   instruments (
   *     id int8 primary key,
   *     section_id int8 not null references orchestral_sections,
   *     name text
   *   );
   *
   * insert into
   *   orchestral_sections (id, name)
   * values
   *   (1, 'strings'),
   *   (2, 'woodwinds');
   * insert into
   *   instruments (id, section_id, name)
   * values
   *   (1, 2, 'flute'),
   *   (2, 1, 'violin');
   * ```
   *
   * @exampleResponse Order parent table by a referenced table
   * ```json
   * {
   *   "data": [
   *     {
   *       "name": "violin",
   *       "orchestral_sections": {"name": "strings"}
   *     },
   *     {
   *       "name": "flute",
   *       "orchestral_sections": {"name": "woodwinds"}
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  order<const C extends string, const O extends OrderOptions = {}>(
    // a referencedTable order column belongs to the embed: not checked against the root
    column: HasRef<O> extends true ? C : ColArg<B, C>,
    options?: O
  ): PostgrestFilterBuilder<B, E, F, M>
  order(
    column: string,
    {
      ascending = true,
      nullsFirst,
      referencedTable,
    }: {
      ascending?: boolean
      nullsFirst?: boolean
      referencedTable?: string
    } = {}
  ): any {
    const key = referencedTable ? `${referencedTable}.order` : 'order'
    const existingOrder = this.url.searchParams.get(key)

    this.url.searchParams.set(
      key,
      `${existingOrder ? `${existingOrder},` : ''}${column}.${ascending ? 'asc' : 'desc'}${
        nullsFirst === undefined ? '' : nullsFirst ? '.nullsfirst' : '.nullslast'
      }`
    )
    return this
  }

  /**
   * Limit the query result by `rows`.
   *
   * @param rows - The maximum number of rows to return
   * @param options - Named parameters
   * @param options.referencedTable - Set this to limit rows of referenced
   * tables instead of the parent table
   *
   * @category Database
   * @subcategory Using modifiers
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select('name')
   *   .limit(1)
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   characters (id int8 primary key, name text);
   *
   * insert into
   *   characters (id, name)
   * values
   *   (1, 'Luke'),
   *   (2, 'Leia'),
   *   (3, 'Han');
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   * {
   *   "data": [
   *     {
   *       "name": "Luke"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @example On a referenced table
   * ```ts
   * const { data, error } = await supabase
   *   .from('orchestral_sections')
   *   .select(`
   *     name,
   *     instruments (
   *       name
   *     )
   *   `)
   *   .limit(1, { referencedTable: 'instruments' })
   * ```
   *
   * @exampleSql On a referenced table
   * ```sql
   * create table
   *   orchestral_sections (id int8 primary key, name text);
   * create table
   *   instruments (
   *     id int8 primary key,
   *     section_id int8 not null references orchestral_sections,
   *     name text
   *   );
   *
   * insert into
   *   orchestral_sections (id, name)
   * values
   *   (1, 'strings');
   * insert into
   *   instruments (id, section_id, name)
   * values
   *   (1, 1, 'harp'),
   *   (2, 1, 'violin');
   * ```
   *
   * @exampleResponse On a referenced table
   * ```json
   * {
   *   "data": [
   *     {
   *       "name": "strings",
   *       "instruments": [
   *         {
   *           "name": "violin"
   *         }
   *       ]
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  limit<const O extends RefOpts = {}>(
    rows: number,
    options?: O
  ): PostgrestFilterBuilder<B, E, F & Gate<B, RefFacts<O>>, M>
  limit(rows: number, { referencedTable }: { referencedTable?: string } = {}): any {
    const key = typeof referencedTable === 'undefined' ? 'limit' : `${referencedTable}.limit`
    this.url.searchParams.set(key, `${rows}`)
    return this
  }

  /**
   * Limit the query result by starting at an offset `from` and ending at the offset `to`.
   * Only records within this range are returned.
   * This respects the query order and if there is no order clause the range could behave unexpectedly.
   * The `from` and `to` values are 0-based and inclusive: `range(1, 3)` will include the second, third
   * and fourth rows of the query.
   *
   * @param from - The starting index from which to limit the result
   * @param to - The last index to which to limit the result
   * @param options - Named parameters
   * @param options.referencedTable - Set this to limit rows of referenced
   * tables instead of the parent table
   *
   * @category Database
   * @subcategory Using modifiers
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select('name')
   *   .range(0, 1)
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   characters (id int8 primary key, name text);
   *
   * insert into
   *   characters (id, name)
   * values
   *   (1, 'Luke'),
   *   (2, 'Leia'),
   *   (3, 'Han');
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   * {
   *   "data": [
   *     {
   *       "name": "Luke"
   *     },
   *     {
   *       "name": "Leia"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  range<const O extends RefOpts = {}>(
    from: number,
    to: number,
    options?: O
  ): PostgrestFilterBuilder<B, E, F & Gate<B, RefFacts<O>>, M>
  range(from: number, to: number, { referencedTable }: { referencedTable?: string } = {}): any {
    const keyOffset =
      typeof referencedTable === 'undefined' ? 'offset' : `${referencedTable}.offset`
    const keyLimit = typeof referencedTable === 'undefined' ? 'limit' : `${referencedTable}.limit`
    this.url.searchParams.set(keyOffset, `${from}`)
    // Range is inclusive, so add 1
    this.url.searchParams.set(keyLimit, `${to - from + 1}`)
    return this
  }

  /**
   * Set the AbortSignal for the fetch request.
   *
   * @param signal - The AbortSignal to use for the fetch request
   *
   * @category Database
   * @subcategory Using modifiers
   *
   * @remarks
   * You can use this to set a timeout for the request.
   *
   * @exampleDescription Aborting requests in-flight
   * You can use an [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) to abort requests.
   * Note that `status` and `statusText` don't mean anything for aborted requests as the request wasn't fulfilled.
   *
   * @example Aborting requests in-flight
   * ```ts
   * const ac = new AbortController()
   *
   * const { data, error } = await supabase
   *   .from('very_big_table')
   *   .select()
   *   .abortSignal(ac.signal)
   *
   * // Abort the request after 100 ms
   * setTimeout(() => ac.abort(), 100)
   * ```
   *
   * @exampleResponse Aborting requests in-flight
   * ```json
   *   {
   *     "error": {
   *       "message": "AbortError: The user aborted a request.",
   *       "details": "",
   *       "hint": "The request was aborted locally via the provided AbortSignal.",
   *       "code": ""
   *     },
   *     "status": 0,
   *     "statusText": ""
   *   }
   *
   * ```
   *
   * @example Set a timeout
   * ```ts
   * const { data, error } = await supabase
   *   .from('very_big_table')
   *   .select()
   *   .abortSignal(AbortSignal.timeout(1000 /* ms *\/))
   * ```
   *
   * @exampleResponse Set a timeout
   * ```json
   *   {
   *     "error": {
   *       "message": "FetchError: The user aborted a request.",
   *       "details": "",
   *       "hint": "",
   *       "code": ""
   *     },
   *     "status": 0,
   *     "statusText": ""
   *   }
   *
   * ```
   */
  abortSignal(signal: AbortSignal): this {
    this.signal = signal
    return this
  }

  /**
   * Return `data` as a single object instead of an array of objects.
   *
   * Query result must be one row (e.g. using `.limit(1)`), otherwise this
   * returns an error.
   *
   * @category Database
   * @subcategory Using modifiers
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select('name')
   *   .limit(1)
   *   .single()
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   characters (id int8 primary key, name text);
   *
   * insert into
   *   characters (id, name)
   * values
   *   (1, 'Luke'),
   *   (2, 'Leia'),
   *   (3, 'Han');
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   * {
   *   "data": {
   *     "name": "Luke"
   *   },
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  single(): PostgrestFilterBuilder<B, E, F, SetM<M, { card: 'one'; fmt: 'json' }>> {
    this.headers.set('Accept', 'application/vnd.pgrst.object+json')
    // the last of single() and maybeSingle() wins: the server answers with the object, nothing is left to unwrap
    this.isMaybeSingle = false
    return this as any
  }

  /**
   * Return `data` as a single object instead of an array of objects.
   *
   * Query result must be zero or one row (e.g. using `.limit(1)`), otherwise
   * this returns an error.
   *
   * @category Database
   * @subcategory Using modifiers
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .eq('name', 'Katniss')
   *   .maybeSingle()
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   characters (id int8 primary key, name text);
   *
   * insert into
   *   characters (id, name)
   * values
   *   (1, 'Luke'),
   *   (2, 'Leia'),
   *   (3, 'Han');
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   * {
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  maybeSingle(): PostgrestFilterBuilder<B, E, F, SetM<M, { card: 'maybe' }>> {
    // No Accept header override — we fetch as a list and enforce cardinality client-side.
    // Fixes https://github.com/supabase/postgrest-js/issues/361 for all request methods.
    // The last of single() and maybeSingle() wins: single()'s object header would make the server refuse zero rows.
    if (this.headers.get('Accept') === 'application/vnd.pgrst.object+json') {
      this.headers.delete('Accept')
    }
    this.isMaybeSingle = true
    return this as any
  }

  /**
   * Return `data` as a string in CSV format.
   *
   * @category Database
   * @subcategory Using modifiers
   *
   * @exampleDescription Return data as CSV
   * By default, the data is returned in JSON format, but can also be returned as Comma Separated Values.
   *
   * @example Return data as CSV
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .csv()
   * ```
   *
   * @exampleSql Return data as CSV
   * ```sql
   * create table
   *   characters (id int8 primary key, name text);
   *
   * insert into
   *   characters (id, name)
   * values
   *   (1, 'Luke'),
   *   (2, 'Leia'),
   *   (3, 'Han');
   * ```
   *
   * @exampleResponse Return data as CSV
   * ```json
   * {
   *   "data": "id,name\n1,Luke\n2,Leia\n3,Han",
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  csv(): PostgrestFilterBuilder<B, E, F, SetM<M, { fmt: 'csv' }>> {
    this.headers.set('Accept', 'text/csv')
    return this as any
  }

  /**
   * Return `data` as an object in [GeoJSON](https://geojson.org) format.
   *
   * @category Database
   * @subcategory Using modifiers
   */
  geojson(): PostgrestBuilder<
    B,
    Desc<Record<string, unknown>, {}, {}, 'one'>,
    F,
    SetM<M, { op: KeepHead<M['op']>; ret: true; card: 'default'; fmt: 'json'; strip: false }>
  > {
    this.headers.set('Accept', 'application/geo+json')
    return this as any
  }

  /**
   * Return `data` as the EXPLAIN plan for the query.
   *
   * You need to enable the
   * [db_plan_enabled](https://supabase.com/docs/guides/database/debugging-performance#enabling-explain)
   * setting before using this method.
   *
   * @param options - Named parameters
   *
   * @param options.analyze - If `true`, the query will be executed and the
   * actual run time will be returned
   *
   * @param options.verbose - If `true`, the query identifier will be returned
   * and `data` will include the output columns of the query
   *
   * @param options.settings - If `true`, include information on configuration
   * parameters that affect query planning
   *
   * @param options.buffers - If `true`, include information on buffer usage
   *
   * @param options.wal - If `true`, include information on WAL record generation
   *
   * @param options.format - The format of the output, can be `"text"` (default)
   * or `"json"`
   *
   * @category Database
   * @subcategory Using modifiers
   *
   * @exampleDescription Get the execution plan
   * By default, the data is returned in TEXT format, but can also be returned as JSON by using the `format` parameter.
   *
   * @example Get the execution plan
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .explain()
   * ```
   *
   * @exampleSql Get the execution plan
   * ```sql
   * create table
   *   characters (id int8 primary key, name text);
   *
   * insert into
   *   characters (id, name)
   * values
   *   (1, 'Luke'),
   *   (2, 'Leia'),
   *   (3, 'Han');
   * ```
   *
   * @exampleResponse Get the execution plan
   * ```js
   * Aggregate  (cost=33.34..33.36 rows=1 width=112)
   *   ->  Limit  (cost=0.00..18.33 rows=1000 width=40)
   *         ->  Seq Scan on characters  (cost=0.00..22.00 rows=1200 width=40)
   * ```
   *
   * @exampleDescription Get the execution plan with analyze and verbose
   * By default, the data is returned in TEXT format, but can also be returned as JSON by using the `format` parameter.
   *
   * @example Get the execution plan with analyze and verbose
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .explain({analyze:true,verbose:true})
   * ```
   *
   * @exampleSql Get the execution plan with analyze and verbose
   * ```sql
   * create table
   *   characters (id int8 primary key, name text);
   *
   * insert into
   *   characters (id, name)
   * values
   *   (1, 'Luke'),
   *   (2, 'Leia'),
   *   (3, 'Han');
   * ```
   *
   * @exampleResponse Get the execution plan with analyze and verbose
   * ```js
   * Aggregate  (cost=33.34..33.36 rows=1 width=112) (actual time=0.041..0.041 rows=1 loops=1)
   *   Output: NULL::bigint, count(ROW(characters.id, characters.name)), COALESCE(json_agg(ROW(characters.id, characters.name)), '[]'::json), NULLIF(current_setting('response.headers'::text, true), ''::text), NULLIF(current_setting('response.status'::text, true), ''::text)
   *   ->  Limit  (cost=0.00..18.33 rows=1000 width=40) (actual time=0.005..0.006 rows=3 loops=1)
   *         Output: characters.id, characters.name
   *         ->  Seq Scan on public.characters  (cost=0.00..22.00 rows=1200 width=40) (actual time=0.004..0.005 rows=3 loops=1)
   *               Output: characters.id, characters.name
   * Query Identifier: -4730654291623321173
   * Planning Time: 0.407 ms
   * Execution Time: 0.119 ms
   * ```
   */
  explain<const O extends ExplainOptions | undefined = {}>(
    ...rest: [] | [options: O]
  ): PostgrestBuilder<
    B,
    Desc<ExplainBody<O, M>, {}, {}, 'one'>,
    F,
    SetM<M, { op: KeepHead<M['op']>; ret: true; card: 'default'; fmt: 'json'; strip: false }>
  >
  explain({
    analyze = false,
    verbose = false,
    settings = false,
    buffers = false,
    wal = false,
    format = 'text',
  }: ExplainOptions = {}): any {
    const parts = [
      analyze ? 'analyze' : null,
      verbose ? 'verbose' : null,
      settings ? 'settings' : null,
      buffers ? 'buffers' : null,
      wal ? 'wal' : null,
    ]
      .filter(Boolean)
      .join('|')
    // An Accept header can carry multiple media types but postgrest-js always sends one
    const forMediatype = this.headers.get('Accept') ?? 'application/json'
    this.headers.set(
      'Accept',
      `application/vnd.pgrst.plan+${format}; for="${forMediatype}"; options=${parts};`
    )
    return this
  }

  /**
   * Dry-run this request: execute the query but discard the changes.
   *
   * Server-side, PostgREST runs the query inside a transaction and rolls it back
   * instead of committing. The response still contains the data that *would* have
   * been returned — `RETURNING` clauses execute and RLS, triggers, and constraints
   * are all evaluated — but no row is actually inserted, updated, or deleted.
   *
   * This affects only the single request it is chained to. The JS caller has no
   * handle on the transaction: supabase-js does not group multiple queries into
   * one transaction. For multi-statement transactional logic, use a database
   * function (`supabase.rpc(...)`).
   *
   * Sets the `Prefer: tx=rollback` header. See PostgREST's docs on transaction
   * preferences for the underlying mechanism.
   *
   * @category Database
   * @subcategory Using modifiers
   *
   * @example Validate an insert without persisting
   * ```ts
   * const { data, error } = await supabase
   *   .from('countries')
   *   .insert({ name: 'France' })
   *   .select()
   *   .rollback()
   * // `data` shows what would have been inserted; nothing is saved.
   * ```
   */
  rollback(): this {
    this.headers.append('Prefer', 'tx=rollback')
    return this
  }

  /**
   * Replace the type of the returned `data` with `T`.
   *
   * The new type is taken as is: it is not checked against the selected columns, and filter facts do not
   * narrow it. `.single()` and `.maybeSingle()` still decide the cardinality, so `T` is the type of one row.
   *
   * @typeParam T - The type of one row
   *
   * @category Database
   * @subcategory Using modifiers
   *
   * @example Cast a row
   * ```ts
   * const { data } = await supabase
   *   .from('countries')
   *   .select()
   *   .cast<{ id: number; name: string }>()
   * // data: { id: number; name: string }[]
   * ```
   */
  cast<T>(): PostgrestFilterBuilder<B, Desc<T>, F, M> {
    return this as any
  }

  /**
   * Set the maximum number of rows that can be affected by the query.
   * Only available in PostgREST v13+ and only works with PATCH and DELETE methods.
   *
   * @param rows - The maximum number of rows that can be affected
   *
   * @category Database
   * @subcategory Using modifiers
   */
  maxAffected(
    rows: number
  ): PgrstFeature<'maxAffected'> extends true
    ? M['ma'] extends true
      ? PostgrestFilterBuilder<B, E, F, M>
      : InvalidMethodError<'maxAffected method only available on update or delete'>
    : InvalidMethodError<'maxAffected method only available on postgrest 13+'> {
    this.headers.append('Prefer', 'handling=strict')
    this.headers.append('Prefer', `max-affected=${rows}`)
    return this as any
  }
}
