import PostgrestFilterBuilder from './PostgrestFilterBuilder'
import { GetResult } from './select-query-parser/result'
import {
  ClientServerOptions,
  Fetch,
  GenericSchema,
  GenericTable,
  GenericView,
} from './types/common/common'

export default class PostgrestQueryBuilder<
  ClientOptions extends ClientServerOptions,
  Schema extends GenericSchema,
  Relation extends GenericTable | GenericView,
  RelationName = unknown,
  Relationships = Relation extends { Relationships: infer R } ? R : unknown,
> {
  url: URL
  headers: Headers
  schema?: string
  signal?: AbortSignal
  fetch?: Fetch
  urlLengthLimit: number

  /**
   * Creates a query builder scoped to a Postgres table or view.
   *
   * @example
   * ```ts
   * import { PostgrestQueryBuilder } from '@supabase/postgrest-js'
   *
   * const query = new PostgrestQueryBuilder(
   *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
   *   { headers: { apikey: 'public-anon-key' } }
   * )
   * ```
   *
   * @category Database
   *
   * @example Example 1
   * ```ts
   * import { PostgrestQueryBuilder } from '@supabase/postgrest-js'
   *
   * const query = new PostgrestQueryBuilder(
   *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
   *   { headers: { apikey: 'public-anon-key' } }
   * )
   * ```
   */
  constructor(
    url: URL,
    {
      headers = {},
      schema,
      fetch,
      urlLengthLimit = 8000,
    }: {
      headers?: HeadersInit
      schema?: string
      fetch?: Fetch
      urlLengthLimit?: number
    }
  ) {
    this.url = url
    this.headers = new Headers(headers)
    this.schema = schema
    this.fetch = fetch
    this.urlLengthLimit = urlLengthLimit
  }

  /**
   * Clone URL and headers to prevent shared state between operations.
   */
  private cloneRequestState(): { url: URL; headers: Headers } {
    return {
      url: new URL(this.url.toString()),
      headers: new Headers(this.headers),
    }
  }

  /**
       * Perform a SELECT query on the table or view.
       *
       * @param columns - The columns to retrieve, separated by commas. Columns can be renamed when returned with `customName:columnName`
       *
       * @param options - Named parameters
       *
       * @param options.head - When set to `true`, `data` will not be returned.
       * Useful if you only need the count.
       *
       * @param options.count - Count algorithm to use to count rows in the table or view.
       *
       * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
       * hood.
       *
       * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
       * statistics under the hood.
       *
       * `"estimated"`: Uses exact count for low numbers and planned count for high
       * numbers.
       *
       * @remarks
       * When using `count` with `.range()` or `.limit()`, the returned `count` is the total number of rows
       * that match your filters, not the number of rows in the current page. Use this to build pagination UI.
       
     * - By default, Supabase projects return a maximum of 1,000 rows. This setting can be changed in your project's [API settings](/dashboard/project/_/settings/api). It's recommended that you keep it low to limit the payload size of accidental or malicious requests. You can use `range()` queries to paginate through your data.
     * - `select()` can be combined with [Filters](/docs/reference/javascript/using-filters)
     * - `select()` can be combined with [Modifiers](/docs/reference/javascript/using-modifiers)
     * - `apikey` is a reserved keyword if you're using the [Supabase Platform](/docs/guides/platform) and [should be avoided as a column name](https://github.com/supabase/supabase/issues/5465). *
     * @category Database
     *
     * @example Getting your data
     * ```js
     * const { data, error } = await supabase
     *   .from('characters')
     *   .select()
     * ```
     *
     * @exampleSql Getting your data
     * ```sql
     * create table
     *   characters (id int8 primary key, name text);
     *
     * insert into
     *   characters (id, name)
     * values
     *   (1, 'Harry'),
     *   (2, 'Frodo'),
     *   (3, 'Katniss');
     * ```
     *
     * @exampleResponse Getting your data
     * ```json
     * {
     *   "data": [
     *     {
     *       "id": 1,
     *       "name": "Harry"
     *     },
     *     {
     *       "id": 2,
     *       "name": "Frodo"
     *     },
     *     {
     *       "id": 3,
     *       "name": "Katniss"
     *     }
     *   ],
     *   "status": 200,
     *   "statusText": "OK"
     * }
     * ```
     *
     * @example Selecting specific columns
     * ```js
     * const { data, error } = await supabase
     *   .from('characters')
     *   .select('name')
     * ```
     *
     * @exampleSql Selecting specific columns
     * ```sql
     * create table
     *   characters (id int8 primary key, name text);
     *
     * insert into
     *   characters (id, name)
     * values
     *   (1, 'Frodo'),
     *   (2, 'Harry'),
     *   (3, 'Katniss');
     * ```
     *
     * @exampleResponse Selecting specific columns
     * ```json
     * {
     *   "data": [
     *     {
     *       "name": "Frodo"
     *     },
     *     {
     *       "name": "Harry"
     *     },
     *     {
     *       "name": "Katniss"
     *     }
     *   ],
     *   "status": 200,
     *   "statusText": "OK"
     * }
     * ```
     *
     * @exampleDescription Query referenced tables
     * If your database has foreign key relationships, you can query related tables too.
     *
     * @example Query referenced tables
     * ```js
     * const { data, error } = await supabase
     *   .from('orchestral_sections')
     *   .select(`
     *     name,
     *     instruments (
     *       name
     *     )
     *   `)
     * ```
     *
     * @exampleSql Query referenced tables
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
     * @exampleResponse Query referenced tables
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
     *     },
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
     *
     * @exampleDescription Query referenced tables with spaces in their names
     * If your table name contains spaces, you must use double quotes in the `select` statement to reference the table.
     *
     * @example Query referenced tables with spaces in their names
     * ```js
     * const { data, error } = await supabase
     *   .from('orchestral sections')
     *   .select(`
     *     name,
     *     "musical instruments" (
     *       name
     *     )
     *   `)
     * ```
     *
     * @exampleSql Query referenced tables with spaces in their names
     * ```sql
     * create table
     *   "orchestral sections" (id int8 primary key, name text);
     * create table
     *   "musical instruments" (
     *     id int8 primary key,
     *     section_id int8 not null references "orchestral sections",
     *     name text
     *   );
     *
     * insert into
     *   "orchestral sections" (id, name)
     * values
     *   (1, 'strings'),
     *   (2, 'woodwinds');
     * insert into
     *   "musical instruments" (id, section_id, name)
     * values
     *   (1, 2, 'flute'),
     *   (2, 1, 'violin');
     * ```
     *
     * @exampleResponse Query referenced tables with spaces in their names
     * ```json
     * {
     *   "data": [
     *     {
     *       "name": "strings",
     *       "musical instruments": [
     *         {
     *           "name": "violin"
     *         }
     *       ]
     *     },
     *     {
     *       "name": "woodwinds",
     *       "musical instruments": [
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
     *
     * @exampleDescription Query referenced tables through a join table
     * If you're in a situation where your tables are **NOT** directly
     * related, but instead are joined by a _join table_, you can still use
     * the `select()` method to query the related data. The join table needs
     * to have the foreign keys as part of its composite primary key.
     *
     * @example Query referenced tables through a join table
     * ```ts
     * const { data, error } = await supabase
     *   .from('users')
     *   .select(`
     *     name,
     *     teams (
     *       name
     *     )
     *   `)
     *   
     * ```
     *
     * @exampleSql Query referenced tables through a join table
     * ```sql
     * create table
     *   users (
     *     id int8 primary key,
     *     name text
     *   );
     * create table
     *   teams (
     *     id int8 primary key,
     *     name text
     *   );
     * -- join table
     * create table
     *   users_teams (
     *     user_id int8 not null references users,
     *     team_id int8 not null references teams,
     *     -- both foreign keys must be part of a composite primary key
     *     primary key (user_id, team_id)
     *   );
     *
     * insert into
     *   users (id, name)
     * values
     *   (1, 'Kiran'),
     *   (2, 'Evan');
     * insert into
     *   teams (id, name)
     * values
     *   (1, 'Green'),
     *   (2, 'Blue');
     * insert into
     *   users_teams (user_id, team_id)
     * values
     *   (1, 1),
     *   (1, 2),
     *   (2, 2);
     * ```
     *
     * @exampleResponse Query referenced tables through a join table
     * ```json
     *   {
     *     "data": [
     *       {
     *         "name": "Kiran",
     *         "teams": [
     *           {
     *             "name": "Green"
     *           },
     *           {
     *             "name": "Blue"
     *           }
     *         ]
     *       },
     *       {
     *         "name": "Evan",
     *         "teams": [
     *           {
     *             "name": "Blue"
     *           }
     *         ]
     *       }
     *     ],
     *     "status": 200,
     *     "statusText": "OK"
     *   }
     *   
     * ```
     *
     * @exampleDescription Query the same referenced table multiple times
     * If you need to query the same referenced table twice, use the name of the
     * joined column to identify which join to use. You can also give each
     * column an alias.
     *
     * @example Query the same referenced table multiple times
     * ```ts
     * const { data, error } = await supabase
     *   .from('messages')
     *   .select(`
     *     content,
     *     from:sender_id(name),
     *     to:receiver_id(name)
     *   `)
     *
     * // To infer types, use the name of the table (in this case `users`) and
     * // the name of the foreign key constraint.
     * const { data, error } = await supabase
     *   .from('messages')
     *   .select(`
     *     content,
     *     from:users!messages_sender_id_fkey(name),
     *     to:users!messages_receiver_id_fkey(name)
     *   `)
     * ```
     *
     * @exampleSql Query the same referenced table multiple times
     * ```sql
     *  create table
     *  users (id int8 primary key, name text);
     *
     *  create table
     *    messages (
     *      sender_id int8 not null references users,
     *      receiver_id int8 not null references users,
     *      content text
     *    );
     *
     *  insert into
     *    users (id, name)
     *  values
     *    (1, 'Kiran'),
     *    (2, 'Evan');
     *
     *  insert into
     *    messages (sender_id, receiver_id, content)
     *  values
     *    (1, 2, '👋');
     *  ```
     * ```
     *
     * @exampleResponse Query the same referenced table multiple times
     * ```json
     * {
     *   "data": [
     *     {
     *       "content": "👋",
     *       "from": {
     *         "name": "Kiran"
     *       },
     *       "to": {
     *         "name": "Evan"
     *       }
     *     }
     *   ],
     *   "status": 200,
     *   "statusText": "OK"
     * }
     * ```
     *
     * @exampleDescription Query nested foreign tables through a join table
     * You can use the result of a joined table to gather data in
     * another foreign table. With multiple references to the same foreign
     * table you must specify the column on which to conduct the join.
     *
     * @example Query nested foreign tables through a join table
     * ```ts
     *   const { data, error } = await supabase
     *     .from('games')
     *     .select(`
     *       game_id:id,
     *       away_team:teams!games_away_team_fkey (
     *         users (
     *           id,
     *           name
     *         )
     *       )
     *     `)
     *   
     * ```
     *
     * @exampleSql Query nested foreign tables through a join table
     * ```sql
     * ```sql
     * create table
     *   users (
     *     id int8 primary key,
     *     name text
     *   );
     * create table
     *   teams (
     *     id int8 primary key,
     *     name text
     *   );
     * -- join table
     * create table
     *   users_teams (
     *     user_id int8 not null references users,
     *     team_id int8 not null references teams,
     *
     *     primary key (user_id, team_id)
     *   );
     * create table
     *   games (
     *     id int8 primary key,
     *     home_team int8 not null references teams,
     *     away_team int8 not null references teams,
     *     name text
     *   );
     *
     * insert into users (id, name)
     * values
     *   (1, 'Kiran'),
     *   (2, 'Evan');
     * insert into
     *   teams (id, name)
     * values
     *   (1, 'Green'),
     *   (2, 'Blue');
     * insert into
     *   users_teams (user_id, team_id)
     * values
     *   (1, 1),
     *   (1, 2),
     *   (2, 2);
     * insert into
     *   games (id, home_team, away_team, name)
     * values
     *   (1, 1, 2, 'Green vs Blue'),
     *   (2, 2, 1, 'Blue vs Green');
     * ```
     *
     * @exampleResponse Query nested foreign tables through a join table
     * ```json
     *   {
     *     "data": [
     *       {
     *         "game_id": 1,
     *         "away_team": {
     *           "users": [
     *             {
     *               "id": 1,
     *               "name": "Kiran"
     *             },
     *             {
     *               "id": 2,
     *               "name": "Evan"
     *             }
     *           ]
     *         }
     *       },
     *       {
     *         "game_id": 2,
     *         "away_team": {
     *           "users": [
     *             {
     *               "id": 1,
     *               "name": "Kiran"
     *             }
     *           ]
     *         }
     *       }
     *     ],
     *     "status": 200,
     *     "statusText": "OK"
     *   }
     *   
     * ```
     *
     * @exampleDescription Filtering through referenced tables
     * If the filter on a referenced table's column is not satisfied, the referenced
     * table returns `[]` or `null` but the parent table is not filtered out.
     * If you want to filter out the parent table rows, use the `!inner` hint
     *
     * @example Filtering through referenced tables
     * ```ts
     * const { data, error } = await supabase
     *   .from('instruments')
     *   .select('name, orchestral_sections(*)')
     *   .eq('orchestral_sections.name', 'percussion')
     * ```
     *
     * @exampleSql Filtering through referenced tables
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
     * @exampleResponse Filtering through referenced tables
     * ```json
     * {
     *   "data": [
     *     {
     *       "name": "flute",
     *       "orchestral_sections": null
     *     },
     *     {
     *       "name": "violin",
     *       "orchestral_sections": null
     *     }
     *   ],
     *   "status": 200,
     *   "statusText": "OK"
     * }
     * ```
     *
     * @exampleDescription Querying referenced table with count
     * You can get the number of rows in a related table by using the
     * **count** property.
     *
     * @example Querying referenced table with count
     * ```ts
     * const { data, error } = await supabase
     *   .from('orchestral_sections')
     *   .select(`*, instruments(count)`)
     * ```
     *
     * @exampleSql Querying referenced table with count
     * ```sql
     * create table orchestral_sections (
     *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
     *   "name" text
     * );
     *
     * create table characters (
     *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
     *   "name" text,
     *   "section_id" "uuid" references public.orchestral_sections on delete cascade
     * );
     *
     * with section as (
     *   insert into orchestral_sections (name)
     *   values ('strings') returning id
     * )
     * insert into instruments (name, section_id) values
     * ('violin', (select id from section)),
     * ('viola', (select id from section)),
     * ('cello', (select id from section)),
     * ('double bass', (select id from section));
     * ```
     *
     * @exampleResponse Querying referenced table with count
     * ```json
     * [
     *   {
     *     "id": "693694e7-d993-4360-a6d7-6294e325d9b6",
     *     "name": "strings",
     *     "instruments": [
     *       {
     *         "count": 4
     *       }
     *     ]
     *   }
     * ]
     * ```
     *
     * @exampleDescription Querying with count option
     * You can get the number of rows by using the
     * [count](/docs/reference/javascript/select#parameters) option.
     *
     * @example Querying with count option
     * ```ts
     * const { count, error } = await supabase
     *   .from('characters')
     *   .select('*', { count: 'exact', head: true })
     * ```
     *
     * @exampleSql Querying with count option
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
     * @exampleResponse Querying with count option
     * ```json
     * {
     *   "count": 3,
     *   "status": 200,
     *   "statusText": "OK"
     * }
     * ```
     *
     * @exampleDescription Querying JSON data
     * You can select and filter data inside of
     * [JSON](/docs/guides/database/json) columns. Postgres offers some
     * [operators](/docs/guides/database/json#query-the-jsonb-data) for
     * querying JSON data.
     *
     * @example Querying JSON data
     * ```ts
     * const { data, error } = await supabase
     *   .from('users')
     *   .select(`
     *     id, name,
     *     address->city
     *   `)
     * ```
     *
     * @exampleSql Querying JSON data
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
     *   (1, 'Frodo', '{"city":"Hobbiton"}');
     * ```
     *
     * @exampleResponse Querying JSON data
     * ```json
     * {
     *   "data": [
     *     {
     *       "id": 1,
     *       "name": "Frodo",
     *       "city": "Hobbiton"
     *     }
     *   ],
     *   "status": 200,
     *   "statusText": "OK"
     * }
     * ```
     *
     * @exampleDescription Querying referenced table with inner join
     * If you don't want to return the referenced table contents, you can leave the parenthesis empty.
     * Like `.select('name, orchestral_sections!inner()')`.
     *
     * @example Querying referenced table with inner join
     * ```ts
     * const { data, error } = await supabase
     *   .from('instruments')
     *   .select('name, orchestral_sections!inner(name)')
     *   .eq('orchestral_sections.name', 'woodwinds')
     *   .limit(1)
     * ```
     *
     * @exampleSql Querying referenced table with inner join
     * ```sql
     * create table orchestral_sections (
     *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
     *   "name" text
     * );
     *
     * create table instruments (
     *   "id" "uuid" primary key default "extensions"."uuid_generate_v4"() not null,
     *   "name" text,
     *   "section_id" "uuid" references public.orchestral_sections on delete cascade
     * );
     *
     * with section as (
     *   insert into orchestral_sections (name)
     *   values ('woodwinds') returning id
     * )
     * insert into instruments (name, section_id) values
     * ('flute', (select id from section)),
     * ('clarinet', (select id from section)),
     * ('bassoon', (select id from section)),
     * ('piccolo', (select id from section));
     * ```
     *
     * @exampleResponse Querying referenced table with inner join
     * ```json
     * {
     *   "data": [
     *     {
     *       "name": "flute",
     *       "orchestral_sections": {"name": "woodwinds"}
     *     }
     *   ],
     *   "status": 200,
     *   "statusText": "OK"
     * }
     * ```
     *
     * @exampleDescription Switching schemas per query
     * In addition to setting the schema during initialization, you can also switch schemas on a per-query basis.
     * Make sure you've set up your [database privileges and API settings](/docs/guides/api/using-custom-schemas).
     *
     * @example Switching schemas per query
     * ```ts
     * const { data, error } = await supabase
     *   .schema('myschema')
     *   .from('mytable')
     *   .select()
     * ```
     *
     * @exampleSql Switching schemas per query
     * ```sql
     * create schema myschema;
     *
     * create table myschema.mytable (
     *   id uuid primary key default gen_random_uuid(),
     *   data text
     * );
     *
     * insert into myschema.mytable (data) values ('mydata');
     * ```
     *
     * @exampleResponse Switching schemas per query
     * ```json
     * {
     *   "data": [
     *     {
     *       "id": "4162e008-27b0-4c0f-82dc-ccaeee9a624d",
     *       "data": "mydata"
     *     }
     *   ],
     *   "status": 200,
     *   "statusText": "OK"
     * }
     * ```
       */
  select<
    Query extends string = '*',
    ResultOne = GetResult<
      Schema,
      Relation['Row'],
      RelationName,
      Relationships,
      Query,
      ClientOptions
    >,
  >(
    columns?: Query,
    options?: {
      head?: boolean
      count?: 'exact' | 'planned' | 'estimated'
    }
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    Relation['Row'],
    ResultOne[],
    RelationName,
    Relationships,
    'GET'
  > {
    const { head = false, count } = options ?? {}

    const method = head ? 'HEAD' : 'GET'
    // Remove whitespaces except when quoted
    let quoted = false
    const cleanedColumns = (columns ?? '*')
      .split('')
      .map((c) => {
        if (/\s/.test(c) && !quoted) {
          return ''
        }
        if (c === '"') {
          quoted = !quoted
        }
        return c
      })
      .join('')

    const { url, headers } = this.cloneRequestState()
    url.searchParams.set('select', cleanedColumns)

    if (count) {
      headers.append('Prefer', `count=${count}`)
    }

    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit,
    })
  }

  // TODO(v3): Make `defaultToNull` consistent for both single & bulk inserts.
  insert<Row extends Relation extends { Insert: unknown } ? Relation['Insert'] : never>(
    values: Row,
    options?: {
      count?: 'exact' | 'planned' | 'estimated'
    }
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    Relation['Row'],
    null,
    RelationName,
    Relationships,
    'POST'
  >
  insert<Row extends Relation extends { Insert: unknown } ? Relation['Insert'] : never>(
    values: Row[],
    options?: {
      count?: 'exact' | 'planned' | 'estimated'
      defaultToNull?: boolean
    }
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    Relation['Row'],
    null,
    RelationName,
    Relationships,
    'POST'
  >
  /**
   * Perform an INSERT into the table or view.
   *
   * By default, inserted rows are not returned. To return it, chain the call
   * with `.select()`.
   *
   * @param values - The values to insert. Pass an object to insert a single row
   * or an array to insert multiple rows.
   *
   * @param options - Named parameters
   *
   * @param options.count - Count algorithm to use to count inserted rows.
   *
   * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
   * hood.
   *
   * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
   * statistics under the hood.
   *
   * `"estimated"`: Uses exact count for low numbers and planned count for high
   * numbers.
   *
   * @param options.defaultToNull - Make missing fields default to `null`.
   * Otherwise, use the default value for the column. Only applies for bulk
   * inserts.
   *
   * @category Database
   *
   * @example Create a record
   * ```ts
   * const { error } = await supabase
   *   .from('countries')
   *   .insert({ id: 1, name: 'Mordor' })
   * ```
   *
   * @exampleSql Create a record
   * ```sql
   * create table
   *   countries (id int8 primary key, name text);
   * ```
   *
   * @exampleResponse Create a record
   * ```json
   * {
   *   "status": 201,
   *   "statusText": "Created"
   * }
   * ```
   *
   * @example Create a record and return it
   * ```ts
   * const { data, error } = await supabase
   *   .from('countries')
   *   .insert({ id: 1, name: 'Mordor' })
   *   .select()
   * ```
   *
   * @exampleSql Create a record and return it
   * ```sql
   * create table
   *   countries (id int8 primary key, name text);
   * ```
   *
   * @exampleResponse Create a record and return it
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "name": "Mordor"
   *     }
   *   ],
   *   "status": 201,
   *   "statusText": "Created"
   * }
   * ```
   *
   * @exampleDescription Bulk create
   * A bulk create operation is handled in a single transaction.
   * If any of the inserts fail, none of the rows are inserted.
   *
   * @example Bulk create
   * ```ts
   * const { error } = await supabase
   *   .from('countries')
   *   .insert([
   *     { id: 1, name: 'Mordor' },
   *     { id: 1, name: 'The Shire' },
   *   ])
   * ```
   *
   * @exampleSql Bulk create
   * ```sql
   * create table
   *   countries (id int8 primary key, name text);
   * ```
   *
   * @exampleResponse Bulk create
   * ```json
   * {
   *   "error": {
   *     "code": "23505",
   *     "details": "Key (id)=(1) already exists.",
   *     "hint": null,
   *     "message": "duplicate key value violates unique constraint \"countries_pkey\""
   *   },
   *   "status": 409,
   *   "statusText": "Conflict"
   * }
   * ```
   */
  insert<Row extends Relation extends { Insert: unknown } ? Relation['Insert'] : never>(
    values: Row | Row[],
    {
      count,
      defaultToNull = true,
    }: {
      count?: 'exact' | 'planned' | 'estimated'
      defaultToNull?: boolean
    } = {}
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    Relation['Row'],
    null,
    RelationName,
    Relationships,
    'POST'
  > {
    const method = 'POST'
    const { url, headers } = this.cloneRequestState()

    if (count) {
      headers.append('Prefer', `count=${count}`)
    }
    if (!defaultToNull) {
      headers.append('Prefer', `missing=default`)
    }

    if (Array.isArray(values)) {
      const columns = values.reduce((acc, x) => acc.concat(Object.keys(x)), [] as string[])
      if (columns.length > 0) {
        const uniqueColumns = [...new Set(columns)].map((column) => `"${column}"`)
        url.searchParams.set('columns', uniqueColumns.join(','))
      }
    }

    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      body: values,
      fetch: this.fetch ?? fetch,
      urlLengthLimit: this.urlLengthLimit,
    })
  }

  // TODO(v3): Make `defaultToNull` consistent for both single & bulk upserts.
  upsert<Row extends Relation extends { Insert: unknown } ? Relation['Insert'] : never>(
    values: Row,
    options?: {
      onConflict?: string
      ignoreDuplicates?: boolean
      count?: 'exact' | 'planned' | 'estimated'
    }
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    Relation['Row'],
    null,
    RelationName,
    Relationships,
    'POST'
  >
  upsert<Row extends Relation extends { Insert: unknown } ? Relation['Insert'] : never>(
    values: Row[],
    options?: {
      onConflict?: string
      ignoreDuplicates?: boolean
      count?: 'exact' | 'planned' | 'estimated'
      defaultToNull?: boolean
    }
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    Relation['Row'],
    null,
    RelationName,
    Relationships,
    'POST'
  >
  /**
   * Perform an UPSERT on the table or view. Depending on the column(s) passed
   * to `onConflict`, `.upsert()` allows you to perform the equivalent of
   * `.insert()` if a row with the corresponding `onConflict` columns doesn't
   * exist, or if it does exist, perform an alternative action depending on
   * `ignoreDuplicates`.
   *
   * By default, upserted rows are not returned. To return it, chain the call
   * with `.select()`.
   *
   * @param values - The values to upsert with. Pass an object to upsert a
   * single row or an array to upsert multiple rows.
   *
   * @param options - Named parameters
   *
   * @param options.onConflict - Comma-separated UNIQUE column(s) to specify how
   * duplicate rows are determined. Two rows are duplicates if all the
   * `onConflict` columns are equal.
   *
   * @param options.ignoreDuplicates - If `true`, duplicate rows are ignored. If
   * `false`, duplicate rows are merged with existing rows.
   *
   * @param options.count - Count algorithm to use to count upserted rows.
   *
   * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
   * hood.
   *
   * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
   * statistics under the hood.
   *
   * `"estimated"`: Uses exact count for low numbers and planned count for high
   * numbers.
   *
   * @param options.defaultToNull - Make missing fields default to `null`.
   * Otherwise, use the default value for the column. This only applies when
   * inserting new rows, not when merging with existing rows under
   * `ignoreDuplicates: false`. This also only applies when doing bulk upserts.
   *
   * @example Upsert a single row using a unique key
   * ```ts
   * // Upserting a single row, overwriting based on the 'username' unique column
   * const { data, error } = await supabase
   *   .from('users')
   *   .upsert({ username: 'supabot' }, { onConflict: 'username' })
   *
   * // Example response:
   * // {
   * //   data: [
   * //     { id: 4, message: 'bar', username: 'supabot' }
   * //   ],
   * //   error: null
   * // }
   * ```
   *
   * @example Upsert with conflict resolution and exact row counting
   * ```ts
   * // Upserting and returning exact count
   * const { data, error, count } = await supabase
   *   .from('users')
   *   .upsert(
   *     {
   *       id: 3,
   *       message: 'foo',
   *       username: 'supabot'
   *     },
   *     {
   *       onConflict: 'username',
   *       count: 'exact'
   *     }
   *   )
   *
   * // Example response:
   * // {
   * //   data: [
   * //     {
   * //       id: 42,
   * //       handle: "saoirse",
   * //       display_name: "Saoirse"
   * //     }
   * //   ],
   * //   count: 1,
   * //   error: null
   * // }
   * ```
   *
   * @category Database
   *
   * @remarks
   * - Primary keys must be included in `values` to use upsert.
   *
   * @example Upsert your data
   * ```ts
   * const { data, error } = await supabase
   *   .from('instruments')
   *   .upsert({ id: 1, name: 'piano' })
   *   .select()
   * ```
   *
   * @exampleSql Upsert your data
   * ```sql
   * create table
   *   instruments (id int8 primary key, name text);
   *
   * insert into
   *   instruments (id, name)
   * values
   *   (1, 'harpsichord');
   * ```
   *
   * @exampleResponse Upsert your data
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "name": "piano"
   *     }
   *   ],
   *   "status": 201,
   *   "statusText": "Created"
   * }
   * ```
   *
   * @example Bulk Upsert your data
   * ```ts
   * const { data, error } = await supabase
   *   .from('instruments')
   *   .upsert([
   *     { id: 1, name: 'piano' },
   *     { id: 2, name: 'harp' },
   *   ])
   *   .select()
   * ```
   *
   * @exampleSql Bulk Upsert your data
   * ```sql
   * create table
   *   instruments (id int8 primary key, name text);
   *
   * insert into
   *   instruments (id, name)
   * values
   *   (1, 'harpsichord');
   * ```
   *
   * @exampleResponse Bulk Upsert your data
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "name": "piano"
   *     },
   *     {
   *       "id": 2,
   *       "name": "harp"
   *     }
   *   ],
   *   "status": 201,
   *   "statusText": "Created"
   * }
   * ```
   *
   * @exampleDescription Upserting into tables with constraints
   * In the following query, `upsert()` implicitly uses the `id`
   * (primary key) column to determine conflicts. If there is no existing
   * row with the same `id`, `upsert()` inserts a new row, which
   * will fail in this case as there is already a row with `handle` `"saoirse"`.
   * Using the `onConflict` option, you can instruct `upsert()` to use
   * another column with a unique constraint to determine conflicts.
   *
   * @example Upserting into tables with constraints
   * ```ts
   * const { data, error } = await supabase
   *   .from('users')
   *   .upsert({ id: 42, handle: 'saoirse', display_name: 'Saoirse' })
   *   .select()
   * ```
   *
   * @exampleSql Upserting into tables with constraints
   * ```sql
   * create table
   *   users (
   *     id int8 generated by default as identity primary key,
   *     handle text not null unique,
   *     display_name text
   *   );
   *
   * insert into
   *   users (id, handle, display_name)
   * values
   *   (1, 'saoirse', null);
   * ```
   *
   * @exampleResponse Upserting into tables with constraints
   * ```json
   * {
   *   "error": {
   *     "code": "23505",
   *     "details": "Key (handle)=(saoirse) already exists.",
   *     "hint": null,
   *     "message": "duplicate key value violates unique constraint \"users_handle_key\""
   *   },
   *   "status": 409,
   *   "statusText": "Conflict"
   * }
   * ```
   */

  upsert<Row extends Relation extends { Insert: unknown } ? Relation['Insert'] : never>(
    values: Row | Row[],
    {
      onConflict,
      ignoreDuplicates = false,
      count,
      defaultToNull = true,
    }: {
      onConflict?: string
      ignoreDuplicates?: boolean
      count?: 'exact' | 'planned' | 'estimated'
      defaultToNull?: boolean
    } = {}
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    Relation['Row'],
    null,
    RelationName,
    Relationships,
    'POST'
  > {
    const method = 'POST'
    const { url, headers } = this.cloneRequestState()

    headers.append('Prefer', `resolution=${ignoreDuplicates ? 'ignore' : 'merge'}-duplicates`)

    if (onConflict !== undefined) url.searchParams.set('on_conflict', onConflict)
    if (count) {
      headers.append('Prefer', `count=${count}`)
    }
    if (!defaultToNull) {
      headers.append('Prefer', 'missing=default')
    }

    if (Array.isArray(values)) {
      const columns = values.reduce((acc, x) => acc.concat(Object.keys(x)), [] as string[])
      if (columns.length > 0) {
        const uniqueColumns = [...new Set(columns)].map((column) => `"${column}"`)
        url.searchParams.set('columns', uniqueColumns.join(','))
      }
    }

    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      body: values,
      fetch: this.fetch ?? fetch,
      urlLengthLimit: this.urlLengthLimit,
    })
  }

  /**
   * Perform an UPDATE on the table or view.
   *
   * By default, updated rows are not returned. To return it, chain the call
   * with `.select()` after filters.
   *
   * @param values - The values to update with
   *
   * @param options - Named parameters
   *
   * @param options.count - Count algorithm to use to count updated rows.
   *
   * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
   * hood.
   *
   * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
   * statistics under the hood.
   *
   * `"estimated"`: Uses exact count for low numbers and planned count for high
   * numbers.
   *
   * @category Database
   *
   * @remarks
   * - `update()` should always be combined with [Filters](/docs/reference/javascript/using-filters) to target the item(s) you wish to update.
   *
   * @example Updating your data
   * ```ts
   * const { error } = await supabase
   *   .from('instruments')
   *   .update({ name: 'piano' })
   *   .eq('id', 1)
   * ```
   *
   * @exampleSql Updating your data
   * ```sql
   * create table
   *   instruments (id int8 primary key, name text);
   *
   * insert into
   *   instruments (id, name)
   * values
   *   (1, 'harpsichord');
   * ```
   *
   * @exampleResponse Updating your data
   * ```json
   * {
   *   "status": 204,
   *   "statusText": "No Content"
   * }
   * ```
   *
   * @example Update a record and return it
   * ```ts
   * const { data, error } = await supabase
   *   .from('instruments')
   *   .update({ name: 'piano' })
   *   .eq('id', 1)
   *   .select()
   * ```
   *
   * @exampleSql Update a record and return it
   * ```sql
   * create table
   *   instruments (id int8 primary key, name text);
   *
   * insert into
   *   instruments (id, name)
   * values
   *   (1, 'harpsichord');
   * ```
   *
   * @exampleResponse Update a record and return it
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "name": "piano"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @exampleDescription Updating JSON data
   * Postgres offers some
   * [operators](/docs/guides/database/json#query-the-jsonb-data) for
   * working with JSON data. Currently, it is only possible to update the entire JSON document.
   *
   * @example Updating JSON data
   * ```ts
   * const { data, error } = await supabase
   *   .from('users')
   *   .update({
   *     address: {
   *       street: 'Melrose Place',
   *       postcode: 90210
   *     }
   *   })
   *   .eq('address->postcode', 90210)
   *   .select()
   * ```
   *
   * @exampleSql Updating JSON data
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
   *   (1, 'Michael', '{ "postcode": 90210 }');
   * ```
   *
   * @exampleResponse Updating JSON data
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "name": "Michael",
   *       "address": {
   *         "street": "Melrose Place",
   *         "postcode": 90210
   *       }
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   */
  update<Row extends Relation extends { Update: unknown } ? Relation['Update'] : never>(
    values: Row,
    {
      count,
    }: {
      count?: 'exact' | 'planned' | 'estimated'
    } = {}
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    Relation['Row'],
    null,
    RelationName,
    Relationships,
    'PATCH'
  > {
    const method = 'PATCH'
    const { url, headers } = this.cloneRequestState()

    if (count) {
      headers.append('Prefer', `count=${count}`)
    }

    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      body: values,
      fetch: this.fetch ?? fetch,
      urlLengthLimit: this.urlLengthLimit,
    })
  }

  /**
   * Perform a DELETE on the table or view.
   *
   * By default, deleted rows are not returned. To return it, chain the call
   * with `.select()` after filters.
   *
   * @param options - Named parameters
   *
   * @param options.count - Count algorithm to use to count deleted rows.
   *
   * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
   * hood.
   *
   * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
   * statistics under the hood.
   *
   * `"estimated"`: Uses exact count for low numbers and planned count for high
   * numbers.
   *
   * @category Database
   *
   * @remarks
   * - `delete()` should always be combined with [filters](/docs/reference/javascript/using-filters) to target the item(s) you wish to delete.
   * - If you use `delete()` with filters and you have
   *   [RLS](/docs/learn/auth-deep-dive/auth-row-level-security) enabled, only
   *   rows visible through `SELECT` policies are deleted. Note that by default
   *   no rows are visible, so you need at least one `SELECT`/`ALL` policy that
   *   makes the rows visible.
   * - When using `delete().in()`, specify an array of values to target multiple rows with a single query. This is particularly useful for batch deleting entries that share common criteria, such as deleting users by their IDs. Ensure that the array you provide accurately represents all records you intend to delete to avoid unintended data removal.
   *
   * @example Delete a single record
   * ```ts
   * const response = await supabase
   *   .from('countries')
   *   .delete()
   *   .eq('id', 1)
   * ```
   *
   * @exampleSql Delete a single record
   * ```sql
   * create table
   *   countries (id int8 primary key, name text);
   *
   * insert into
   *   countries (id, name)
   * values
   *   (1, 'Mordor');
   * ```
   *
   * @exampleResponse Delete a single record
   * ```json
   * {
   *   "status": 204,
   *   "statusText": "No Content"
   * }
   * ```
   *
   * @example Delete a record and return it
   * ```ts
   * const { data, error } = await supabase
   *   .from('countries')
   *   .delete()
   *   .eq('id', 1)
   *   .select()
   * ```
   *
   * @exampleSql Delete a record and return it
   * ```sql
   * create table
   *   countries (id int8 primary key, name text);
   *
   * insert into
   *   countries (id, name)
   * values
   *   (1, 'Mordor');
   * ```
   *
   * @exampleResponse Delete a record and return it
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": 1,
   *       "name": "Mordor"
   *     }
   *   ],
   *   "status": 200,
   *   "statusText": "OK"
   * }
   * ```
   *
   * @example Delete multiple records
   * ```ts
   * const response = await supabase
   *   .from('countries')
   *   .delete()
   *   .in('id', [1, 2, 3])
   * ```
   *
   * @exampleSql Delete multiple records
   * ```sql
   * create table
   *   countries (id int8 primary key, name text);
   *
   * insert into
   *   countries (id, name)
   * values
   *   (1, 'Rohan'), (2, 'The Shire'), (3, 'Mordor');
   * ```
   *
   * @exampleResponse Delete multiple records
   * ```json
   * {
   *   "status": 204,
   *   "statusText": "No Content"
   * }
   * ```
   */
  delete({
    count,
  }: {
    count?: 'exact' | 'planned' | 'estimated'
  } = {}): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    Relation['Row'],
    null,
    RelationName,
    Relationships,
    'DELETE'
  > {
    const method = 'DELETE'
    const { url, headers } = this.cloneRequestState()

    if (count) {
      headers.append('Prefer', `count=${count}`)
    }

    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      fetch: this.fetch ?? fetch,
      urlLengthLimit: this.urlLengthLimit,
    })
  }
}
