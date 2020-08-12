declare module '@supabase/supabase-js' {
  interface User {
    app_metadata: {
      provider: 'email'
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

  interface AuthResponse {
    status: number
    body: {
      user: User
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
    signup: (email: string, password: string) => Promise<AuthResponse>
    /**
     * If an account is created, users can login to your app.
     * After they have logged in, all interactions using the Supabase JS client will be performed as "that user".
     */
    login: (email: string, password: string) => Promise<AuthResponse>
    /**
     * Get the JSON data for the logged in user.
     */
    user: () => Promise<User>
    /**
     * After calling log out, all interactions using the Supabase JS client will be "anonymous".
     */
    logout: () => Promise<void>
  }

  enum FilterOperator {
    Equal = 'eq',
    NotEqual = 'neq',
    GreaterThan = 'gt',
    LessThan = 'lt',
    GreaterThanOrEqual = 'gte',
    LessThanOrEqual = 'lte',
    /** Finds all rows whose value in the stated columnName matches the supplied pattern. */
    Like = 'like',
    /** A case-sensitive version of `Like`. */
    ILike = 'ilike',
    /** A check for exact equality (null, true, false) */
    Is = 'is',
    /** ('name', 'in', ['Rio de Janeiro', 'San Francisco']) */
    In = 'in',
    /** Finds all rows whose json, array, or range value on the stated columnName contains the items specified in the filterObject */
    Contains = 'cs',
    Contained = 'cd',
    OverlapsArray = 'ova',
    OverlapsRange = 'ovr',
    StrictlyLeft = 'sl',
    StrictlyRight = 'sr',
    NotExtendLeft = 'nxl',
    NotExtendRight = 'nxr',
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
     * This allows you to apply various filters on your query. Filters can also be chained together.
     * Example: `.filter('name', 'eq', 'Paris')`
     */
    filter(
      /** Name of the database column. */
      columnName: keyof T,
      /** Name of filter operator to be utilised. */
      operator: FilterOperator | FilterOperatorString,
      /** Value to compare to. Exact data type of criteria depends on the operator used. */
      criteria: T[keyof T]
    ): PostgrestClient<T>
    /**
     * Reverse of .filter(). Returns rows that do not meet the criteria specified using the columnName and operator provided.
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
     * Finds rows that exactly match the specified filterObject. Equivalent of multiple `filter('columnName', 'eq', criteria)`.
     */
    match(
      /** Example: `.match({name: 'Beijing', country_id: 156})` */
      filterObject: { [columnName: string]: T[keyof T] }
    ): PostgrestClient<T>
    /**
     * Finds all rows whose value on the stated columnName exactly matches the specified filterValue. Equivalent of filter(columnName, 'eq', criteria).
     *
     * Example: `.eq('name', 'San Francisco')`
     */
    eq(columnName: keyof T, filterValue: T[keyof T]): PostgrestClient<T>
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
  }

  interface SupabaseRealtimeClient {
    subscribe(): SupabaseRealtimeClient
    unsubscribe(): SupabaseRealtimeClient
    schema: string
    tableName: string
    uuid: string
  }

  interface SupabaseRealtimePayload<T> {
    commit_timestamp: string
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new: T
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
       * Omitting `columnQuery` is equal to `.select('*').
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
