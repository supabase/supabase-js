/** Major part of a PostgREST version string: '12.2.3' → '12', '14' → '14'. */
type PostgrestMajor<PostgrestVersion extends string> =
  PostgrestVersion extends `${infer Major}.${string}` ? Major : PostgrestVersion

/** PostgREST majors released before 13 (there were no 1–4: 0.x was followed by 5). */
type PostgrestMajorUpTo12 = `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`

/**
 * Whether the server is PostgREST 13 or newer, which unlocks `maxAffected()` and spread on
 * to-many relationships. Every major from 13 on counts, so a new PostgREST release doesn't need
 * a library update. An unset, non-literal or non-numeric version stays on the 12 typings.
 */
type IsPostgrestVersionGreaterThan12<PostgrestVersion extends string | undefined> =
  PostgrestVersion extends string
    ? string extends PostgrestVersion
      ? false
      : PostgrestMajor<PostgrestVersion> extends `${number}`
        ? PostgrestMajor<PostgrestVersion> extends PostgrestMajorUpTo12
          ? false
          : true
        : false
    : false

export type MaxAffectedEnabled<PostgrestVersion extends string | undefined> =
  IsPostgrestVersionGreaterThan12<PostgrestVersion> extends true ? true : false

export type SpreadOnManyEnabled<PostgrestVersion extends string | undefined> =
  IsPostgrestVersionGreaterThan12<PostgrestVersion> extends true ? true : false
