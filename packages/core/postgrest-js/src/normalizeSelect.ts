/**
 * The `select` query parameter postgrest-js sends for a select string: whitespace is removed except inside double
 * quotes. `@supabase/postgrest-mapper` plans selects with the same function, so planned and sent requests agree.
 */
export function normalizeSelect(select: string): string {
  let quoted = false
  return select
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
}
