import type SupabaseClient from '../SupabaseClient'

/**
 * A Supabase client plugin. Contributes one typed namespace to the client,
 * attached at `supabase.<name>`.
 *
 * Create plugins with {@link defineSupabasePlugin} so `Name` and `Namespace`
 * are inferred from the declaration.
 */
export interface SupabasePlugin<Name extends string = string, Namespace extends object = object> {
  /**
   * The namespace key the plugin contributes: `supabase.<name>`.
   *
   * Must not collide with an existing client member (`auth`, `from`, `rpc`,
   * `storage`, `functions`, `realtime`, `schema`, `channel`, ...) or with
   * another plugin on the same client — collisions throw at construction.
   */
  name: Name
  /**
   * Factory for the namespace. Receives the fully initialized client, so it
   * can call `client.functions.invoke(...)`, `client.from(...)`, etc.
   */
  client: (client: SupabaseClient) => Namespace
}

export type AnySupabasePlugin = SupabasePlugin<string, object>

/**
 * Accumulates each plugin's namespace onto the client type:
 * `[SupabasePlugin<'stripe', S>, SupabasePlugin<'guestbook', G>]` →
 * `{ stripe: S } & { guestbook: G }`.
 *
 * The non-tuple fallback is deliberately `object` (not an index signature),
 * so an untyped plugins array never swallows typos on the client.
 */
export type PluginNamespaces<Plugins extends readonly AnySupabasePlugin[]> =
  Plugins extends readonly [
    SupabasePlugin<infer Name extends string, infer Namespace>,
    ...infer Rest,
  ]
    ? Rest extends readonly AnySupabasePlugin[]
      ? { [K in Name]: Namespace } & PluginNamespaces<Rest>
      : { [K in Name]: Namespace }
    : object

/**
 * Declares a Supabase client plugin.
 *
 * Identity at runtime — it exists to capture the literal `name` and the
 * namespace type, so `createClient(url, key, { plugins: [myPlugin()] })`
 * infers `supabase.<name>` with no manual annotations.
 *
 * @example Declaring and using a plugin
 * ```ts
 * import { createClient, defineSupabasePlugin } from '@supabase/supabase-js'
 *
 * const guestbookPlugin = () =>
 *   defineSupabasePlugin({
 *     name: 'guestbook',
 *     client: (client) => ({
 *       list: () => client.functions.invoke('guestbook-mw', { method: 'GET' }),
 *     }),
 *   })
 *
 * const supabase = createClient(url, key, { plugins: [guestbookPlugin()] })
 * await supabase.guestbook.list() // typed
 * ```
 */
export function defineSupabasePlugin<const Name extends string, Namespace extends object>(plugin: {
  name: Name
  client: (client: SupabaseClient) => Namespace
}): SupabasePlugin<Name, Namespace> {
  return plugin
}

/**
 * Attaches each plugin's namespace to the client, in array order. A plugin's
 * factory runs after all built-in sub-clients (and any earlier plugins) are
 * initialized. Throws on a missing/non-string `name` or on a collision with
 * any existing client member — including prototype methods and getters via
 * the `in` check. (Declared-but-unassigned fields like `changedAccessToken`
 * are not own properties and thus not guarded; acceptable.)
 *
 * @internal
 */
export function attachPlugins(client: object, plugins: readonly AnySupabasePlugin[]): void {
  for (const plugin of plugins) {
    const name = plugin?.name
    if (typeof name !== 'string' || !name) {
      throw new Error('@supabase/supabase-js: each plugin must have a string `name`.')
    }
    if (name in client) {
      throw new Error(
        `@supabase/supabase-js: plugin "${name}" conflicts with an existing property on the Supabase client.`
      )
    }
    ;(client as Record<string, unknown>)[name] = plugin.client(client as SupabaseClient)
  }
}
