declare module '@supabase/supabase-js' {
  enum FilterOperator {
    /** Finds all rows whose value on the stated columnName exactly matches the specified filterValue. */
    Equal = 'eq',
    /** Finds all rows whose value on the stated columnName does not match the specified filterValue. */
    NotEqual = 'neq',
    /** Finds all rows whose value on the stated columnName is greater than the specified filterValue. */
    GreaterThan = 'gt',
    /** Finds all rows whose value on the stated columnName is less than the specified filterValue. */
    LessThan = 'lt',
    /** Finds all rows whose value on the stated columnName is greater than or equal to the specified filterValue. */
    GreaterThanOrEqual = 'gte',
    /** Finds all rows whose value on the stated columnName is less than or equal to the specified filterValue. */
    LessThanOrEqual = 'lte',
    /** Finds all rows whose value in the stated columnName matches the supplied pattern. */
    Like = 'like',
    /** A case-insensitive version of `like`. */
    ILike = 'ilike',
    /** A check for exact equality (null, true, false) */
    Is = 'is',
    /** Finds all rows whose value on the stated columnName is found on the specified filterArray. */
    In = 'in',
    /** Finds all rows whose json, array, or range value on the stated columnName contains the items specified in the filterObject. */
    Contains = 'cs',
    /** Finds all rows whose json, array, or range value on the stated columnName is contained by the specific filterObject. */
    Contained = 'cd',
    /** Finds all rows whose array value on the stated columnName overlaps with the specified filterArray. */
    OverlapsArray = 'ova',
    /** Finds all rows whose range value on the stated columnName overlaps with the specified filterRange. */
    OverlapsRange = 'ovr',
    /** Finds all rows whose range value on the stated columnName is strictly on the left hand side of the specified filterRange. */
    StrictlyLeft = 'sl',
    /** Finds all rows whose range value on the stated columnName is strictly on the right hand side of the specified filterRange. */
    StrictlyRight = 'sr',
    /** Finds all rows whose range value on the stated columnName does not extend to the left of the specified filterRange. */
    NotExtendLeft = 'nxl',
    /** Finds all rows whose range value on the stated columnName does not extend to the right of the specified filterRange. */
    NotExtendRight = 'nxr',
    /** Finds all rows whose range value on the stated columnName is adjacent to the specified filterRange. */
    Adjacent = 'adj',
  }
  type FilterOperatorString =
    | 'eq'
    | 'neq'
    | 'gt'
    | 'lt'
    | 'gte'
    | 'lte'
    | 'like'
    | 'ilike'
    | 'is'
    | 'in'
    | 'cs'
    | 'cd'
    | 'ova'
    | 'ovr'
    | 'sl'
    | 'sr'
    | 'nxr'
    | 'nxl'
    | 'adj'

  interface SupabaseAuthUser {
    app_metadata: {
      provider?: string
      [key: string]: any
    }
    user_metadata: {
      [key: string]: any
    }
    aud: string
    created_at: string
    confirmed_at: string
    email: string
    id: string
    last_sign_in_at: string
    role: string
    updated_at: string
  }

  interface SupabaseAuthResponse {
    status: number
    body: {
      user: SupabaseAuthUser
      access_token: string
      refresh_token: string
      expires_in: number
      unauthorized: boolean
    }
  }

  interface Auth {
    /**
     * Allow your users to sign up and create a new account.
     * After they have signed up, all interactions using the Supabase JS client will be performed as "that user".
     */
    signup: (email: string, password: string) => Promise<SupabaseAuthResponse>
    /**
     * If an account is created, users can login to your app.
     * After they have logged in, all interactions using the Supabase JS client will be performed as "that user".
     */
    login: (email: string, password: string) => Promise<SupabaseAuthResponse>
    /**
     * Get the JSON data for the logged in user.
     */
    user: () => Promise<SupabaseAuthUser>
    /**
     * After calling log out, all interactions using the Supabase JS client will be "anonymous".
     */
    logout: () => Promise<void>
  }

  interface PostgrestResponse<T> {
    body: T[] | null
    status: number
    statusCode: number
    statusText: string
  }

  interface PostgrestSingleResponse<T> {
    body: T | null
    status: number
    statusCode: number
    statusText: string
  }

  interface PostgrestClient<T> extends Promise<PostgrestResponse<T>> {
    /**
     * Return a single object as response body. Result must be single object, otherwise returns `406 Not Acceptable`.
     *
     * Note: this must be called at the end of your query chain!
     */
    single(): Promise<PostgrestSingleResponse<T>>
    /**
     * Limit the amount of records to be returned.
     */
    limit(
      /** Specifies number of items to be returned at most. */
      criteria: number,
      /** Name of chosen foreignTable to apply the limit on. Used if foreign tables are present. */
      foreignTableName?: string | null
    ): PostgrestClient<T>
    /**
     * Skip a number of rows before returning rows.
     */
    offset(
      /** Index or position of the start of the specified range. */
      skipCount: number,
      foreignTableName?: string | null
    ): PostgrestClient<T>
    /**
     * Orders your data before fetching.
     */
    order(
      /** Name of chosen column to base the order on. */
      columnName: keyof T,
      /** Specifies whether the order will be ascending or descending. Default is false */
      sortAscending?: boolean,
      /** Specifies whether null values will be displayed first. Default is false */
      nullsFirst?: boolean
    ): PostgrestClient<T>
    /**
     * Paginates your request.
     */
    range(
      /** Index or position of the start of the specified range. */
      fromIndex: number,
      /** Index or position of the end of the specified range. If not stated, all remaining rows after the starting index will be returned. */
      toIndex?: number
    ): PostgrestClient<T>
    /**
     * This allows you to apply various filters on your query. Filters can also be chained together.
     * Example: `.filter('name', 'eq', 'Paris')`
     */
    filter(
      /** Name of the database column. */
      columnName: keyof T,
      /** Name of filter operator to be utilised. */
      operator: FilterOperator | FilterOperatorString,
      /** Value to compare to. Exact data type of criteria depends on the operator used. */
      criteria: any
    ): PostgrestClient<T>
    /**
     * Reverse of `.filter()`. Returns rows that do not meet the criteria specified using the columnName and operator provided.
     * Example: `.not('name', 'eq', 'Paris')`
     */
    not(
      /** Name of the database column. */
      columnName: keyof T,
      /** Name of filter operator to be utilised. */
      operator: FilterOperator,
      /** Value to compare to. Exact data type of criteria depends on the operator used. */
      criteria: T[keyof T]
    ): PostgrestClient<T>
    /**
     * To write append an OR filter, which should be made up of several other filters.
     *
     * Example: `.or('id.gt.20,and(name.eq.New Zealand,name.eq.France)')`
     */
    or(criteria: string): PostgrestClient<T>
    /**
     * Finds rows that exactly match the specified filterObject. Equivalent of multiple `filter('columnName', 'eq', criteria)`.
     */
    match(
      /** Example: `.match({name: 'Beijing', country_id: 156})` */
      filterObject: { [columnName: string]: T[keyof T] }
    ): PostgrestClient<T>
    /**
     * Finds all rows whose value on the stated columnName exactly matches the specified filterValue. Equivalent of `filter(columnName, 'eq', criteria)`.
     *
     * Example: `.eq('name', 'San Francisco')`
     */
    eq(columnName: keyof T, filterValue: T[keyof T]): PostgrestClient<T>
    /**
     * Finds all rows whose value on the stated columnName does not match the specified filterValue. Equivalent of `filter(columnName, 'neq', criteria)`.
     *
     * Example: `.neq('name', 'San Francisco')`
     */
    neq(columnName: keyof T, filterValue: T[keyof T]): PostgrestClient<T>
    /**
     * Finds all rows whose value on the stated columnName is greater than the specified filterValue. Eqiuvalent of `filter(columnName, 'gt', criteria)`.
     *
     * Example: `.gt('level', 9000)`
     */
    gt(columnName: keyof T, filterValue: T[keyof T]): PostgrestClient<T>
    /**
     * Finds all rows whose value on the stated columnName is less than the specified filterValue. Eqiuvalent of `filter(columnName, 'lt', criteria)`.
     *
     * Example: `.lt('level', 9000)`
     */
    lt(columnName: keyof T, filterValue: T[keyof T]): PostgrestClient<T>
    /**
     * Finds all rows whose value on the stated columnName is greater than or equal to the specified filterValue. Eqiuvalent of `filter(columnName, 'gte', criteria)`.
     *
     * Example: `.gte('level', 9000)`
     */
    gte(columnName: keyof T, filterValue: T[keyof T]): PostgrestClient<T>
    /**
     * Finds all rows whose value on the stated columnName is less than or equal to the specified filterValue. Eqiuvalent of `filter(columnName, 'lte', criteria)`.
     *
     * Example: `.lte('level', 9000)`
     */
    lte(columnName: keyof T, filterValue: T[keyof T]): PostgrestClient<T>
    /**
     * Finds all rows whose value in the stated columnName matches the supplied pattern. Equivalent of `filter(columnName, 'like', stringPattern)`.
     *
     * Example: `.like('name', '%LA%')`
     */
    like(columnName: keyof T, stringPattern: string): PostgrestClient<T>
    /**
     * A case-insensitive version of `like()`. Equivalent of `filter(columnName, 'ilike', stringPattern)`.
     *
     * Example: `.ilike('name', '%la%')`
     */
    ilike(columnName: keyof T, stringPattern: string): PostgrestClient<T>
    /**
     * A check for exact equality (null, true, false), finds all rows whose value on the state columnName exactly match the specified filterValue. Equivalent of `filter(columnName, 'is', filterValue)`.
     *
     * Example: `.is('name', null)`
     */
    is(columnName: keyof T, filterValue: null | boolean): PostgrestClient<T>
    /**
     * Finds all rows whose value on the stated columnName is found on the specified filterArray. Equivalent of `filter(columnName, 'in', criteria)`.
     *
     * Example: `.in('name', ['Rio de Janeiro', 'San Francisco'])`
     */
    in(columnName: keyof T, filterArray: Array<T[keyof T]>): PostgrestClient<T>
    /**
     * Finds all rows whose json, array, or range value on the stated columnName contains the items specified in the filterObject. Equivalent of `filter(columName, 'cs', criteria)`.
     *
     * Example: `.cs('main_exports', ['oil'])`
     */
    cs(columnName: keyof T, filterObject: object | Array<T[keyof T]>): PostgrestClient<T>
    /**
     * Finds all rows whose json, array, or range value on the stated columnName is contained by the specific filterObject. Equivalent of `filter(columName, 'cd', criteria)`.
     *
     * Example: `.cd('main_exports', ['cars', 'food', 'machine'])`
     */
    cd(columnName: keyof T, filterObject: object | Array<T[keyof T]>): PostgrestClient<T>
    /**
     * Finds all rows whose array value on the stated columnName overlaps with the specified filterArray. Equivalent of `filter(columnName, 'ova', criteria)`.
     *
     * Example: `.ova('main_exports', ['computers', 'minerals'])`
     */
    ova(columnName: keyof T, filterArray: Array<T[keyof T]>): PostgrestClient<T>
    /**
     * Finds all rows whose range value on the stated columnName overlaps with the specified filterRange. Equivalent of `filter(columnName, 'ovr', criteria)`.
     *
     * Example: `.ovr('population_range_millions', [150, 250])`
     */
    ovr(columnName: keyof T, filterRange: Array<T[keyof T]>): PostgrestClient<T>
    /**
     * Finds all rows whose range value on the stated columnName is strictly on the left hand side of the specified filterRange. Equivalent of `filter(columnName, 'sl', criteria)`.
     *
     * Example: `.sl('population_range_millions', [150, 250])`
     */
    sl(columnName: keyof T, filterRange: Array<T[keyof T]>): PostgrestClient<T>
    /**
     * Finds all rows whose range value on the stated columnName is strictly on the right hand side of the specified filterRange. Equivalent of `filter(columnName, 'sl', criteria)`.
     *
     * Example: `.sr('population_range_millions', [150, 250])`
     */
    sr(columnName: keyof T, filterRange: Array<T[keyof T]>): PostgrestClient<T>
    /**
     * Finds all rows whose range value on the stated columnName does not extend to the left of the specified filterRange. Equivalent of `filter(columnName, 'nxl', criteria)`.
     *
     * Example: `.nxl('population_range_millions', [150, 250])`
     */
    nxl(columnName: keyof T, filterRange: Array<T[keyof T]>): PostgrestClient<T>
    /**
     * Finds all rows whose range value on the stated columnName does not extend to the right of the specified filterRange. Equivalent of `filter(columnName, 'nxl', criteria)`.
     *
     * Example: `.nxr('population_range_millions', [150, 250])`
     */
    nxr(columnName: keyof T, filterRange: Array<T[keyof T]>): PostgrestClient<T>
    /**
     * Finds all rows whose range value on the stated columnName is adjacent to the specified filterRange. Equivalent of `filter(columnName, 'adj', criteria)`.
     *
     * Example: `.adj('population_range_millions', [70, 185])`
     */
    adj(columnName: keyof T, filterRange: Array<T[keyof T]>): PostgrestClient<T>
  }

  interface SupabaseRealtimeClient {
    /**
     * Subscribes to a specific table for changes in realtime.
     *
     * Note: If you want to receive the "previous" data for updates and deletes, you will need to set `REPLICA IDENTITY` to `FULL`, like this: `ALTER TABLE your_table REPLICA IDENTITY FULL;`.
     */
    subscribe(): SupabaseRealtimeClient
    /** Unsubscribes from a specific subscription. */
    unsubscribe(): SupabaseRealtimeClient
    schema: string
    tableName: string
    uuid: string
  }

  interface SupabaseRealtimePayload<T> {
    commit_timestamp: string
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    /** The new record. Present for 'INSERT' and 'UPDATE' events. */
    new: T
    /** The previous record. Present for 'UPDATE' and 'DELETE' events. */
    old: T
    schema: string
    table: string
  }

  interface SupabaseQueryClient<T> {
    /**
     * Read data.
     */
    select(
      /**
       * A comma separated list of columns. For example `.select('id, name')`.
       *
       * Omitting `columnQuery` is equal to `.select('*')`.
       */
      columnQuery?: string
    ): PostgrestClient<T>
    /**
     * Insert or upsert data.
     */
    insert(
      /**
       * A single object or an array of rows of type object which contain information to be saved into the selected table.
       */
      data: T | T[],
      /**
       * For upsert, if set to true, primary key columns would need to be included in the data parameter in order for an update to properly happen. Also, primary keys used must be natural, not surrogate.
       */
      options?: { upsert?: boolean }
    ): PostgrestClient<T>
    /**
     * Update data.
     *
     * It is to note that it is required to apply filters when using `.update()`. Not using filters would result in an error.
     *
     * Example: `supabase.from('cities').update({ name: 'Middle Earth' }).match({ name: 'Auckland' })`
     */
    update(data: T): PostgrestClient<T>
    /**
     * Delete data.
     *
     * It is to note that it is required to apply filters when using `.delete()`. Not using filters would result in an error.
     *
     * Example: `supabase.from('cities').delete().match({ name: 'Bielefeld' })`
     */
    delete(): PostgrestClient<T>
    /**
     * Subscribe to realtime changes in your databse.
     */
    on(
      /** The database event which you would like to receive updates for, or you can use the special wildcard `*` to listen to all changes. */
      eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
      callbackFunction: (payload: SupabaseRealtimePayload<T>) => void
    ): SupabaseRealtimeClient
  }

  interface SupabaseClient {
    /**
     * Supabase Auth allows you to create and manage user sessions for access to data that is secured by access policies.
     */
    auth: Auth
    /**
     * Name of the database table to perform an operation on.
     */
    from<T>(tableName: string): SupabaseQueryClient<T>
    /**
     * Stored procedures.
     */
    rpc<T>(
      /** Name of stored function in the database. */
      functionName: string,
      /** Parameters to be passed to the stored function. */
      functionParameters?: object | object[]
    ): PostgrestClient<T>
    /** Remove a subscription. */
    removeSubscription(reference: SupabaseRealtimeClient): void
    /** List of all subscriptions. */
    getSubscriptions(): SupabaseRealtimeClient[]
  }

  const createClient: (
    /**
     * The unique Supabase URL which is supplied when you create a new project in your project dashboard.
     */
    supabaseUrl: string,
    /**
     * The unique Supabase Key which is supplied when you create a new project in your project dashboard.
     */
    supabaseKey: string,
    options?: {
      autoRefreshToken?: boolean
      /**
       * You can switch in between schemas.
       * The schema however would need to be on the list of exposed schemas.
       * Defaults to the 'public' schema.
       * If there is the need to use more than one schema,
       * another instance of .createClient() would need to be instantiated.
       */
      schema: string
    }
  ) => SupabaseClient
}
