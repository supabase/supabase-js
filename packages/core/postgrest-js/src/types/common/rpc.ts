import type { GenericFunction, GenericSchema, GenericSetofOption } from './common'

// Functions matching utils
type IsMatchingArgs<
  FnArgs extends GenericFunction['Args'],
  PassedArgs extends GenericFunction['Args'],
> = [FnArgs] extends [Record<PropertyKey, never>]
  ? PassedArgs extends Record<PropertyKey, never>
    ? true
    : false
  : keyof PassedArgs extends keyof FnArgs
    ? PassedArgs extends FnArgs
      ? true
      : false
    : false

type MatchingFunctionArgs<
  Fn extends GenericFunction,
  Args extends GenericFunction['Args'],
> = Fn extends { Args: infer A extends GenericFunction['Args'] }
  ? IsMatchingArgs<A, Args> extends true
    ? Fn
    : never
  : false

type FindMatchingFunctionByArgs<
  FnUnion,
  Args extends GenericFunction['Args'],
> = FnUnion extends infer Fn extends GenericFunction ? MatchingFunctionArgs<Fn, Args> : false

// Types for working with database schemas
type TablesAndViews<Schema extends GenericSchema> = Schema['Tables'] & Exclude<Schema['Views'], ''>

// Utility types for working with unions
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never

type LastOf<T> =
  UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never

type IsAny<T> = 0 extends 1 & T ? true : false

type ExactMatch<T, S> = [T] extends [S] ? ([S] extends [T] ? true : false) : false

type ExtractExactFunction<Fns, Args> = Fns extends infer F
  ? F extends GenericFunction
    ? ExactMatch<F['Args'], Args> extends true
      ? F
      : never
    : never
  : never

type IsNever<T> = [T] extends [never] ? true : false

type RpcFunctionNotFound<FnName> = {
  Row: any
  Result: {
    error: true
  } & "Couldn't infer function definition matching provided arguments"
  RelationName: FnName
  Relationships: null
}

type CrossSchemaError<TableRef extends string> = {
  error: true
} & `Function returns SETOF from a different schema ('${TableRef}'). Use .overrideTypes<YourReturnType>() to specify the return type explicitly.`

// Tables in the current schema whose Row exactly matches a function's return
// row.
type TableByExactRow<Schema extends GenericSchema, Row> = {
  [K in keyof TablesAndViews<Schema>]: ExactMatch<
    TablesAndViews<Schema>[K]['Row'],
    Row
  > extends true
    ? K
    : never
}[keyof TablesAndViews<Schema>]

// The single table in the current schema whose Row exactly matches a
// function's return row, or never when the match is ambiguous. Used to resolve
// embedded resources when a function has no SetofOptions (older generated
// types): with several same-shaped tables, picking one would advertise the
// wrong table's relationships, so the caller falls back to the previous
// FnName/null behaviour instead.
type SingleTableByExactRow<Schema extends GenericSchema, Row> =
  TableByExactRow<Schema, Row> extends infer T
    ? [T] extends [never]
      ? never
      : T extends any
        ? Exclude<TableByExactRow<Schema, Row>, T> extends never
          ? T
          : never
        : never
    : never

// The table an RPC function returns rows of, resolved for embedded-resource
// typing. SetofOptions.to is normally the bare table name; some generated
// types spell it schema-qualified ('public.batches'), which is not a key of
// the current schema's Tables. The prefix is stripped only when it names the
// client's own schema (SchemaName) and the stripped table's Row matches the
// function's return row — a same-shaped table from another schema
// ('archive.batches' vs 'public.batches') must never supply the current
// schema's relationships, and when SchemaName is not a literal (untyped
// client) the qualified target is left unresolved.
export type RpcTargetTable<
  Schema extends GenericSchema,
  Fn extends GenericFunction,
  SchemaName extends string = string,
> = Fn['SetofOptions'] extends GenericSetofOption
  ? Fn['SetofOptions']['to'] extends keyof TablesAndViews<Schema>
    ? Fn['SetofOptions']['to']
    : Fn['SetofOptions']['to'] extends `${infer Prefix}.${infer Stripped}`
      ? string extends SchemaName
        ? never
        : Prefix extends SchemaName
          ? Stripped extends keyof TablesAndViews<Schema>
            ? ExactMatch<
                TablesAndViews<Schema>[Stripped]['Row'],
                Fn['Returns'] extends any[] ? Fn['Returns'][number] : Fn['Returns']
              > extends true
              ? Stripped
              : never
            : never
          : never
      : never
  : Fn['Returns'] extends any[]
    ? SingleTableByExactRow<Schema, Fn['Returns'][number]>
    : SingleTableByExactRow<Schema, Fn['Returns']>

export type GetRpcFunctionFilterBuilderByArgs<
  Schema extends GenericSchema,
  FnName extends string & keyof Schema['Functions'],
  Args,
  SchemaName extends string = string,
> = {
  0: Schema['Functions'][FnName]
  // If the Args is exactly never (function call without any params)
  1: IsAny<Schema> extends true
    ? any
    : IsNever<Args> extends true
      ? // Generated types spell a zero-argument definition either `Args: never` or
        // `Args: Record<PropertyKey, never>`, so both are matched before falling back to the last
        // function definition matched by name, which is for retro compatibility with a single
        // return and an union of Args
        IsNever<ExtractExactFunction<Schema['Functions'][FnName], Args>> extends true
        ? IsNever<
            ExtractExactFunction<Schema['Functions'][FnName], Record<PropertyKey, never>>
          > extends true
          ? LastOf<Schema['Functions'][FnName]>
          : ExtractExactFunction<Schema['Functions'][FnName], Record<PropertyKey, never>>
        : ExtractExactFunction<Schema['Functions'][FnName], Args>
      : Args extends Record<PropertyKey, never>
        ? LastOf<Schema['Functions'][FnName]>
        : // Otherwise, we attempt to match with one of the function definition in the union based
          // on the function arguments provided
          Args extends GenericFunction['Args']
          ? // This is for retro compatibility, if the funcition is defined with an single return and an union of Args
            // we fallback to the last function definition matched by name
            IsNever<
              LastOf<FindMatchingFunctionByArgs<Schema['Functions'][FnName], Args>>
            > extends true
            ? LastOf<Schema['Functions'][FnName]>
            : // Otherwise, we use the arguments based function definition narrowing to get the right value
              LastOf<FindMatchingFunctionByArgs<Schema['Functions'][FnName], Args>>
          : // If we can't find a matching function by args, we try to find one by function name
            ExtractExactFunction<Schema['Functions'][FnName], Args> extends GenericFunction
            ? ExtractExactFunction<Schema['Functions'][FnName], Args>
            : any
}[1] extends infer Fn
  ? // If we are dealing with an non-typed client everything is any
    IsAny<Fn> extends true
    ? { Row: any; Result: any; RelationName: FnName; Relationships: null }
    : // Otherwise, we use the arguments based function definition narrowing to get the right value
      Fn extends GenericFunction
      ? {
          Row: Fn['SetofOptions'] extends GenericSetofOption
            ? Fn['SetofOptions']['to'] extends keyof TablesAndViews<Schema>
              ? TablesAndViews<Schema>[Fn['SetofOptions']['to']]['Row']
              : // Cross-schema fallback: use Returns type when table is not in current schema
                Fn['Returns'] extends any[]
                ? Fn['Returns'][number] extends Record<string, unknown>
                  ? Fn['Returns'][number]
                  : CrossSchemaError<Fn['SetofOptions']['to'] & string>
                : Fn['Returns'] extends Record<string, unknown>
                  ? Fn['Returns']
                  : CrossSchemaError<Fn['SetofOptions']['to'] & string>
            : Fn['Returns'] extends any[]
              ? Fn['Returns'][number] extends Record<string, unknown>
                ? Fn['Returns'][number]
                : never
              : Fn['Returns'] extends Record<string, unknown>
                ? Fn['Returns']
                : never
          Result: Fn['SetofOptions'] extends GenericSetofOption
            ? Fn['SetofOptions']['isSetofReturn'] extends true
              ? Fn['SetofOptions']['isOneToOne'] extends true
                ? Fn['Returns'][]
                : Fn['Returns']
              : Fn['Returns']
            : Fn['Returns']
          // IsNever (bracketed) is required here: a bare `extends never`
          // conditional distributes over never and yields never, not the
          // fallback branch, which would break every RPC without a target.
          RelationName: IsNever<RpcTargetTable<Schema, Fn, SchemaName>> extends true
            ? Fn['SetofOptions'] extends GenericSetofOption
              ? Fn['SetofOptions']['to']
              : FnName
            : RpcTargetTable<Schema, Fn, SchemaName>
          Relationships: IsNever<RpcTargetTable<Schema, Fn, SchemaName>> extends true
            ? null
            : RpcTargetTable<Schema, Fn, SchemaName> extends keyof Schema['Tables']
              ? Schema['Tables'][RpcTargetTable<Schema, Fn, SchemaName>]['Relationships']
              : RpcTargetTable<Schema, Fn, SchemaName> extends keyof Schema['Views']
                ? Schema['Views'][RpcTargetTable<Schema, Fn, SchemaName>]['Relationships']
                : null
        }
      : // If we failed to find the function by argument, we still pass with any but also add an overridable
        Fn extends false
        ? RpcFunctionNotFound<FnName>
        : RpcFunctionNotFound<FnName>
  : RpcFunctionNotFound<FnName>
