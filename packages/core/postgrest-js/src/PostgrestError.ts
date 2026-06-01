/**
 * Error format
 *
 * Returned by every PostgREST request that fails. When handling errors, prefer
 * logging the full object (e.g. `console.error(error)`) rather than just
 * `error.message` — the other fields often contain the actionable part.
 *
 * - `message` — human-readable summary, usually from PostgreSQL or PostgREST.
 * - `code` — error code from PostgREST (e.g. `PGRST301`) or PostgreSQL (e.g. `42501`).
 * - `details` — extra context about what went wrong.
 * - `hint` — actionable guidance from the database when available. For example,
 *   permission-denied errors (`42501`) now arrive with hints like
 *   `"Grant the required privileges to the current role with: GRANT SELECT ON public.users TO anon;"`
 *   — the rest of the error message alone wouldn't tell you which role or grant is missing.
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
