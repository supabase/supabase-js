/**
 * Header that carries the client `namespace` on every request. Postgres can read it with
 * `current_setting('request.headers', true)::json->>'x-supabase-namespace'`.
 */
export const NAMESPACE_HEADER = 'x-supabase-namespace'

// The namespace ends up in a header value, a Realtime topic (`ns:room`), a Storage folder
// (`ns/a.png`) and the auth storage key, so it is limited to characters safe in all four.
const NAMESPACE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/

/**
 * Throws unless `namespace` is 1-63 letters, digits, `-` or `_`, starting with a letter or digit.
 */
export function validateNamespace(namespace: unknown): string {
  if (typeof namespace !== 'string' || !NAMESPACE_PATTERN.test(namespace)) {
    throw new Error(
      `@supabase/supabase-js: Invalid namespace ${JSON.stringify(namespace)}. ` +
        'Use 1-63 letters, digits, "-" or "_", starting with a letter or digit.'
    )
  }
  return namespace
}

/**
 * Reads the `x-supabase-namespace` header from an incoming request, so server-side code
 * (Edge Functions, API routes) can create its client in the caller's namespace. Without
 * this, a function that broadcasts on `room` is never heard by callers subscribed to
 * `s07:room`.
 *
 * Accepts a Fetch API `Request` or any object with a `headers` record, such as a Node.js
 * `IncomingMessage`.
 *
 * @returns The namespace, or `undefined` when the header is missing or empty.
 * @throws When the header holds a value that is not a valid namespace.
 *
 * @example Edge Function
 * ```ts
 * import { createClient, namespaceFrom } from '@supabase/supabase-js'
 *
 * Deno.serve(async (req) => {
 *   const supabase = createClient(
 *     Deno.env.get('SUPABASE_URL')!,
 *     Deno.env.get('SUPABASE_ANON_KEY')!,
 *     { namespace: namespaceFrom(req) }
 *   )
 *   // Reaches clients subscribed with `supabase.channel('room')` in the same namespace.
 *   await supabase.channel('room').httpSend('ping', {})
 *   return new Response('ok')
 * })
 * ```
 */
export function namespaceFrom(req: {
  headers: Headers | Record<string, string | string[] | undefined>
}): string | undefined {
  const { headers } = req
  let value: string | string[] | null | undefined
  if (typeof (headers as Headers).get === 'function') {
    value = (headers as Headers).get(NAMESPACE_HEADER)
  } else {
    const name = Object.keys(headers).find((key) => key.toLowerCase() === NAMESPACE_HEADER)
    value = name === undefined ? undefined : (headers as Record<string, string | string[]>)[name]
  }
  const namespace = Array.isArray(value) ? value[0] : value
  return namespace ? validateNamespace(namespace) : undefined
}
