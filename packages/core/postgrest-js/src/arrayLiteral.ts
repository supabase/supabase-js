// A `{...}` filter/RPC-arg value is a Postgres array literal, not a PostgREST
// list, so it has its own set of characters that end an element. Whitespace is
// included because Postgres trims it off an unquoted element, and the empty
// string because `{}` is an empty array rather than an array holding one empty
// value. `null` in any casing is the SQL NULL token, so the text has to be
// quoted to stay text.
const PostgrestArrayLiteralReservedCharsRegexp = /[,{}"\\\s]|^$|^null$/i

/**
 * Quotes an element of a Postgres array literal when it carries a character
 * that would otherwise change how Postgres parses the literal.
 *
 * Only strings are quoted, so a real `null` value still reaches Postgres bare
 * and stays SQL NULL. The string `'null'` is quoted for the opposite reason:
 * bare, Postgres would read it as SQL NULL rather than as text.
 */
export const quoteArrayLiteralElement = (value: unknown): string => {
  if (typeof value !== 'string') return `${value}`
  if (!PostgrestArrayLiteralReservedCharsRegexp.test(value)) return value

  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export const toArrayLiteral = (values: readonly unknown[]): string =>
  values.map(quoteArrayLiteralElement).join(',')
