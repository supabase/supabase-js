type IsPostgrest13<PostgrestVersion extends string | undefined> =
  PostgrestVersion extends `13${string}` ? true : false
type IsPostgrest14<PostgrestVersion extends string | undefined> =
  PostgrestVersion extends `14${string}` ? true : false

type IsPostgrestVersionGreaterThan12<PostgrestVersion extends string | undefined> =
  IsPostgrest13<PostgrestVersion> extends true
    ? true
    : IsPostgrest14<PostgrestVersion> extends true
      ? true
      : false

export type MaxAffectedEnabled<PostgrestVersion extends string | undefined> =
  IsPostgrestVersionGreaterThan12<PostgrestVersion> extends true ? true : false

export type SpreadOnManyEnabled<PostgrestVersion extends string | undefined> =
  IsPostgrestVersionGreaterThan12<PostgrestVersion> extends true ? true : false
