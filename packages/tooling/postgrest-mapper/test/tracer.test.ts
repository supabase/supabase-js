import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createTracer,
  type CatalogRelation,
  type TraceCatalog,
  type TraceResult,
  type Tracer,
} from '../src'

// Schema of packages/core/postgrest-js/test/supabase/migrations/00000000000000_schema.sql
const col = (name: string, notNull = false) => ({ name, notNull })
const table = (name: string, columns: ReturnType<typeof col>[]): CatalogRelation => ({
  schema: 'public',
  name,
  kind: 'table',
  columns,
})
const TABLES: CatalogRelation[] = [
  table('users', [
    col('username', true),
    col('data'),
    col('age_range'),
    col('status'),
    col('catchphrase'),
  ]),
  table('user_profiles', [col('id', true), col('username')]),
  table('channels', [col('id', true), col('data'), col('slug')]),
  table('messages', [
    col('id', true),
    col('data'),
    col('message'),
    col('username', true),
    col('channel_id', true),
  ]),
]

const defs: Record<string, string> = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'viewdefs.json'), 'utf8')
)
const OUTPUT_COLUMNS: Record<string, string[]> = {
  v_plain: ['username', 'status', 'data'],
  v_inner: ['username', 'pid', 'puser'],
  v_left: ['username', 'pid', 'puser'],
  v_right: ['username', 'pid'],
  v_full: ['username', 'pid'],
  v_using: ['username', 'status', 'id'],
  v_union: ['n'],
  v_union2: ['n'],
  v_intersect: ['n'],
  v_except: ['n'],
  v_agg: ['total', 'c2', 'mx', 's'],
  v_group: ['status', 'n'],
  v_rollup: ['username', 'status', 'n'],
  v_coalesce: ['a', 'b', 'c', 'd'],
  v_cast: ['a', 'b', 'c', 'd', 'e', 'f'],
  v_const: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  v_subq: ['username', 'n'],
  v_cte: ['username', 'status'],
  v_lateral: ['username', 'id'],
  v_over: ['username', 'c', 'rn'],
  v_case: ['c', 's', 'concat'],
  v_distinct: ['username', 'status'],
  v_values: ['a', 'b'],
  v_star: ['id', 'data', 'message', 'username', 'channel_id'],
  v_nested: ['username', 'status'],
  v_func: ['n'],
  v_cross: ['username', 'slug'],
  v_multi: ['username', 'mid', 'slug'],
}

const VIEWS: CatalogRelation[] = Object.entries(OUTPUT_COLUMNS).map(([name, columns]) => ({
  schema: 'tv',
  name,
  kind: 'view',
  columns: columns.map((c) => col(c)),
  definition: defs[name],
}))

const catalog: TraceCatalog = { relations: [...TABLES, ...VIEWS], searchPath: ['public'] }

let tracer: Tracer
beforeAll(async () => {
  tracer = await createTracer()
})

/** Traces a fixture view and renders each column as `name:nn|null[@schema.relation.column]`. */
async function view(name: string): Promise<string[]> {
  const result = await tracer.trace({
    sql: defs[name],
    columns: OUTPUT_COLUMNS[name],
    catalog,
  })
  expect(result.error).toBeUndefined()
  return render(OUTPUT_COLUMNS[name], result)
}

function render(names: string[], result: TraceResult): string[] {
  expect(result.columns).toHaveLength(names.length)
  return result.columns.map((c, i) => {
    const src = c.source ? `@${c.source.schema}.${c.source.relation}.${c.source.column}` : ''
    expect(c.reason !== undefined).toBe(c.nullable)
    return `${names[i]}:${c.nullable ? 'null' : 'nn'}${src}`
  })
}

async function sql(
  text: string,
  columns: string[],
  extra: Partial<Parameters<Tracer['trace']>[0]> = {},
  cat: TraceCatalog = catalog
): Promise<TraceResult> {
  return tracer.trace({ sql: text, columns, catalog: cat, ...extra })
}

describe('plain columns and provenance', () => {
  it('passes a NOT NULL base column through and keeps provenance on nullable ones', async () => {
    expect(await view('v_plain')).toEqual([
      'username:nn@public.users.username',
      'status:null@public.users.status',
      'data:null@public.users.data',
    ])
  })

  it('expands * over a table', async () => {
    expect(await view('v_star')).toEqual([
      'id:nn@public.messages.id',
      'data:null@public.messages.data',
      'message:null@public.messages.message',
      'username:nn@public.messages.username',
      'channel_id:nn@public.messages.channel_id',
    ])
  })

  it('traces a view over a view through its definition', async () => {
    expect(await view('v_nested')).toEqual([
      'username:nn@public.users.username',
      'status:null@public.users.status',
    ])
  })

  it('keeps provenance through subqueries and CTEs', async () => {
    expect(await view('v_subq')).toEqual(['username:nn@public.users.username', 'n:nn'])
    expect(await view('v_cte')).toEqual([
      'username:nn@public.users.username',
      'status:null@public.users.status',
    ])
  })

  it('leaves DISTINCT ON, ORDER BY and LIMIT alone', async () => {
    expect(await view('v_distinct')).toEqual([
      'username:nn@public.users.username',
      'status:null@public.users.status',
    ])
  })
})

describe('joins', () => {
  it('keeps both sides of an inner join', async () => {
    expect(await view('v_inner')).toEqual([
      'username:nn@public.users.username',
      'pid:nn@public.user_profiles.id',
      'puser:null@public.user_profiles.username',
    ])
  })

  it('makes the right side of a LEFT JOIN nullable', async () => {
    expect(await view('v_left')).toEqual([
      'username:nn@public.users.username',
      'pid:null@public.user_profiles.id',
      'puser:null@public.user_profiles.username',
    ])
  })

  it('makes the left side of a RIGHT JOIN nullable', async () => {
    expect(await view('v_right')).toEqual([
      'username:null@public.users.username',
      'pid:nn@public.user_profiles.id',
    ])
  })

  it('makes both sides of a FULL JOIN nullable', async () => {
    expect(await view('v_full')).toEqual([
      'username:null@public.users.username',
      'pid:null@public.user_profiles.id',
    ])
  })

  it('does not nullify a CROSS JOIN', async () => {
    expect(await view('v_cross')).toEqual([
      'username:nn@public.users.username',
      'slug:null@public.channels.slug',
    ])
  })

  it('merges USING columns', async () => {
    expect(await view('v_using')).toEqual([
      'username:nn@public.users.username',
      'status:null@public.users.status',
      'id:nn@public.user_profiles.id',
    ])
  })

  it('keeps an outer join nullable across a later inner join', async () => {
    expect(await view('v_multi')).toEqual([
      'username:nn@public.users.username',
      'mid:null@public.messages.id',
      'slug:null@public.channels.slug',
    ])
  })

  it('makes a LEFT JOIN LATERAL subquery nullable', async () => {
    expect(await view('v_lateral')).toEqual([
      'username:nn@public.users.username',
      'id:null@public.messages.id',
    ])
  })

  it('takes the right column of a RIGHT JOIN ... USING and NULL for a FULL JOIN ... USING', async () => {
    const right = await sql(
      'select username from users u right join user_profiles p using (username)',
      ['username']
    )
    expect(render(['username'], right)).toEqual(['username:null@public.user_profiles.username'])
    const full = await sql(
      'select username from users u full join user_profiles p using (username)',
      ['username']
    )
    expect(render(['username'], full)).toEqual(['username:null'])
  })

  it('merges NATURAL JOIN columns', async () => {
    const r = await sql('select username, id from users natural join user_profiles', [
      'username',
      'id',
    ])
    expect(render(['username', 'id'], r)).toEqual([
      'username:nn@public.users.username',
      'id:nn@public.user_profiles.id',
    ])
  })

  it('treats an ambiguous column as nullable', async () => {
    const r = await sql('select username from users u join messages m on true', ['username'])
    expect(render(['username'], r)).toEqual(['username:null'])
  })
})

describe('expressions', () => {
  it('proves count() and nothing else about aggregates', async () => {
    expect(await view('v_agg')).toEqual(['total:nn', 'c2:nn', 'mx:null', 's:null'])
    expect(await view('v_over')).toEqual(['username:nn@public.users.username', 'c:nn', 'rn:null'])
  })

  it('proves GROUP BY keys keep their nullability', async () => {
    expect(await view('v_group')).toEqual(['status:null@public.users.status', 'n:nn'])
  })

  it('makes grouping columns nullable under ROLLUP', async () => {
    expect(await view('v_rollup')).toEqual([
      'username:null@public.users.username',
      'status:null@public.users.status',
      'n:nn',
    ])
  })

  it('makes grouping columns nullable under CUBE and GROUPING SETS, also through *', async () => {
    const cube = await sql('select username, count(*) as n from users group by cube (username)', [
      'username',
      'n',
    ])
    expect(render(['username', 'n'], cube)).toEqual(['username:null@public.users.username', 'n:nn'])
    const sets = await sql(
      'select username, status from users group by grouping sets ((username), (status))',
      ['username', 'status']
    )
    expect(render(['username', 'status'], sets)).toEqual([
      'username:null@public.users.username',
      'status:null@public.users.status',
    ])
    const star = await sql('select * from user_profiles group by rollup (id, username)', [
      'id',
      'username',
    ])
    expect(render(['id', 'username'], star)).toEqual([
      'id:null@public.user_profiles.id',
      'username:null@public.user_profiles.username',
    ])
  })

  it('proves COALESCE when an argument is non-null, and drops provenance', async () => {
    expect(await view('v_coalesce')).toEqual(['a:nn', 'b:nn', 'c:null', 'd:nn'])
  })

  it('proves non-null constants, literal casts and builtin casts of non-null values', async () => {
    expect(await view('v_const')).toEqual([
      'a:nn',
      'b:nn',
      'c:nn',
      'd:nn',
      'e:null',
      'f:nn',
      'g:null',
    ])
    expect(await view('v_cast')).toEqual(['a:nn', 'b:nn', 'c:null', 'd:null', 'e:null', 'f:nn'])
  })

  it('does not trust casts to types that are not built in', async () => {
    const r = await sql('select username::citext as a, username::pg_catalog.text as b from users', [
      'a',
      'b',
    ])
    expect(render(['a', 'b'], r)).toEqual(['a:null', 'b:nn'])
  })

  it('treats CASE, subqueries, operators and unknown functions as nullable', async () => {
    expect(await view('v_case')).toEqual(['c:null', 's:null', 'concat:null'])
  })

  it('treats functions in FROM as nullable', async () => {
    expect(await view('v_func')).toEqual(['n:null'])
  })

  it('names columns the way PostgreSQL does for expressions it cannot prove', async () => {
    const r = await sql(
      "select count(*), coalesce(username, 'x'), username::text, exists(select 1), 1 + 1 from users",
      ['count', 'coalesce', 'username', 'exists', '?column?']
    )
    expect(r.error).toBeUndefined()
    expect(r.columns.map((c) => c.nullable)).toEqual([false, false, false, true, true])
  })

  it('treats a whole-row reference as nullable', async () => {
    const r = await sql('select u from users u', ['u'])
    expect(render(['u'], r)).toEqual(['u:null'])
  })
})

describe('set operations and VALUES', () => {
  it('UNION needs every arm to be non-null', async () => {
    expect(await view('v_union')).toEqual(['n:null'])
    expect(await view('v_union2')).toEqual(['n:null'])
    const r = await sql('select username from users union select username from messages', [
      'username',
    ])
    expect(render(['username'], r)).toEqual(['username:nn'])
  })

  it('UNION keeps provenance only when every arm agrees', async () => {
    const r = await sql('select username from users union all select username from users', [
      'username',
    ])
    expect(render(['username'], r)).toEqual(['username:nn@public.users.username'])
  })

  it('INTERSECT needs one non-null arm', async () => {
    expect(await view('v_intersect')).toEqual(['n:nn'])
    const r = await sql('select status from users intersect select status from users', ['status'])
    expect(render(['status'], r)).toEqual(['status:null@public.users.status'])
  })

  it('EXCEPT follows the left arm', async () => {
    expect(await view('v_except')).toEqual(['n:nn@public.users.username'])
    const r = await sql('select username from user_profiles except select username from users', [
      'username',
    ])
    expect(render(['username'], r)).toEqual(['username:null@public.user_profiles.username'])
  })

  it('every VALUES row must prove it', async () => {
    expect(await view('v_values')).toEqual(['a:nn', 'b:null'])
  })

  it('rejects set operations whose arms differ in width', async () => {
    const r = await sql('select 1, 2 union select 3', ['a', 'b'])
    expect(r.error).toMatch(/different column counts/)
  })
})

describe('CTEs', () => {
  it('traces a non-recursive CTE referenced twice and column aliases', async () => {
    const r = await sql(
      'with t(x, y) as (select username, status from users) select a.x, b.y from t a join t b on true',
      ['x', 'y']
    )
    expect(render(['x', 'y'], r)).toEqual([
      'x:nn@public.users.username',
      'y:null@public.users.status',
    ])
  })

  it('treats the self reference of a recursive CTE as nullable', async () => {
    const r = await sql(
      'with recursive t(n) as (select 1 union all select n + 1 from t where n < 3) select n from t',
      ['n']
    )
    expect(render(['n'], r)).toEqual(['n:null'])
  })

  it('lets later CTEs see earlier ones', async () => {
    const r = await sql(
      'with a as (select username from users), b as (select username from a) select username from b',
      ['username']
    )
    expect(render(['username'], r)).toEqual(['username:nn@public.users.username'])
  })
})

describe('SQL function bodies (RPC rows)', () => {
  it('treats parameters as nullable and traces the rest', async () => {
    const r = await sql(defs.f_params, ['a', 'b', 'c'], {
      parameters: ['p', 'n'],
      functionName: 'f_params',
    })
    expect(r.error).toBeUndefined()
    expect(render(['a', 'b', 'c'], r)).toEqual([
      'a:null',
      'b:nn@public.messages.username',
      'c:nn@public.messages.id',
    ])
    expect(r.columns[0].reason).toBe('function parameter')
  })

  it('handles qualified and positional parameter references', async () => {
    const r = await sql('select f.p, $2 from messages', ['p', 'n'], {
      parameters: ['p', 'n'],
      functionName: 'f',
    })
    expect(render(['p', 'n'], r)).toEqual(['p:null', 'n:null'])
    expect(r.columns[0].reason).toBe('function parameter')
  })
})

describe('name resolution', () => {
  it('resolves unqualified names through the search path', async () => {
    const cat: TraceCatalog = {
      relations: [{ schema: 'app', name: 't', kind: 'table', columns: [col('x', true)] }],
      searchPath: ['app', 'public'],
    }
    const r = await sql('select x from t', ['x'], {}, cat)
    expect(render(['x'], r)).toEqual(['x:nn@app.t.x'])
    const miss = await sql('select x from t', ['x'], {}, { ...cat, searchPath: ['public'] })
    expect(render(['x'], miss)).toEqual(['x:null'])
  })

  it('defaults the search path to public', async () => {
    const r = await sql('select username from users', ['username'], {}, { relations: TABLES })
    expect(render(['username'], r)).toEqual(['username:nn@public.users.username'])
  })

  it('resolves schema-qualified relations and schema-qualified column references', async () => {
    const r = await sql('select public.users.username from public.users', ['username'])
    expect(render(['username'], r)).toEqual(['username:nn@public.users.username'])
  })

  it('applies table and column aliases', async () => {
    const r = await sql('select a, b from users as u(a, b)', ['a', 'b'])
    expect(render(['a', 'b'], r)).toEqual([
      'a:nn@public.users.username',
      'b:null@public.users.data',
    ])
  })

  it('treats columns of unknown relations as nullable', async () => {
    const r = await sql('select x from nowhere', ['x'])
    expect(r.error).toBeUndefined()
    expect(render(['x'], r)).toEqual(['x:null'])
    const star = await sql('select * from nowhere', ['x'])
    expect(star.error).toMatch(/unknown columns/)
  })

  it('makes unresolvable references nullable', async () => {
    const r = await sql('select nope from users', ['nope'])
    expect(render(['nope'], r)).toEqual(['nope:null'])
  })

  it('treats opaque relations as nullable', async () => {
    const cat: TraceCatalog = {
      relations: [
        {
          schema: 'public',
          name: 'mv',
          kind: 'other',
          columns: [col('x', true)],
        },
      ],
    }
    const r = await sql('select x from mv', ['x'], {}, cat)
    expect(render(['x'], r)).toEqual(['x:null'])
  })
})

describe('views in the catalog', () => {
  const base: CatalogRelation = table('t', [col('x', true), col('y')])

  it('uses a precomputed trace instead of re-parsing the definition', async () => {
    const cat: TraceCatalog = {
      relations: [
        base,
        {
          schema: 'public',
          name: 'v',
          kind: 'view',
          columns: [col('x'), col('y')],
          traced: [
            { nullable: false, source: { schema: 'public', relation: 't', column: 'x' } },
            { nullable: true, reason: 'because' },
          ],
        },
      ],
    }
    const r = await sql('select x, y from v', ['x', 'y'], {}, cat)
    expect(render(['x', 'y'], r)).toEqual(['x:nn@public.t.x', 'y:null'])
    const wrapped: TraceCatalog = {
      relations: [
        base,
        {
          ...cat.relations[1],
          traced: { columns: cat.relations[1].traced as never[] },
        },
      ],
    }
    const w = await sql('select x, y from v', ['x', 'y'], {}, wrapped)
    expect(render(['x', 'y'], w)).toEqual(['x:nn@public.t.x', 'y:null'])
  })

  it('degrades a view it cannot trace to all-nullable without failing the caller', async () => {
    const cat: TraceCatalog = {
      relations: [
        base,
        {
          schema: 'public',
          name: 'v',
          kind: 'view',
          columns: [col('x')],
          definition: 'this is not sql',
        },
        { schema: 'public', name: 'nodef', kind: 'view', columns: [col('x')] },
      ],
    }
    const r = await sql('select v.x, n.x as nx from v, nodef n', ['x', 'nx'], {}, cat)
    expect(r.error).toBeUndefined()
    expect(render(['x', 'nx'], r)).toEqual(['x:null', 'nx:null'])
  })

  it('breaks view cycles', async () => {
    const cat: TraceCatalog = {
      relations: [
        {
          schema: 'public',
          name: 'a',
          kind: 'view',
          columns: [col('x')],
          definition: 'select x from b',
        },
        {
          schema: 'public',
          name: 'b',
          kind: 'view',
          columns: [col('x')],
          definition: 'select x from a',
        },
      ],
    }
    const r = await sql('select x from a', ['x'], {}, cat)
    expect(render(['x'], r)).toEqual(['x:null'])
  })
})

describe('failure modes', () => {
  it('returns all-nullable with an error for SQL that does not parse', async () => {
    const r = await sql('selec 1', ['a', 'b'])
    expect(r.error).toMatch(/could not parse/)
    expect(r.columns).toHaveLength(2)
    expect(r.columns.every((c) => c.nullable && c.reason)).toBe(true)
  })

  it('rejects statements that are not a single SELECT', async () => {
    expect((await sql('select 1; select 2', ['a'])).error).toMatch(/single statement/)
    expect((await sql('delete from users', ['a'])).error).toMatch(/not a SELECT/)
  })

  it('rejects a column count mismatch', async () => {
    const r = await sql('select 1', ['a', 'b'])
    expect(r.error).toMatch(/expected 2/)
    expect(r.columns).toHaveLength(2)
  })

  it('supports selecting another PostgreSQL version', async () => {
    const t16 = await createTracer({ pgVersion: 16 })
    const r = await t16.trace({ sql: 'select username from users', columns: ['username'], catalog })
    expect(render(['username'], r)).toEqual(['username:nn@public.users.username'])
  })
})
