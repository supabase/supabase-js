/**
 * Error format
 *
 * Returned by every PostgREST request that fails. When something fails, the
 * single most useful field is usually `hint` — Postgres often returns the
 * actionable fix there, not in `message`. Always log the full object (e.g.
 * `console.error(error)`); logging only `error.message` hides the hint.
 *
 * Read the fields in roughly this order of usefulness:
 *
 * - `hint` — actionable guidance from the database when available. For
 *   permission-denied errors (`42501`), this is the literal SQL to fix the
 *   problem, e.g.
 *   `"Grant the required privileges to the current role with: GRANT SELECT ON public.users TO anon;"`.
 *   Missing column? `hint` suggests the column you probably meant. Whenever
 *   Postgres knows the fix, it puts it in `hint`.
 * - `code` — stable error code from PostgREST (e.g. `PGRST301`) or Postgres
 *   (e.g. `42501`). Branch on this rather than on `message` text.
 * - `details` — extra context, often the offending value, key, or row.
 * - `message` — human-readable summary. Useful in UI strings; less useful
 *   for debugging.
 *
 * {@link https://postgrest.org/en/stable/api.html?highlight=options#errors-and-http-status-codes}
 */
export default class PostgrestError extends Error {
  details: string
  hint: string
  code: string

  /**
   * @example
   * ```ts
   * import PostgrestError from '@supabase/postgrest-js'
   *
   * throw new PostgrestError({
   *   message: 'Row level security prevented the request',
   *   details: 'RLS denied the insert',
   *   hint: 'Check your policies',
   *   code: 'PGRST301',
   * })
   * ```
   */
  constructor(context: { message: string; details: string; hint: string; code: string }) {
    super(context.message)
    this.name = 'PostgrestError'
    this.details = context.details
    this.hint = context.hint
    this.code = context.code
  }

  toJSON(): { name: string; message: string; details: string; hint: string; code: string } {
    return {
      name: this.name,
      message: this.message,
      details: this.details,
      hint: this.hint,
      code: this.code,
    }
  }
}
