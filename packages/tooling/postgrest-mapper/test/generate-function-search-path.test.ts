import {
  buildFunctionTraceInputs,
  connectPg,
  querySupplementary,
  type AcquiredSchema,
  type DbConnection,
  type Supplementary,
  type SupplementaryFunction,
} from '../src'
import { acquireFromStack, stackDbUrl } from './support/acquired'
import { generateText } from './support/declarations'
import { column, supplementary as catalog, table } from './support/printer'

/**
 * A SQL function that sets its own `search_path` resolves the names of its body along that path, not along the
 * request's. The catalog reads the setting; the generator traces the body only where it can name every schema the
 * path reaches before the first one it knows nothing about.
 */

describe('the search_path a function sets (catalog)', () => {
  let db: DbConnection

  beforeAll(async () => {
    db = await connectPg(await stackDbUrl())
  }, 120_000)

  afterAll(() => db.close())

  test('the value is read as PostgreSQL stores it, absent for a function that sets none', async () => {
    await db.query('BEGIN')
    try {
      await db.query("SET LOCAL search_path = ''")
      const probe = (name: string, setting: string): Promise<unknown> =>
        db.query(
          `create function public.${name}() returns int language sql ${setting} as $$ select 1 $$`
        )
      await probe('search_path_probe_none', '')
      await probe('search_path_probe_list', `set search_path = private, "Mixed ""Case", Foo`)
      await probe('search_path_probe_empty', `set search_path = ''`)
      await probe('search_path_probe_other', 'set statement_timeout = 5')
      const { functions } = await querySupplementary(db, ['public'], ['public'])
      const searchPath = (name: string): string | null | undefined =>
        functions.find((f) => f.name === name)?.searchPath
      expect(searchPath('search_path_probe_none')).toBeNull()
      expect(searchPath('search_path_probe_list')).toBe('private, "Mixed ""Case", foo')
      expect(searchPath('search_path_probe_empty')).toBe('""')
      expect(searchPath('search_path_probe_other')).toBeNull()
    } finally {
      await db.query('ROLLBACK')
    }
  }, 60_000)
})

describe('the search path a body is traced along', () => {
  const users = (schema: string) => table(schema, 'users', [column('id', 'integer', 1)])
  const fn = (name: string, searchPath: string | null): SupplementaryFunction => ({
    schema: 'public',
    name,
    argTypes: [],
    volatility: 's',
    defaults: 0,
    returns: { kind: 'composite', setof: true, type: 'public.users' },
    outColumns: null,
    language: 'sql',
    source: 'select id from users',
    argNames: null,
    searchPath,
  })
  const supplementary = (searchPaths: Record<string, string | null>): Supplementary =>
    catalog({
      relations: [users('public'), users('api')],
      functions: Object.entries(searchPaths).map(([name, path]) => fn(name, path)),
    })
  const pathsOf = (searchPaths: Record<string, string | null>): Record<string, string[] | null> => {
    const inputs = buildFunctionTraceInputs(supplementary(searchPaths), {
      searchPath: ['public', 'extensions'],
      exposedSchemas: ['public', 'api'],
    })
    return Object.fromEntries(
      Object.keys(searchPaths).map((name) => [
        name,
        inputs.find((i) => i.name === name)?.input.catalog.searchPath ?? null,
      ])
    )
  }

  test('follows the request path unless the function sets its own', () => {
    expect(pathsOf({ plain: null })).toEqual({ plain: ['public'] })
  })

  test('ends the request path at the first schema that is not exposed, as a path of its own does', () => {
    const inherited = (searchPath: string[]): string[] | null =>
      buildFunctionTraceInputs(supplementary({ plain: null }), {
        searchPath,
        exposedSchemas: ['public', 'api'],
      })[0]?.input.catalog.searchPath ?? null
    expect(inherited(['private', 'public'])).toEqual(['public'])
    expect(inherited(['api', 'private', 'public'])).toEqual(['public', 'api'])
    expect(inherited(['pg_catalog', 'api', 'extensions'])).toEqual(['public', 'api'])
  })

  test('is the function path: identifiers split, unquoted ones folded to lower case, quoted ones kept', () => {
    expect(
      pathsOf({
        a: 'api, public',
        b: '"api" ,  PUBLIC',
        c: 'pg_catalog, api',
        d: '"A ""b"" c", api',
      })
    ).toEqual({
      a: ['api', 'public'],
      b: ['api', 'public'],
      c: ['api'],
      // a schema the catalog does not know ends the path: a relation could be there
      d: [],
    })
  })

  test('ends at the first schema that is not exposed, because a relation of it is unknown', () => {
    expect(
      pathsOf({
        private_first: 'private, public',
        private_last: 'public, private',
        empty: '""',
      })
    ).toEqual({
      private_first: [],
      private_last: ['public'],
      empty: [],
    })
  })

  test('is not traced when the path names a schema that cannot be resolved statically', () => {
    expect(
      pathsOf({
        user: '"$user", public',
        temp: 'pg_temp, public',
        broken: '"api, public',
        trailing: 'api,',
      })
    ).toEqual({ user: null, temp: null, broken: null, trailing: null })
  })
})

describe('a function body that sets its own search_path, through the generator', () => {
  let acquired: AcquiredSchema
  beforeAll(async () => {
    acquired = await acquireFromStack()
  }, 120_000)

  /** `get_username_and_status` selects from the unqualified `users`, whose `username` is NOT NULL in `public` */
  async function rowWith(searchPath: string | null): Promise<string> {
    const schema: AcquiredSchema = {
      ...acquired,
      supplementary: {
        ...acquired.supplementary,
        functions: acquired.supplementary.functions.map((f) =>
          f.name === 'get_username_and_status' ? { ...f, searchPath } : f
        ),
      },
    }
    const text = await generateText(
      schema,
      `supabase.rpc('get_username_and_status', { name_param: 'x' })`
    )
    const row = /f\|public\|get_username_and_status\|\*'[\s\S]*?row: (.*)\n/.exec(text)?.[1]
    expect(row).toBeDefined()
    return row!
  }

  test('keeps what the table proves when the path still reaches it', async () => {
    expect(await rowWith(null)).toContain(
      "username: SupabaseColumnType<'public.users.username', string>;"
    )
    expect(await rowWith('public, extensions')).toContain(
      "username: SupabaseColumnType<'public.users.username', string>;"
    )
  }, 180_000)

  test('proves nothing from a table another schema of the path may shadow', async () => {
    // `private.users` may exist with a nullable username: the body does not read `public.users`
    for (const path of ['private', 'private, public', '""', '"$user", public']) {
      expect(await rowWith(path)).toMatch(/^PgrstObject<\{ username: string \| null; /)
    }
  }, 180_000)
})

describe('a function body that sets no search_path, through the generator', () => {
  let acquired: AcquiredSchema
  beforeAll(async () => {
    acquired = await acquireFromStack()
  }, 120_000)

  /** `personal.message_ids` selects from the bare `messages`, a table of `public` whose `id` is NOT NULL */
  async function rowWith(extraSearchPath: string): Promise<string> {
    const schema: AcquiredSchema = {
      ...acquired,
      config: { ...acquired.config, 'db-extra-search-path': extraSearchPath },
    }
    const text = await generateText(schema, `supabase.schema('personal').rpc('message_ids')`)
    const row = /f\|personal\|message_ids\|\*'[\s\S]*?row: (.*)\n/.exec(text)?.[1]
    expect(row).toBeDefined()
    return row!
  }

  test('keeps what the table proves when the request path reaches it before any schema it knows nothing about', async () => {
    expect(await rowWith('public,extensions')).toBe(
      "PgrstObject<{ id: SupabaseColumnType<'public.messages.id', number> }>"
    )
    expect(await rowWith('public,private')).toBe(
      "PgrstObject<{ id: SupabaseColumnType<'public.messages.id', number> }>"
    )
  }, 180_000)

  test('proves nothing from a table a schema of the request path that is not exposed may shadow', async () => {
    // `private.messages` may exist with a nullable id: the body does not read `public.messages`
    expect(await rowWith('private,public')).toBe('PgrstObject<{ id: number | null }>')
  }, 180_000)
})
