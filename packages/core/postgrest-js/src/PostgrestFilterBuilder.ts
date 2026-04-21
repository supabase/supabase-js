import PostgrestTransformBuilder from './PostgrestTransformBuilder'
import { JsonPathToAccessor, JsonPathToType } from './select-query-parser/utils'
import { ClientServerOptions, GenericSchema } from './types/common/common'

type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'is'
  | 'isdistinct'
  | 'in'
  | 'cs'
  | 'cd'
  | 'sl'
  | 'sr'
  | 'nxl'
  | 'nxr'
  | 'adj'
  | 'ov'
  | 'fts'
  | 'plfts'
  | 'phfts'
  | 'wfts'
  | 'match'
  | 'imatch'

export type IsStringOperator<Path extends string> = Path extends `${string}->>${string}`
  ? true
  : false

const PostgrestReservedCharsRegexp = new RegExp('[,()]')

// Match relationship filters with `table.column` syntax and resolve underlying
// column value. If not matched, fallback to generic type.
// TODO: Validate the relationship itself ala select-query-parser. Currently we
// assume that all tables have valid relationships to each other, despite
// nonexistent foreign keys.
type ResolveFilterValue<
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  ColumnName extends string,
> = ColumnName extends `${infer RelationshipTable}.${infer Remainder}`
  ? Remainder extends `${infer _}.${infer _}`
    ? ResolveFilterValue<Schema, Row, Remainder>
    : ResolveFilterRelationshipValue<Schema, RelationshipTable, Remainder>
  : ColumnName extends keyof Row
    ? Row[ColumnName]
    : // If the column selection is a jsonpath like `data->value` or `data->>value` we attempt to match
      // the expected type with the parsed custom json type
      IsStringOperator<ColumnName> extends true
      ? string
      : JsonPathToType<Row, JsonPathToAccessor<ColumnName>> extends infer JsonPathValue
        ? JsonPathValue extends never
          ? never
          : JsonPathValue
        : never

type ResolveFilterRelationshipValue<
  Schema extends GenericSchema,
  RelationshipTable extends string,
  RelationshipColumn extends string,
> = Schema['Tables'] & Schema['Views'] extends infer TablesAndViews
  ? RelationshipTable extends keyof TablesAndViews
    ? 'Row' extends keyof TablesAndViews[RelationshipTable]
      ? RelationshipColumn extends keyof TablesAndViews[RelationshipTable]['Row']
        ? TablesAndViews[RelationshipTable]['Row'][RelationshipColumn]
        : unknown
      : unknown
    : unknown
  : never

export type InvalidMethodError<S extends string> = { Error: S }

type NonNullableColumn<T extends Record<string, unknown>, Col extends string> = Col extends keyof T
  ? { [K in keyof T]: K extends Col ? NonNullable<T[K]> : T[K] }
  : T

type NarrowResultColumn<T, Col extends string> = T extends (infer Item)[]
  ? Item extends Record<string, unknown>
    ? Col extends keyof Item
      ? { [K in keyof Item]: K extends Col ? NonNullable<Item[K]> : Item[K] }[]
      : T
    : T
  : T extends Record<string, unknown>
    ? Col extends keyof T
      ? { [K in keyof T]: K extends Col ? NonNullable<T[K]> : T[K] }
      : T
    : T

export default class PostgrestFilterBuilder<
  ClientOptions extends ClientServerOptions,
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  Result,
  RelationName = unknown,
  Relationships = unknown,
  Method = unknown,
> extends PostgrestTransformBuilder<
  ClientOptions,
  Schema,
  Row,
  Result,
  RelationName,
  Relationships,
  Method
> {
  /**
   * Match only rows where `column` is equal to `value`.
   *
   * To check if the value of `column` is NULL, you should use `.is()` instead.
   *
   * @param column - The column to filter on
   * @param value - The value to filter with
   *
   * @category Database
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .eq('name', 'Leia')
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
   *       "id": 2,
   *       "name": "Leia"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  eq<ColumnName extends string>(
    column: ColumnName extends keyof Row
      ? ColumnName
      : ColumnName extends `${string}.${string}` | `${string}->${string}`
        ? ColumnName
        : string extends ColumnName
          ? string
          : keyof Row,
    value: ResolveFilterValue<Schema, Row, ColumnName> extends never
      ? NonNullable<unknown>
      : ResolveFilterValue<Schema, Row, ColumnName> extends infer ResolvedFilterValue
        ? NonNullable<ResolvedFilterValue>
        : never
  ): this {
    this.url.searchParams.append(column as string, `eq.${value}`)
    return this
  }

  /**
   * Match only rows where `column` is not equal to `value`.
   *
   * @param column - The column to filter on
   * @param value - The value to filter with
   *
   * @category Database
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .neq('name', 'Leia')
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
   *       "id": 1,
   *       "name": "Luke"
   *     },
   *     {
   *       "id": 3,
   *       "name": "Han"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  neq<ColumnName extends string>(
    column: ColumnName extends keyof Row
      ? ColumnName
      : ColumnName extends `${string}.${string}` | `${string}->${string}`
        ? ColumnName
        : string extends ColumnName
          ? string
          : keyof Row,
    value: ResolveFilterValue<Schema, Row, ColumnName> extends never
      ? unknown
      : ResolveFilterValue<Schema, Row, ColumnName> extends infer Resolved
        ? Resolved
        : never
  ): this {
    this.url.searchParams.append(column as string, `neq.${value}`)
    return this
  }

  gt<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this
  gt(column: string, value: unknown): this
  /**
   * Match only rows where `column` is greater than `value`.
   *
   * @param column - The column to filter on
   * @param value - The value to filter with
   *
   * @category Database
   *
   * @exampleDescription With `select()`
   * When using [reserved words](https://www.postgresql.org/docs/current/sql-keywords-appendix.html) for column names you need
   * to add double quotes e.g. `.gt('"order"', 2)`
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .gt('id', 2)
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
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  gt(column: string, value: unknown): this {
    this.url.searchParams.append(column, `gt.${value}`)
    return this
  }

  gte<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this
  gte(column: string, value: unknown): this
  /**
   * Match only rows where `column` is greater than or equal to `value`.
   *
   * @param column - The column to filter on
   * @param value - The value to filter with
   *
   * @category Database
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .gte('id', 2)
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
   *       "id": 2,
   *       "name": "Leia"
   *     },
   *     {
   *       "id": 3,
   *       "name": "Han"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  gte(column: string, value: unknown): this {
    this.url.searchParams.append(column, `gte.${value}`)
    return this
  }

  lt<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this
  lt(column: string, value: unknown): this
  /**
   * Match only rows where `column` is less than `value`.
   *
   * @param column - The column to filter on
   * @param value - The value to filter with
   *
   * @category Database
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .lt('id', 2)
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
   *       "id": 1,
   *       "name": "Luke"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  lt(column: string, value: unknown): this {
    this.url.searchParams.append(column, `lt.${value}`)
    return this
  }

  lte<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this
  lte(column: string, value: unknown): this
  /**
   * Match only rows where `column` is less than or equal to `value`.
   *
   * @param column - The column to filter on
   * @param value - The value to filter with
   *
   * @category Database
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .lte('id', 2)
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
   *       "id": 1,
   *       "name": "Luke"
   *     },
   *     {
   *       "id": 2,
   *       "name": "Leia"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  lte(column: string, value: unknown): this {
    this.url.searchParams.append(column, `lte.${value}`)
    return this
  }

  like<ColumnName extends string & keyof Row>(column: ColumnName, pattern: string): this
  like(column: string, pattern: string): this
  /**
   * Match only rows where `column` matches `pattern` case-sensitively.
   *
   * @param column - The column to filter on
   * @param pattern - The pattern to match with
   *
   * @category Database
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .like('name', '%Lu%')
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
   *       "id": 1,
   *       "name": "Luke"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  like(column: string, pattern: string): this {
    this.url.searchParams.append(column, `like.${pattern}`)
    return this
  }

  likeAllOf<ColumnName extends string & keyof Row>(
    column: ColumnName,
    patterns: readonly string[]
  ): this
  likeAllOf(column: string, patterns: readonly string[]): this
  /**
   * Match only rows where `column` matches all of `patterns` case-sensitively.
   *
   * @param column - The column to filter on
   * @param patterns - The patterns to match with
   *
   * @category Database
   */
  likeAllOf(column: string, patterns: readonly string[]): this {
    this.url.searchParams.append(column, `like(all).{${patterns.join(',')}}`)
    return this
  }

  likeAnyOf<ColumnName extends string & keyof Row>(
    column: ColumnName,
    patterns: readonly string[]
  ): this
  likeAnyOf(column: string, patterns: readonly string[]): this
  /**
   * Match only rows where `column` matches any of `patterns` case-sensitively.
   *
   * @param column - The column to filter on
   * @param patterns - The patterns to match with
   *
   * @category Database
   */
  likeAnyOf(column: string, patterns: readonly string[]): this {
    this.url.searchParams.append(column, `like(any).{${patterns.join(',')}}`)
    return this
  }

  ilike<ColumnName extends string & keyof Row>(column: ColumnName, pattern: string): this
  ilike(column: string, pattern: string): this
  /**
   * Match only rows where `column` matches `pattern` case-insensitively.
   *
   * @param column - The column to filter on
   * @param pattern - The pattern to match with
   *
   * @category Database
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .ilike('name', '%lu%')
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
   *       "id": 1,
   *       "name": "Luke"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  ilike(column: string, pattern: string): this {
    this.url.searchParams.append(column, `ilike.${pattern}`)
    return this
  }

  ilikeAllOf<ColumnName extends string & keyof Row>(
    column: ColumnName,
    patterns: readonly string[]
  ): this
  ilikeAllOf(column: string, patterns: readonly string[]): this
  /**
   * Match only rows where `column` matches all of `patterns` case-insensitively.
   *
   * @param column - The column to filter on
   * @param patterns - The patterns to match with
   *
   * @category Database
   */
  ilikeAllOf(column: string, patterns: readonly string[]): this {
    this.url.searchParams.append(column, `ilike(all).{${patterns.join(',')}}`)
    return this
  }

  ilikeAnyOf<ColumnName extends string & keyof Row>(
    column: ColumnName,
    patterns: readonly string[]
  ): this
  ilikeAnyOf(column: string, patterns: readonly string[]): this
  /**
   * Match only rows where `column` matches any of `patterns` case-insensitively.
   *
   * @param column - The column to filter on
   * @param patterns - The patterns to match with
   *
   * @category Database
   */
  ilikeAnyOf(column: string, patterns: readonly string[]): this {
    this.url.searchParams.append(column, `ilike(any).{${patterns.join(',')}}`)
    return this
  }

  regexMatch<ColumnName extends string & keyof Row>(column: ColumnName, pattern: string): this
  regexMatch(column: string, pattern: string): this
  /**
   * Match only rows where `column` matches the PostgreSQL regex `pattern`
   * case-sensitively (using the `~` operator).
   *
   * @param column - The column to filter on
   * @param pattern - The PostgreSQL regular expression pattern to match with
   */
  regexMatch(column: string, pattern: string): this {
    this.url.searchParams.append(column, `match.${pattern}`)
    return this
  }

  regexIMatch<ColumnName extends string & keyof Row>(column: ColumnName, pattern: string): this
  regexIMatch(column: string, pattern: string): this
  /**
   * Match only rows where `column` matches the PostgreSQL regex `pattern`
   * case-insensitively (using the `~*` operator).
   *
   * @param column - The column to filter on
   * @param pattern - The PostgreSQL regular expression pattern to match with
   */
  regexIMatch(column: string, pattern: string): this {
    this.url.searchParams.append(column, `imatch.${pattern}`)
    return this
  }

  is<ColumnName extends string & keyof Row>(
    column: ColumnName,
    value: Row[ColumnName] & (boolean | null)
  ): this
  is(column: string, value: boolean | null): this
  /**
   * Match only rows where `column` IS `value`.
   *
   * For non-boolean columns, this is only relevant for checking if the value of
   * `column` is NULL by setting `value` to `null`.
   *
   * For boolean columns, you can also set `value` to `true` or `false` and it
   * will behave the same way as `.eq()`.
   *
   * @param column - The column to filter on
   * @param value - The value to filter with
   *
   * @category Database
   *
   * @exampleDescription Checking for nullness, true or false
   * Using the `eq()` filter doesn't work when filtering for `null`.
   *
   * Instead, you need to use `is()`.
   *
   * @example Checking for nullness, true or false
   * ```ts
   * const { data, error } = await supabase
   *   .from('countries')
   *   .select()
   *   .is('name', null)
   * ```
   *
   * @exampleSql Checking for nullness, true or false
   * ```sql
   * create table
   *   countries (id int8 primary key, name text);
   *
   * insert into
   *   countries (id, name)
   * values
   *   (1, 'null'),
   *   (2, null);
   * ```
   *
   * @exampleResponse Checking for nullness, true or false
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 2,
   *       "name": "null"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  is(column: string, value: boolean | null): this {
    this.url.searchParams.append(column, `is.${value}`)
    return this
  }

  /**
   * Match only rows where `column` IS DISTINCT FROM `value`.
   *
   * Unlike `.neq()`, this treats `NULL` as a comparable value. Two `NULL` values
   * are considered equal (not distinct), and comparing `NULL` with any non-NULL
   * value returns true (distinct).
   *
   * @param column - The column to filter on
   * @param value - The value to filter with
   */
  isDistinct<ColumnName extends string>(
    column: ColumnName,
    value: ResolveFilterValue<Schema, Row, ColumnName> extends never
      ? unknown
      : ResolveFilterValue<Schema, Row, ColumnName> extends infer ResolvedFilterValue
        ? ResolvedFilterValue
        : never
  ): this {
    this.url.searchParams.append(column, `isdistinct.${value}`)
    return this
  }

  /**
   * Match only rows where `column` is included in the `values` array.
   *
   * @param column - The column to filter on
   * @param values - The values array to filter with
   *
   * @category Database
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .in('name', ['Leia', 'Han'])
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
   *       "id": 2,
   *       "name": "Leia"
   *     },
   *     {
   *       "id": 3,
   *       "name": "Han"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  in<ColumnName extends string>(
    column: ColumnName,
    values: ReadonlyArray<
      ResolveFilterValue<Schema, Row, ColumnName> extends never
        ? unknown
        : // We want to infer the type before wrapping it into a `NonNullable` to avoid too deep
          // type resolution error
          ResolveFilterValue<Schema, Row, ColumnName> extends infer ResolvedFilterValue
          ? ResolvedFilterValue
          : // We should never enter this case as all the branches are covered above
            never
    >
  ): this {
    const cleanedValues = Array.from(new Set(values))
      .map((s) => {
        // handle postgrest reserved characters
        // https://postgrest.org/en/v7.0.0/api.html#reserved-characters
        if (typeof s === 'string' && PostgrestReservedCharsRegexp.test(s)) return `"${s}"`
        else return `${s}`
      })
      .join(',')
    this.url.searchParams.append(column, `in.(${cleanedValues})`)
    return this
  }

  /**
   * Match only rows where `column` is NOT included in the `values` array.
   *
   * @param column - The column to filter on
   * @param values - The values array to filter with
   */
  notIn<ColumnName extends string>(
    column: ColumnName,
    values: ReadonlyArray<
      ResolveFilterValue<Schema, Row, ColumnName> extends never
        ? unknown
        : ResolveFilterValue<Schema, Row, ColumnName> extends infer ResolvedFilterValue
          ? ResolvedFilterValue
          : never
    >
  ): this {
    const cleanedValues = Array.from(new Set(values))
      .map((s) => {
        // handle postgrest reserved characters
        // https://postgrest.org/en/v7.0.0/api.html#reserved-characters
        if (typeof s === 'string' && PostgrestReservedCharsRegexp.test(s)) return `"${s}"`
        else return `${s}`
      })
      .join(',')
    this.url.searchParams.append(column, `not.in.(${cleanedValues})`)
    return this
  }

  contains<ColumnName extends string & keyof Row>(
    column: ColumnName,
    value: string | ReadonlyArray<Row[ColumnName]> | Record<string, unknown>
  ): this
  contains(column: string, value: string | readonly unknown[] | Record<string, unknown>): this
  /**
   * Only relevant for jsonb, array, and range columns. Match only rows where
   * `column` contains every element appearing in `value`.
   *
   * @param column - The jsonb, array, or range column to filter on
   * @param value - The jsonb, array, or range value to filter with
   *
   * @category Database
   *
   * @example On array columns
   * ```ts
   * const { data, error } = await supabase
   *   .from('issues')
   *   .select()
   *   .contains('tags', ['is:open', 'priority:low'])
   * ```
   *
   * @exampleSql On array columns
   * ```sql
   * create table
   *   issues (
   *     id int8 primary key,
   *     title text,
   *     tags text[]
   *   );
   *
   * insert into
   *   issues (id, title, tags)
   * values
   *   (1, 'Cache invalidation is not working', array['is:open', 'severity:high', 'priority:low']),
   *   (2, 'Use better names', array['is:open', 'severity:low', 'priority:medium']);
   * ```
   *
   * @exampleResponse On array columns
   * ```json
   * {
   *   "data": [
   *     {
   *       "title": "Cache invalidation is not working"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @exampleDescription On range columns
   * Postgres supports a number of [range
   * types](https://www.postgresql.org/docs/current/rangetypes.html). You
   * can filter on range columns using the string representation of range
   * values.
   *
   * @example On range columns
   * ```ts
   * const { data, error } = await supabase
   *   .from('reservations')
   *   .select()
   *   .contains('during', '[2000-01-01 13:00, 2000-01-01 13:30)')
   * ```
   *
   * @exampleSql On range columns
   * ```sql
   * create table
   *   reservations (
   *     id int8 primary key,
   *     room_name text,
   *     during tsrange
   *   );
   *
   * insert into
   *   reservations (id, room_name, during)
   * values
   *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
   *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
   * ```
   *
   * @exampleResponse On range columns
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "room_name": "Emerald",
   *       "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @example On `jsonb` columns
   * ```ts
   * const { data, error } = await supabase
   *   .from('users')
   *   .select('name')
   *   .contains('address', { postcode: 90210 })
   * ```
   *
   * @exampleSql On `jsonb` columns
   * ```sql
   * create table
   *   users (
   *     id int8 primary key,
   *     name text,
   *     address jsonb
   *   );
   *
   * insert into
   *   users (id, name, address)
   * values
   *   (1, 'Michael', '{ "postcode": 90210, "street": "Melrose Place" }'),
   *   (2, 'Jane', '{}');
   * ```
   *
   * @exampleResponse On `jsonb` columns
   * ```json
   * {
   *   "data": [
   *     {
   *       "name": "Michael"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  contains(column: string, value: string | readonly unknown[] | Record<string, unknown>): this {
    if (typeof value === 'string') {
      // range types can be inclusive '[', ']' or exclusive '(', ')' so just
      // keep it simple and accept a string
      this.url.searchParams.append(column, `cs.${value}`)
    } else if (Array.isArray(value)) {
      // array
      this.url.searchParams.append(column, `cs.{${value.join(',')}}`)
    } else {
      // json
      this.url.searchParams.append(column, `cs.${JSON.stringify(value)}`)
    }
    return this
  }

  containedBy<ColumnName extends string & keyof Row>(
    column: ColumnName,
    value: string | ReadonlyArray<Row[ColumnName]> | Record<string, unknown>
  ): this
  containedBy(column: string, value: string | readonly unknown[] | Record<string, unknown>): this
  /**
   * Only relevant for jsonb, array, and range columns. Match only rows where
   * every element appearing in `column` is contained by `value`.
   *
   * @param column - The jsonb, array, or range column to filter on
   * @param value - The jsonb, array, or range value to filter with
   *
   * @category Database
   *
   * @example On array columns
   * ```ts
   * const { data, error } = await supabase
   *   .from('classes')
   *   .select('name')
   *   .containedBy('days', ['monday', 'tuesday', 'wednesday', 'friday'])
   * ```
   *
   * @exampleSql On array columns
   * ```sql
   * create table
   *   classes (
   *     id int8 primary key,
   *     name text,
   *     days text[]
   *   );
   *
   * insert into
   *   classes (id, name, days)
   * values
   *   (1, 'Chemistry', array['monday', 'friday']),
   *   (2, 'History', array['monday', 'wednesday', 'thursday']);
   * ```
   *
   * @exampleResponse On array columns
   * ```json
   * {
   *   "data": [
   *     {
   *       "name": "Chemistry"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @exampleDescription On range columns
   * Postgres supports a number of [range
   * types](https://www.postgresql.org/docs/current/rangetypes.html). You
   * can filter on range columns using the string representation of range
   * values.
   *
   * @example On range columns
   * ```ts
   * const { data, error } = await supabase
   *   .from('reservations')
   *   .select()
   *   .containedBy('during', '[2000-01-01 00:00, 2000-01-01 23:59)')
   * ```
   *
   * @exampleSql On range columns
   * ```sql
   * create table
   *   reservations (
   *     id int8 primary key,
   *     room_name text,
   *     during tsrange
   *   );
   *
   * insert into
   *   reservations (id, room_name, during)
   * values
   *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
   *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
   * ```
   *
   * @exampleResponse On range columns
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "room_name": "Emerald",
   *       "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @example On `jsonb` columns
   * ```ts
   * const { data, error } = await supabase
   *   .from('users')
   *   .select('name')
   *   .containedBy('address', {})
   * ```
   *
   * @exampleSql On `jsonb` columns
   * ```sql
   * create table
   *   users (
   *     id int8 primary key,
   *     name text,
   *     address jsonb
   *   );
   *
   * insert into
   *   users (id, name, address)
   * values
   *   (1, 'Michael', '{ "postcode": 90210, "street": "Melrose Place" }'),
   *   (2, 'Jane', '{}');
   * ```
   *
   * @exampleResponse On `jsonb` columns
   * ```json
   *   {
   *     "data": [
   *       {
   *         "name": "Jane"
   *       }
   *     ],
   *     "status": 200,
   *     "statusText": "OK"
   *   }
   *
   * ```
   */
  containedBy(column: string, value: string | readonly unknown[] | Record<string, unknown>): this {
    if (typeof value === 'string') {
      // range
      this.url.searchParams.append(column, `cd.${value}`)
    } else if (Array.isArray(value)) {
      // array
      this.url.searchParams.append(column, `cd.{${value.join(',')}}`)
    } else {
      // json
      this.url.searchParams.append(column, `cd.${JSON.stringify(value)}`)
    }
    return this
  }

  rangeGt<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this
  rangeGt(column: string, range: string): this
  /**
   * Only relevant for range columns. Match only rows where every element in
   * `column` is greater than any element in `range`.
   *
   * @param column - The range column to filter on
   * @param range - The range to filter with
   *
   * @category Database
   *
   * @exampleDescription With `select()`
   * Postgres supports a number of [range
   * types](https://www.postgresql.org/docs/current/rangetypes.html). You
   * can filter on range columns using the string representation of range
   * values.
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('reservations')
   *   .select()
   *   .rangeGt('during', '[2000-01-02 08:00, 2000-01-02 09:00)')
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   reservations (
   *     id int8 primary key,
   *     room_name text,
   *     during tsrange
   *   );
   *
   * insert into
   *   reservations (id, room_name, during)
   * values
   *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
   *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   *   {
   *     "data": [
   *       {
   *         "id": 2,
   *         "room_name": "Topaz",
   *         "during": "[\"2000-01-02 09:00:00\",\"2000-01-02 10:00:00\")"
   *       }
   *     ],
   *     "status": 200,
   *     "statusText": "OK"
   *   }
   *
   * ```
   */
  rangeGt(column: string, range: string): this {
    this.url.searchParams.append(column, `sr.${range}`)
    return this
  }

  rangeGte<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this
  rangeGte(column: string, range: string): this
  /**
   * Only relevant for range columns. Match only rows where every element in
   * `column` is either contained in `range` or greater than any element in
   * `range`.
   *
   * @param column - The range column to filter on
   * @param range - The range to filter with
   *
   * @category Database
   *
   * @exampleDescription With `select()`
   * Postgres supports a number of [range
   * types](https://www.postgresql.org/docs/current/rangetypes.html). You
   * can filter on range columns using the string representation of range
   * values.
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('reservations')
   *   .select()
   *   .rangeGte('during', '[2000-01-02 08:30, 2000-01-02 09:30)')
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   reservations (
   *     id int8 primary key,
   *     room_name text,
   *     during tsrange
   *   );
   *
   * insert into
   *   reservations (id, room_name, during)
   * values
   *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
   *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   *   {
   *     "data": [
   *       {
   *         "id": 2,
   *         "room_name": "Topaz",
   *         "during": "[\"2000-01-02 09:00:00\",\"2000-01-02 10:00:00\")"
   *       }
   *     ],
   *     "status": 200,
   *     "statusText": "OK"
   *   }
   *
   * ```
   */
  rangeGte(column: string, range: string): this {
    this.url.searchParams.append(column, `nxl.${range}`)
    return this
  }

  rangeLt<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this
  rangeLt(column: string, range: string): this
  /**
   * Only relevant for range columns. Match only rows where every element in
   * `column` is less than any element in `range`.
   *
   * @param column - The range column to filter on
   * @param range - The range to filter with
   *
   * @category Database
   *
   * @exampleDescription With `select()`
   * Postgres supports a number of [range
   * types](https://www.postgresql.org/docs/current/rangetypes.html). You
   * can filter on range columns using the string representation of range
   * values.
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('reservations')
   *   .select()
   *   .rangeLt('during', '[2000-01-01 15:00, 2000-01-01 16:00)')
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   reservations (
   *     id int8 primary key,
   *     room_name text,
   *     during tsrange
   *   );
   *
   * insert into
   *   reservations (id, room_name, during)
   * values
   *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
   *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "room_name": "Emerald",
   *       "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  rangeLt(column: string, range: string): this {
    this.url.searchParams.append(column, `sl.${range}`)
    return this
  }

  rangeLte<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this
  rangeLte(column: string, range: string): this
  /**
   * Only relevant for range columns. Match only rows where every element in
   * `column` is either contained in `range` or less than any element in
   * `range`.
   *
   * @param column - The range column to filter on
   * @param range - The range to filter with
   *
   * @category Database
   *
   * @exampleDescription With `select()`
   * Postgres supports a number of [range
   * types](https://www.postgresql.org/docs/current/rangetypes.html). You
   * can filter on range columns using the string representation of range
   * values.
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('reservations')
   *   .select()
   *   .rangeLte('during', '[2000-01-01 14:00, 2000-01-01 16:00)')
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   reservations (
   *     id int8 primary key,
   *     room_name text,
   *     during tsrange
   *   );
   *
   * insert into
   *   reservations (id, room_name, during)
   * values
   *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
   *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   *   {
   *     "data": [
   *       {
   *         "id": 1,
   *         "room_name": "Emerald",
   *         "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
   *       }
   *     ],
   *     "status": 200,
   *     "statusText": "OK"
   *   }
   *
   * ```
   */
  rangeLte(column: string, range: string): this {
    this.url.searchParams.append(column, `nxr.${range}`)
    return this
  }

  rangeAdjacent<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this
  rangeAdjacent(column: string, range: string): this
  /**
   * Only relevant for range columns. Match only rows where `column` is
   * mutually exclusive to `range` and there can be no element between the two
   * ranges.
   *
   * @param column - The range column to filter on
   * @param range - The range to filter with
   *
   * @category Database
   *
   * @exampleDescription With `select()`
   * Postgres supports a number of [range
   * types](https://www.postgresql.org/docs/current/rangetypes.html). You
   * can filter on range columns using the string representation of range
   * values.
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('reservations')
   *   .select()
   *   .rangeAdjacent('during', '[2000-01-01 12:00, 2000-01-01 13:00)')
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   reservations (
   *     id int8 primary key,
   *     room_name text,
   *     during tsrange
   *   );
   *
   * insert into
   *   reservations (id, room_name, during)
   * values
   *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
   *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "room_name": "Emerald",
   *       "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  rangeAdjacent(column: string, range: string): this {
    this.url.searchParams.append(column, `adj.${range}`)
    return this
  }

  overlaps<ColumnName extends string & keyof Row>(
    column: ColumnName,
    value: string | ReadonlyArray<Row[ColumnName]>
  ): this
  overlaps(column: string, value: string | readonly unknown[]): this
  /**
   * Only relevant for array and range columns. Match only rows where
   * `column` and `value` have an element in common.
   *
   * @param column - The array or range column to filter on
   * @param value - The array or range value to filter with
   *
   * @category Database
   *
   * @example On array columns
   * ```ts
   * const { data, error } = await supabase
   *   .from('issues')
   *   .select('title')
   *   .overlaps('tags', ['is:closed', 'severity:high'])
   * ```
   *
   * @exampleSql On array columns
   * ```sql
   * create table
   *   issues (
   *     id int8 primary key,
   *     title text,
   *     tags text[]
   *   );
   *
   * insert into
   *   issues (id, title, tags)
   * values
   *   (1, 'Cache invalidation is not working', array['is:open', 'severity:high', 'priority:low']),
   *   (2, 'Use better names', array['is:open', 'severity:low', 'priority:medium']);
   * ```
   *
   * @exampleResponse On array columns
   * ```json
   * {
   *   "data": [
   *     {
   *       "title": "Cache invalidation is not working"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @exampleDescription On range columns
   * Postgres supports a number of [range
   * types](https://www.postgresql.org/docs/current/rangetypes.html). You
   * can filter on range columns using the string representation of range
   * values.
   *
   * @example On range columns
   * ```ts
   * const { data, error } = await supabase
   *   .from('reservations')
   *   .select()
   *   .overlaps('during', '[2000-01-01 12:45, 2000-01-01 13:15)')
   * ```
   *
   * @exampleSql On range columns
   * ```sql
   * create table
   *   reservations (
   *     id int8 primary key,
   *     room_name text,
   *     during tsrange
   *   );
   *
   * insert into
   *   reservations (id, room_name, during)
   * values
   *   (1, 'Emerald', '[2000-01-01 13:00, 2000-01-01 15:00)'),
   *   (2, 'Topaz', '[2000-01-02 09:00, 2000-01-02 10:00)');
   * ```
   *
   * @exampleResponse On range columns
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "room_name": "Emerald",
   *       "during": "[\"2000-01-01 13:00:00\",\"2000-01-01 15:00:00\")"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  overlaps(column: string, value: string | readonly unknown[]): this {
    if (typeof value === 'string') {
      // range
      this.url.searchParams.append(column, `ov.${value}`)
    } else {
      // array
      this.url.searchParams.append(column, `ov.{${value.join(',')}}`)
    }
    return this
  }

  textSearch<ColumnName extends string & keyof Row>(
    column: ColumnName,
    query: string,
    options?: { config?: string; type?: 'plain' | 'phrase' | 'websearch' }
  ): this
  textSearch(
    column: string,
    query: string,
    options?: { config?: string; type?: 'plain' | 'phrase' | 'websearch' }
  ): this
  /**
   * Only relevant for text and tsvector columns. Match only rows where
   * `column` matches the query string in `query`.
   *
   * @param column - The text or tsvector column to filter on
   * @param query - The query text to match with
   * @param options - Named parameters
   * @param options.config - The text search configuration to use
   * @param options.type - Change how the `query` text is interpreted
   *
   * @category Database
   *
   * @remarks
   * - For more information, see [Postgres full text search](/docs/guides/database/full-text-search).
   *
   * @example Text search
   * ```ts
   * const result = await supabase
   *   .from("texts")
   *   .select("content")
   *   .textSearch("content", `'eggs' & 'ham'`, {
   *     config: "english",
   *   });
   * ```
   *
   * @exampleSql Text search
   * ```sql
   * create table texts (
   *   id      bigint
   *           primary key
   *           generated always as identity,
   *   content text
   * );
   *
   * insert into texts (content) values
   *     ('Four score and seven years ago'),
   *     ('The road goes ever on and on'),
   *     ('Green eggs and ham')
   * ;
   * ```
   *
   * @exampleResponse Text search
   * ```json
   * {
   *   "data": [
   *     {
   *       "content": "Green eggs and ham"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @exampleDescription Basic normalization
   * Uses PostgreSQL's `plainto_tsquery` function.
   *
   * @example Basic normalization
   * ```ts
   * const { data, error } = await supabase
   *   .from('quotes')
   *   .select('catchphrase')
   *   .textSearch('catchphrase', `'fat' & 'cat'`, {
   *     type: 'plain',
   *     config: 'english'
   *   })
   * ```
   *
   * @exampleDescription Full normalization
   * Uses PostgreSQL's `phraseto_tsquery` function.
   *
   * @example Full normalization
   * ```ts
   * const { data, error } = await supabase
   *   .from('quotes')
   *   .select('catchphrase')
   *   .textSearch('catchphrase', `'fat' & 'cat'`, {
   *     type: 'phrase',
   *     config: 'english'
   *   })
   * ```
   *
   * @exampleDescription Websearch
   * Uses PostgreSQL's `websearch_to_tsquery` function.
   * This function will never raise syntax errors, which makes it possible to use raw user-supplied input for search, and can be used
   * with advanced operators.
   *
   * - `unquoted text`: text not inside quote marks will be converted to terms separated by & operators, as if processed by plainto_tsquery.
   * - `"quoted text"`: text inside quote marks will be converted to terms separated by `<->` operators, as if processed by phraseto_tsquery.
   * - `OR`: the word “or” will be converted to the | operator.
   * - `-`: a dash will be converted to the ! operator.
   *
   * @example Websearch
   * ```ts
   * const { data, error } = await supabase
   *   .from('quotes')
   *   .select('catchphrase')
   *   .textSearch('catchphrase', `'fat or cat'`, {
   *     type: 'websearch',
   *     config: 'english'
   *   })
   * ```
   */
  textSearch(
    column: string,
    query: string,
    { config, type }: { config?: string; type?: 'plain' | 'phrase' | 'websearch' } = {}
  ): this {
    let typePart = ''
    if (type === 'plain') {
      typePart = 'pl'
    } else if (type === 'phrase') {
      typePart = 'ph'
    } else if (type === 'websearch') {
      typePart = 'w'
    }
    const configPart = config === undefined ? '' : `(${config})`
    this.url.searchParams.append(column, `${typePart}fts${configPart}.${query}`)
    return this
  }

  match<ColumnName extends string & keyof Row>(query: Record<ColumnName, Row[ColumnName]>): this
  match(query: Record<string, unknown>): this
  /**
   * Match only rows where each column in `query` keys is equal to its
   * associated value. Shorthand for multiple `.eq()`s.
   *
   * @param query - The object to filter with, with column names as keys mapped
   * to their filter values
   *
   * @category Database
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select('name')
   *   .match({ id: 2, name: 'Leia' })
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
   *       "name": "Leia"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  match(query: Record<string, unknown>): this {
    Object.entries(query)
      // columns with `undefined` value needs to be filtered out, otherwise it'll
      // show up as `?column=eq.undefined`
      .filter(([_, value]) => value !== undefined)
      .forEach(([column, value]) => {
        this.url.searchParams.append(column, `eq.${value}`)
      })
    return this
  }

  not<ColumnName extends string & keyof Row>(
    column: ColumnName,
    operator: 'is',
    value: null
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    NonNullableColumn<Row, ColumnName>,
    NarrowResultColumn<Result, ColumnName>,
    RelationName,
    Relationships,
    Method
  >
  not<ColumnName extends string & keyof Row>(
    column: ColumnName,
    operator: FilterOperator,
    value: Row[ColumnName]
  ): this
  not(column: string, operator: string, value: unknown): this
  /**
   * Match only rows which doesn't satisfy the filter.
   *
   * Unlike most filters, `opearator` and `value` are used as-is and need to
   * follow [PostgREST
   * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
   * to make sure they are properly sanitized.
   *
   * @param column - The column to filter on
   * @param operator - The operator to be negated to filter with, following
   * PostgREST syntax
   * @param value - The value to filter with, following PostgREST syntax
   *
   * @category Database
   *
   * @remarks
   * not() expects you to use the raw PostgREST syntax for the filter values.
   *
   * ```ts
   * .not('id', 'in', '(5,6,7)')  // Use `()` for `in` filter
   * .not('arraycol', 'cs', '{"a","b"}')  // Use `cs` for `contains()`, `{}` for array values
   * ```
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('countries')
   *   .select()
   *   .not('name', 'is', null)
   * ```
   *
   * @exampleSql With `select()`
   * ```sql
   * create table
   *   countries (id int8 primary key, name text);
   *
   * insert into
   *   countries (id, name)
   * values
   *   (1, 'null'),
   *   (2, null);
   * ```
   *
   * @exampleResponse With `select()`
   * ```json
   *   {
   *     "data": [
   *       {
   *         "id": 1,
   *         "name": "null"
   *       }
   *     ],
   *     "status": 200,
   *     "statusText": "OK"
   *   }
   *
   * ```
   */
  not(
    column: string,
    operator: string,
    value: unknown
  ): PostgrestFilterBuilder<ClientOptions, Schema, any, any, RelationName, Relationships, Method> {
    this.url.searchParams.append(column, `not.${operator}.${value}`)
    return this as any
  }

  /**
   * Match only rows which satisfy at least one of the filters.
   *
   * Unlike most filters, `filters` is used as-is and needs to follow [PostgREST
   * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
   * to make sure it's properly sanitized.
   *
   * It's currently not possible to do an `.or()` filter across multiple tables.
   *
   * @param filters - The filters to use, following PostgREST syntax
   * @param options - Named parameters
   * @param options.referencedTable - Set this to filter on referenced tables
   * instead of the parent table
   * @param options.foreignTable - Deprecated, use `referencedTable` instead
   *
   * @category Database
   *
   * @remarks
   * or() expects you to use the raw PostgREST syntax for the filter names and values.
   *
   * ```ts
   * .or('id.in.(5,6,7), arraycol.cs.{"a","b"}')  // Use `()` for `in` filter, `{}` for array values and `cs` for `contains()`.
   * .or('id.in.(5,6,7), arraycol.cd.{"a","b"}')  // Use `cd` for `containedBy()`
   * ```
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select('name')
   *   .or('id.eq.2,name.eq.Han')
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
   *       "name": "Leia"
   *     },
   *     {
   *       "name": "Han"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @example Use `or` with `and`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select('name')
   *   .or('id.gt.3,and(id.eq.1,name.eq.Luke)')
   * ```
   *
   * @exampleSql Use `or` with `and`
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
   * @exampleResponse Use `or` with `and`
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
   * @example Use `or` on referenced tables
   * ```ts
   * const { data, error } = await supabase
   *   .from('orchestral_sections')
   *   .select(`
   *     name,
   *     instruments!inner (
   *       name
   *     )
   *   `)
   *   .or('section_id.eq.1,name.eq.guzheng', { referencedTable: 'instruments' })
   * ```
   *
   * @exampleSql Use `or` on referenced tables
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
   * @exampleResponse Use `or` on referenced tables
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
  or(
    filters: string,
    {
      foreignTable,
      referencedTable = foreignTable,
    }: { foreignTable?: string; referencedTable?: string } = {}
  ): this {
    const key = referencedTable ? `${referencedTable}.or` : 'or'
    this.url.searchParams.append(key, `(${filters})`)
    return this
  }

  filter<ColumnName extends string & keyof Row>(
    column: ColumnName,
    operator: `${'' | 'not.'}${FilterOperator}`,
    value: unknown
  ): this
  filter(column: string, operator: string, value: unknown): this
  /**
   * Match only rows which satisfy the filter. This is an escape hatch - you
   * should use the specific filter methods wherever possible.
   *
   * Unlike most filters, `opearator` and `value` are used as-is and need to
   * follow [PostgREST
   * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
   * to make sure they are properly sanitized.
   *
   * @param column - The column to filter on
   * @param operator - The operator to filter with, following PostgREST syntax
   * @param value - The value to filter with, following PostgREST syntax
   *
   * @category Database
   *
   * @remarks
   * filter() expects you to use the raw PostgREST syntax for the filter values.
   *
   * ```ts
   * .filter('id', 'in', '(5,6,7)')  // Use `()` for `in` filter
   * .filter('arraycol', 'cs', '{"a","b"}')  // Use `cs` for `contains()`, `{}` for array values
   * ```
   *
   * @example With `select()`
   * ```ts
   * const { data, error } = await supabase
   *   .from('characters')
   *   .select()
   *   .filter('name', 'in', '("Han","Yoda")')
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
   *     instruments!inner (
   *       name
   *     )
   *   `)
   *   .filter('instruments.name', 'eq', 'flute')
   * ```
   *
   * @exampleSql On a referenced table
   * ```sql
   * create table
   *   orchestral_sections (id int8 primary key, name text);
   * create table
   *    instruments (
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
   * @exampleResponse On a referenced table
   * ```json
   * {
   *   "data": [
   *     {
   *       "name": "woodwinds",
   *       "instruments": [
   *         {
   *           "name": "flute"
   *         }
   *       ]
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  filter(column: string, operator: string, value: unknown): this {
    this.url.searchParams.append(column, `${operator}.${value}`)
    return this
  }
}
