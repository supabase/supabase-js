/**
 * TypeScript string literals: the one escaper every printer uses for names, labels, keys and messages.
 *
 * A literal has to stay on one line whatever the text holds: a quoted PostgreSQL identifier or an enum label can
 * contain line breaks (`\n`, `\r`, and U+2028 / U+2029, which TypeScript also ends a line at) and any control
 * character. Lone surrogates are written as escapes too, because a file cannot hold them.
 */

const NAMED: Readonly<Record<string, string>> = {
  '\\': '\\\\',
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\v': '\\v',
  '\f': '\\f',
  '\r': '\\r',
}

const UNSAFE =
  // eslint-disable-next-line no-control-regex
  /[\\'"\u0000-\u001f\u007f\u2028\u2029]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g

/** `value` as a literal between `delimiter` quotes (single by default). */
export function stringLiteral(value: string, delimiter: "'" | '"' = "'"): string {
  const body = value.replace(UNSAFE, (ch) => {
    if (ch === "'" || ch === '"') return ch === delimiter ? `\\${ch}` : ch
    return NAMED[ch] ?? `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
  return `${delimiter}${body}${delimiter}`
}

/** A single-quoted literal: names, labels, keys. */
export const quote = (value: string): string => stringLiteral(value)

const IDENT = /^[A-Za-z_$][\w$]*$/

/** An object type key: bare when it is an identifier. */
export const memberName = (name: string): string => (IDENT.test(name) ? name : quote(name))

/** A double-quoted literal: the `error` message of an entry. */
export const quoteDouble = (value: string): string => stringLiteral(value, '"')
