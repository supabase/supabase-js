/**
 * Helpers for development sessions (developers or coding agents) that share one Supabase
 * branch. Each session gets a slot, such as `s07`, that becomes its client `namespace`, and
 * signs in as its own test identity so existing RLS policies keep its rows apart.
 *
 * Import from `@supabase/supabase-js/dev` in tests and dev scripts only. It is a separate
 * entry point so it is never bundled into production code.
 *
 * @example
 * ```ts
 * import { devSession } from '@supabase/supabase-js/dev'
 *
 * const { client, uniq } = await devSession({ slot: 's07', branchRef: 'abcd1234', signInAs: 'admin' })
 *
 * await client.from('projects').insert({ slug: uniq('slug') }) // slug: 's07-slug-k3j9x8f2'
 * ```
 *
 * @module dev
 */
import type { User } from '@supabase/auth-js'
import SupabaseClient from './SupabaseClient'
import { validateNamespace } from './lib/namespace'
import type { SupabaseClientOptions } from './lib/types'

const LOG_PREFIX = '@supabase/supabase-js/dev:'

/**
 * Filters the admin client applies, per table: `{ orders: { org_id: orgId } }` restricts
 * every query on `orders` to rows where `org_id = orgId`.
 */
export type AdminScope = Record<string, Record<string, string | number | boolean>>

export interface AdminClientOptions {
  /**
   * Filters to apply, per table. Queries on tables missing from the scope throw.
   */
  scope: AdminScope
}

export interface DevSessionOptions<SchemaName = any> {
  /**
   * The session's slot, such as `s07`. Used as the client `namespace` and in the test
   * identity's email. 1-63 letters, digits, `-` or `_`.
   */
  slot: string
  /**
   * Project ref of the shared branch. `devSession` throws if `url` belongs to any other
   * project, so a session can never write to production by mistake.
   */
  branchRef: string
  /**
   * URL of the branch. Defaults to the `SUPABASE_URL` environment variable.
   */
  url?: string
  /**
   * Publishable or anon key of the branch. Defaults to the `SUPABASE_PUBLISHABLE_KEY`
   * environment variable, then `SUPABASE_ANON_KEY`. Secret and service role keys are
   * refused: use `adminClient` for privileged access.
   */
  key?: string
  /**
   * Role to sign in as. The session signs in as `${slot}+${signInAs}@${testDomain}`, so
   * every slot has its own identity per role. Leave unset to stay signed out.
   */
  signInAs?: string
  /**
   * Password of the test identities. Defaults to the `SUPABASE_DEV_PASSWORD` environment
   * variable. Required with `signInAs`.
   */
  password?: string
  /**
   * Email domain of the test identities. Defaults to the `SUPABASE_DEV_TEST_DOMAIN`
   * environment variable, then `example.com`.
   */
  testDomain?: string
  /**
   * Secret or service role key used by `adminClient`. Defaults to the `SUPABASE_SECRET_KEY`
   * environment variable, then `SUPABASE_SERVICE_ROLE_KEY`. Only read when `adminClient`
   * is called.
   */
  adminKey?: string
  /**
   * Other `createClient` options. `namespace` is always the slot.
   */
  options?: Omit<SupabaseClientOptions<SchemaName>, 'namespace'>
}

export interface DevSession<
  Database = any,
  SchemaNameOrClientOptions extends
    | (string & keyof Omit<Database, '__InternalSupabase'>)
    | { PostgrestVersion: string } = any,
  SchemaName extends string & keyof Omit<Database, '__InternalSupabase'> = any,
> {
  /** Client in the slot's namespace, signed in as the test identity when `signInAs` is set. */
  client: SupabaseClient<Database, SchemaNameOrClientOptions, SchemaName>
  /** The session's slot. */
  slot: string
  /** The signed-in test identity, or `null` without `signInAs`. */
  user: User | null
  /**
   * Returns a value unique to this session, for columns with unique constraints:
   * `uniq('slug')` returns values like `s07-slug-k3j9x8f2`.
   */
  uniq(prefix?: string): string
  /**
   * Creates a client with the secret or service role key that bypasses RLS, scoped to the
   * session's data instead: every query on a table gets the table's `scope` filters, and
   * queries on other tables throw.
   *
   * - `select`, `update` and `delete` are filtered with the scope.
   * - `insert` fills in missing scope columns and throws on rows with other values.
   * - `upsert` is only allowed with `ignoreDuplicates: true`, since an update on conflict
   *   could overwrite rows outside the scope.
   * - `rpc` and `schema` throw, since they can't be scoped.
   *
   * Storage paths are prefixed with the slot like on `client`. `auth.admin` is not scoped.
   *
   * @example
   * ```ts
   * const admin = session.adminClient({ scope: { orders: { org_id: orgId } } })
   *
   * await admin.from('orders').delete() // deletes this org's orders only
   * ```
   */
  adminClient(
    options: AdminClientOptions
  ): SupabaseClient<Database, SchemaNameOrClientOptions, SchemaName>
}

/**
 * Creates a client for one development session on a shared branch.
 *
 * Before connecting, it checks that `url` belongs to `branchRef` and that `key` is not a
 * secret or service role key, and it refuses to run when `NODE_ENV` is `production`. It then
 * creates a client with `namespace: slot` and, with `signInAs`, signs in as
 * `${slot}+${signInAs}@${testDomain}` with the dev password.
 *
 * The test identities must exist on the branch; `devSession` doesn't create them.
 *
 * @example
 * ```ts
 * import { devSession } from '@supabase/supabase-js/dev'
 *
 * const { client, uniq, adminClient } = await devSession({
 *   slot: 's07',
 *   branchRef: 'abcd1234',
 *   signInAs: 'admin', // signs in as s07+admin@example.com
 * })
 * ```
 */
export async function devSession<
  Database = any,
  SchemaNameOrClientOptions extends
    | (string & keyof Omit<Database, '__InternalSupabase'>)
    | { PostgrestVersion: string } = 'public' extends keyof Omit<Database, '__InternalSupabase'>
    ? 'public'
    : string & keyof Omit<Database, '__InternalSupabase'>,
  SchemaName extends string & keyof Omit<Database, '__InternalSupabase'> =
    SchemaNameOrClientOptions extends string & keyof Omit<Database, '__InternalSupabase'>
      ? SchemaNameOrClientOptions
      : 'public' extends keyof Omit<Database, '__InternalSupabase'>
        ? 'public'
        : string & keyof Omit<Omit<Database, '__InternalSupabase'>, '__InternalSupabase'>,
>(
  options: DevSessionOptions<SchemaName>
): Promise<DevSession<Database, SchemaNameOrClientOptions, SchemaName>> {
  if (readEnv('NODE_ENV') === 'production') {
    throw new Error(`${LOG_PREFIX} devSession refuses to run when NODE_ENV is "production".`)
  }

  const slot = validateNamespace(options.slot)
  const url = options.url ?? readEnv('SUPABASE_URL')
  const key = options.key ?? readEnv('SUPABASE_PUBLISHABLE_KEY') ?? readEnv('SUPABASE_ANON_KEY')
  if (!url) {
    throw new Error(`${LOG_PREFIX} Pass \`url\` or set SUPABASE_URL.`)
  }
  if (!key) {
    throw new Error(
      `${LOG_PREFIX} Pass \`key\` or set SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).`
    )
  }

  assertBranchUrl(url, options.branchRef)
  if (isPrivilegedKey(key)) {
    throw new Error(
      `${LOG_PREFIX} \`key\` is a secret or service role key, which bypasses RLS. Use a ` +
        'publishable or anon key, and `adminClient` for privileged access.'
    )
  }
  assertKeyProject(key, options.branchRef)

  const client = new SupabaseClient<Database, SchemaNameOrClientOptions, SchemaName>(url, key, {
    ...options.options,
    namespace: slot,
  })

  let user: User | null = null
  if (options.signInAs) {
    const password = options.password ?? readEnv('SUPABASE_DEV_PASSWORD')
    if (!password) {
      throw new Error(`${LOG_PREFIX} \`signInAs\` needs \`password\` or SUPABASE_DEV_PASSWORD.`)
    }
    const domain = options.testDomain ?? readEnv('SUPABASE_DEV_TEST_DOMAIN') ?? 'example.com'
    const email = `${slot}+${options.signInAs}@${domain}`
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) {
      throw new Error(`${LOG_PREFIX} Could not sign in as ${email}: ${error.message}`)
    }
    user = data.user
  }

  return {
    client,
    slot,
    user,
    uniq: (prefix) => uniqueValue(slot, prefix),
    adminClient: ({ scope }) => {
      const adminKey =
        options.adminKey ?? readEnv('SUPABASE_SECRET_KEY') ?? readEnv('SUPABASE_SERVICE_ROLE_KEY')
      if (!adminKey) {
        throw new Error(
          `${LOG_PREFIX} \`adminClient\` needs \`adminKey\`, SUPABASE_SECRET_KEY or ` +
            'SUPABASE_SERVICE_ROLE_KEY.'
        )
      }
      assertKeyProject(adminKey, options.branchRef)
      const admin = new SupabaseClient<Database, SchemaNameOrClientOptions, SchemaName>(
        url,
        adminKey,
        {
          db: options.options?.db,
          global: options.options?.global,
          namespace: slot,
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        }
      )
      return scopeAdminClient(admin, scope)
    },
  }
}

function readEnv(name: string): string | undefined {
  const _process = (globalThis as any)['process']
  const value = _process?.env?.[name]
  if (value) {
    return value
  }
  try {
    // Throws without --allow-env in Deno.
    return (globalThis as any)['Deno']?.env?.get(name) || undefined
  } catch {
    return undefined
  }
}

function assertBranchUrl(url: string, branchRef: string) {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    throw new Error(`${LOG_PREFIX} Invalid url ${JSON.stringify(url)}.`)
  }
  if (!branchRef || hostname.split('.')[0] !== branchRef.toLowerCase()) {
    throw new Error(
      `${LOG_PREFIX} ${url} is not the branch ${JSON.stringify(branchRef)}. ` +
        'Refusing to start a dev session against another project.'
    )
  }
}

function isPrivilegedKey(key: string) {
  return key.startsWith('sb_secret_') || decodeJwtPayload(key)?.role === 'service_role'
}

/** Legacy JWT keys name their project in the `ref` claim. Other keys can't be checked. */
function assertKeyProject(key: string, branchRef: string) {
  const ref = decodeJwtPayload(key)?.ref
  if (typeof ref === 'string' && ref !== branchRef.toLowerCase()) {
    throw new Error(
      `${LOG_PREFIX} The key belongs to project ${JSON.stringify(ref)}, not the branch ` +
        `${JSON.stringify(branchRef)}.`
    )
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

function uniqueValue(slot: string, prefix?: string) {
  const bytes = new Uint8Array(8)
  const crypto = (globalThis as any)['crypto']
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let suffix = ''
  for (let i = 0; i < bytes.length; i++) suffix += ALPHABET[bytes[i] % ALPHABET.length]
  return prefix ? `${slot}-${prefix}-${suffix}` : `${slot}-${suffix}`
}

type Row = Record<string, unknown>

function scopeAdminClient<T extends SupabaseClient<any, any, any>>(admin: T, scope: AdminScope): T {
  const unscoped = (method: string) => () => {
    throw new Error(`${LOG_PREFIX} adminClient can't scope ${method}(). Use \`from()\` instead.`)
  }
  return new Proxy(admin, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string, options?: any) => {
          if (!Object.prototype.hasOwnProperty.call(scope, table)) {
            throw new Error(
              `${LOG_PREFIX} adminClient has no scope for table ${JSON.stringify(table)}. ` +
                'Add it to `scope` to query it.'
            )
          }
          return scopeQueryBuilder(target.from(table, options), table, scope[table])
        }
      }
      if (prop === 'rpc' || prop === 'schema') {
        return unscoped(prop)
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}

function scopeQueryBuilder(builder: any, table: string, filters: Row) {
  // Throws if the row sets a scope column to a value outside the scope.
  const assertInScope = (row: Row) => {
    for (const column of Object.keys(filters)) {
      if (row[column] !== undefined && row[column] !== filters[column]) {
        throw new Error(
          `${LOG_PREFIX} adminClient refused to write ${table}.${column} = ` +
            `${JSON.stringify(row[column])}, outside its scope ${JSON.stringify(filters[column])}.`
        )
      }
    }
  }
  const stamp = (values: Row | Row[]) => {
    const rows = Array.isArray(values) ? values : [values]
    rows.forEach(assertInScope)
    const stamped = rows.map((row) => ({ ...row, ...filters }))
    return Array.isArray(values) ? stamped : stamped[0]
  }

  return {
    select: (...args: any[]) => builder.select(...args).match(filters),
    delete: (...args: any[]) => builder.delete(...args).match(filters),
    update: (values: Row, ...args: any[]) => {
      assertInScope(values)
      return builder.update(values, ...args).match(filters)
    },
    insert: (values: Row | Row[], ...args: any[]) => builder.insert(stamp(values), ...args),
    upsert: (values: Row | Row[], options?: { ignoreDuplicates?: boolean }) => {
      if (!options?.ignoreDuplicates) {
        throw new Error(
          `${LOG_PREFIX} adminClient only allows upsert() with \`ignoreDuplicates: true\`: ` +
            'an update on conflict could overwrite rows outside the scope.'
        )
      }
      return builder.upsert(stamp(values), options)
    },
  }
}
