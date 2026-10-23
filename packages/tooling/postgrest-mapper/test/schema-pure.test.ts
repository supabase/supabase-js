import {
  SchemaAcquisitionError,
  acquireSchema,
  buildFunctionTraceInputs,
  buildTraceCatalog,
  configEnvName,
  containerDbUrl,
  createScrubber,
  exposedSchemas,
  parseConfigDump,
  parseVersion,
  redactConfig,
  type ExecFn,
  type Supplementary,
} from '../src'

describe('scrubber', () => {
  const scrub = createScrubber(['hunter2-literal'])
  test.each([
    ['connect failed: postgresql://postgres:p%40ss@db.example:5432/postgres', 'p%40ss'],
    ['PGPASSWORD=sekret node x', 'sekret'],
    ['password: "sekret"', 'sekret'],
    ['password=sekret host=h', 'sekret'],
    ['PGRST_DB_URI=postgres://u:sekret@h/db', 'sekret'],
    ['jwt-secret = "sekret"', 'sekret'],
    ['the literal hunter2-literal appears', 'hunter2-literal'],
  ])('%s', (input, secret) => {
    const out = scrub(input)
    expect(out).not.toContain(secret)
    expect(out).toContain('***')
  })

  test('leaves ordinary text alone', () => {
    expect(scrub('password authentication failed for user "postgres"')).toBe(
      'password authentication failed for user "postgres"'
    )
  })
})

describe('config', () => {
  const text = [
    'db-schemas = "public, analytics"',
    'db-max-rows = 1000',
    'db-uri = "postgresql://authenticator:pw@db:5432/postgres"',
    'jwt-secret = "abc"',
    'jwt-secret-is-base64 = false',
    'app.settings.foo = "bar"',
    'db-aggregates-enabled = true',
  ].join('\n')

  test('parses key = JSON lines and redacts credentials', () => {
    const config = parseConfigDump(text)
    expect(config['db-max-rows']).toBe(1000)
    expect(Object.keys(redactConfig(config)).sort()).toEqual([
      'db-aggregates-enabled',
      'db-max-rows',
      'db-schemas',
    ])
    expect(exposedSchemas(config)).toEqual(['public', 'analytics'])
  })

  test('rejects empty and malformed dumps', () => {
    expect(() => parseConfigDump('')).toThrow(/no configuration/)
    expect(() => parseConfigDump('db-schemas = public')).toThrow(/not JSON/)
    expect(() => exposedSchemas({})).toThrow(/db-schemas/)
  })

  test('version, container URL and env names', () => {
    expect(parseVersion('PostgREST 16.4\n')).toEqual({ release: '16.4' })
    expect(parseVersion('PostgREST 14.4.1 (abc123f)')).toEqual({
      release: '14.4.1',
      commit: 'abc123f',
    })
    expect(() => parseVersion('nope')).toThrow(SchemaAcquisitionError)
    expect(containerDbUrl('postgresql://u:p@127.0.0.1:54322/postgres')).toBe(
      'postgresql://u:p@host.docker.internal:54322/postgres'
    )
    expect(containerDbUrl('postgresql://u:p@db.internal/postgres')).toBe(
      'postgresql://u:p@db.internal/postgres'
    )
    expect(containerDbUrl('postgresql://u:p@localhost/postgres', 'my-net')).toBe(
      'postgresql://u:p@localhost/postgres'
    )
    expect(configEnvName('db-schemas')).toBe('PGRST_DB_SCHEMAS')
  })
})

describe('supabase-local container discovery', () => {
  const run = (rest: string[], toml?: string) => {
    const calls: string[][] = []
    const exec: ExecFn = async (command, args) => {
      calls.push([command, ...args])
      if (args[0] === 'ps') return { stdout: rest.join('\n'), stderr: '', exitCode: 0 }
      return { stdout: '', stderr: 'stop here', exitCode: 1 }
    }
    const fs = {
      readFile: async () => {
        if (toml === undefined) throw Object.assign(new Error('no'), { code: 'ENOENT' })
        return toml
      },
      writeFile: async () => undefined,
      mkdir: async () => undefined,
    }
    return {
      calls,
      result: acquireSchema(
        { source: 'supabase-local', dbUrl: 'postgresql://u:p@h/db' },
        { exec, fs }
      ).then(
        () => new Error('unexpectedly resolved'),
        (e: Error) => e
      ),
    }
  }

  test('project_id from config.toml names the container', async () => {
    const { calls, result } = run([], '# x\nproject_id = "shop"\n')
    expect((await result).message).toMatch(/postgrest --dump-config failed \(exit 1\): stop here/)
    expect(calls[0].slice(0, 3)).toEqual(['docker', 'exec', 'supabase_rest_shop'])
  })

  test('a single running stack is found by name', async () => {
    const { calls, result } = run(['supabase_rest_abc'])
    await result
    expect(calls[1].slice(0, 3)).toEqual(['docker', 'exec', 'supabase_rest_abc'])
  })

  test('none or several stacks are an error that says what to do', async () => {
    expect((await run([]).result).message).toMatch(/supabase start/)
    expect((await run(['supabase_rest_a', 'supabase_rest_b']).result).message).toMatch(
      /set `projectId`/
    )
  })
})

describe('catalog builders', () => {
  const column = (name: string, notNull = false, type = 'text') => ({
    name,
    attnum: 1,
    type,
    notNull,
    hasDefault: false,
    identity: null,
    generated: null,
  })
  const relation = (
    schema: string,
    name: string,
    kind: 'r' | 'v' | 'm' | 'p' | 'f',
    columns: string[],
    viewDefinition: string | null = null
  ) => ({
    schema,
    name,
    kind,
    columns: columns.map((c) => column(c, c === 'id')),
    viewDefinition,
    updatable: { insert: false, update: false, delete: false },
  })
  const supplementary: Supplementary = {
    format: 1,
    relations: [
      relation('public', 't', 'r', ['id', 'v']),
      relation('public', 'pt', 'p', ['id']),
      relation('public', 'ft', 'f', ['id']),
      relation('public', 'v', 'v', ['id'], 'SELECT t.id FROM public.t t'),
      relation('public', 'mv', 'm', ['id'], 'SELECT t.id FROM public.t t'),
    ],
    referencedRelations: [relation('private', 'x', 'r', ['id'])],
    composites: [
      {
        schema: 'public',
        name: 'pair',
        attributes: [
          { name: 'l', type: 'int', attnum: 1 },
          { name: 'r', type: 'int', attnum: 2 },
        ],
      },
    ],
    foreignKeys: [],
    enums: [],
    jsonSchemaChecks: [],
    functions: [
      fn('scalar_fn', 'scalar', 'int', null, 'select $1 + 1', ['a']),
      fn('pair_fn', 'composite', 'public.pair', null, 'select 1, 2', null),
      fn('table_fn', 'composite', 'record', [{ name: 'o', type: 'int' }], 'select 1', [''], 1),
      fn('plpgsql_fn', 'scalar', 'int', null, null, null, 0, 'plpgsql'),
    ],
  }

  function fn(
    name: string,
    kind: 'scalar' | 'composite',
    type: string,
    outColumns: { name: string; type: string }[] | null,
    source: string | null,
    argNames: string[] | null,
    args = 1,
    language = 'sql'
  ) {
    return {
      schema: 'public',
      name,
      argTypes: Array(args).fill('integer'),
      volatility: 'i',
      returns: { kind, setof: false, type },
      outColumns,
      language,
      source,
      argNames,
    }
  }

  test('relations map to tracer kinds and referenced relations are included', () => {
    const catalog = buildTraceCatalog(supplementary, { searchPath: ['public', 'extensions'] })
    expect(catalog.searchPath).toEqual(['public', 'extensions'])
    expect(catalog.relations.map((r) => `${r.schema}.${r.name}:${r.kind}`)).toEqual([
      'public.t:table',
      'public.pt:table',
      'public.ft:other',
      'public.v:view',
      'public.mv:other',
      'private.x:table',
    ])
    expect(catalog.relations.find((r) => r.name === 'v')?.definition).toMatch(/SELECT/)
    expect(catalog.relations.find((r) => r.name === 't')?.columns[0]).toEqual({
      name: 'id',
      notNull: true,
      type: 'text',
    })
  })

  test('only SQL functions with a body become trace inputs, with their output columns', () => {
    const inputs = buildFunctionTraceInputs(supplementary)
    expect(inputs.map((i) => [i.name, i.input.columns, i.input.parameters])).toEqual([
      ['scalar_fn', ['scalar_fn'], ['a']],
      ['pair_fn', ['l', 'r'], ['']],
      ['table_fn', ['o'], ['']],
    ])
    expect(inputs[0].input.catalog.searchPath).toEqual(['public'])
    expect(inputs[0].input.functionName).toBe('scalar_fn')
  })
})
