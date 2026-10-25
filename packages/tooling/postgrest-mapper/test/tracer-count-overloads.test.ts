import {
  buildFunctionTraceInputs,
  createTracer,
  type Supplementary,
  type SupplementaryFunction,
  type Tracer,
} from '../src'
import { column, supplementary as catalog, table } from './support/printer'

/**
 * `count(x)` is the builtin (bigint, never NULL) unless a function or aggregate named `count` of the schemas the body
 * resolves function names in takes the operand: the rule of the planner's `aggregateOverloaded`, over the catalog the
 * tracer is given. The live case (a schema the catalog does not list) is `generate-count-overloads.test.ts`.
 */

const body = (sql: string, searchPath: string | null): SupplementaryFunction => ({
  schema: 'public',
  name: 'f',
  argTypes: [],
  volatility: 's',
  defaults: 0,
  returns: { kind: 'scalar', setof: false, type: 'text' },
  outColumns: null,
  language: 'sql',
  source: sql,
  argNames: null,
  searchPath,
})

const supplementary = (extra: Partial<Supplementary>): Supplementary =>
  catalog({
    schemas: ['public', 'extra'],
    types: [{ schema: 'public', name: 'amount', kind: 'd', base: 'integer' }],
    implicitCasts: [
      { source: 'integer', target: 'bigint' },
      { source: 'smallint', target: 'integer' },
    ],
    relations: [
      table('public', 't', [
        column('i', 'integer', 1),
        column('s', 'smallint', 2),
        column('a', 'public.amount', 3),
        column('x', 'text', 4),
      ]),
    ],
    ...extra,
  })

/** A function `count(arg)` of `schema`, as the catalog lists it */
const countFn = (schema: string, argType: string, defaults = 0, extraArgs: string[] = []) => ({
  schema,
  name: 'count',
  argTypes: [argType, ...extraArgs],
  volatility: 'i',
  defaults,
  returns: { kind: 'scalar' as const, setof: false, type: 'text' },
  outColumns: null,
})

describe('count in a function body', () => {
  let tracer: Tracer
  beforeAll(async () => {
    tracer = await createTracer()
  })

  /** Whether the count of `operand` of `t` is proven non-null in a body that runs with `searchPath` */
  async function proven(
    operand: string,
    candidates: ReturnType<typeof countFn>[],
    searchPath: string | null = 'extra, public',
    sql = `select count(${operand}) from t`
  ): Promise<boolean> {
    const [input] = buildFunctionTraceInputs(
      supplementary({
        functions: [body(sql, searchPath)],
        searchPathFunctions: candidates,
      }),
      { searchPath: ['public'], exposedSchemas: ['public', 'extra'] }
    )
    const traced = await tracer.trace(input!.input)
    expect(traced.error).toBeUndefined()
    return !traced.columns[0]!.nullable
  }

  test('is proven when no function named count is on the path', async () => {
    expect(await proven('i', [])).toBe(true)
    expect(await proven('i', [], null)).toBe(true)
  })

  test('is not proven when a function of the path takes the operand, whatever it returns', async () => {
    expect(await proven('i', [countFn('extra', 'integer')])).toBe(false)
    expect(await proven('i', [countFn('extra', 'int4')])).toBe(false)
    // a user function of the schema of the function itself is on a path that does not set its own
    expect(await proven('i', [countFn('public', 'integer')], null)).toBe(false)
  })

  test('reads a domain as its base type, an implicit cast target, and a pseudo type as taking anything', async () => {
    expect(await proven('a', [countFn('extra', 'integer')])).toBe(false)
    expect(await proven('i', [countFn('extra', 'bigint')])).toBe(false)
    expect(await proven('s', [countFn('extra', 'bigint')])).toBe(true) // smallint has no cast to bigint listed
    expect(await proven('x', [countFn('extra', 'anyelement')])).toBe(false)
    expect(await proven('x', [countFn('extra', 'anyarray')])).toBe(false)
  })

  test('is proven when no candidate takes the operand', async () => {
    expect(await proven('x', [countFn('extra', 'integer')])).toBe(true)
    expect(await proven('x', [countFn('extra', 'bigint')])).toBe(true)
  })

  test('ignores a candidate of a schema off the path', async () => {
    expect(await proven('i', [countFn('extra', 'integer')], 'public')).toBe(true)
  })

  test('needs one argument, the other ones having defaults', async () => {
    expect(await proven('i', [countFn('extra', 'integer', 0, ['text'])])).toBe(true)
    expect(await proven('i', [countFn('extra', 'integer', 1, ['text'])])).toBe(false)
  })

  test('takes the element of an array argument, which may be VARIADIC', async () => {
    expect(await proven('i', [countFn('extra', 'integer[]')])).toBe(false)
    expect(await proven('x', [countFn('extra', 'integer[]')])).toBe(true)
  })

  test('is a candidate of any operand when its type is not known', async () => {
    expect(await proven('i + s', [countFn('extra', 'text')])).toBe(false)
    expect(await proven('null', [countFn('extra', 'text')])).toBe(false)
  })

  test('never reads count(*), nor a qualified pg_catalog.count', async () => {
    expect(
      await proven('', [countFn('extra', 'anyelement')], 'extra, public', 'select count(*) from t')
    ).toBe(true)
    expect(
      await proven(
        '',
        [countFn('extra', 'anyelement')],
        'extra, public',
        'select pg_catalog.count(i) from t'
      )
    ).toBe(true)
  })

  test('is not proven when the path names a schema the catalog does not list', async () => {
    expect(await proven('i', [], 'unlisted, public')).toBe(false)
    expect(await proven('i', [], 'public, unlisted')).toBe(false)
    // pg_catalog is always searched, and a listed schema holds what the catalog says
    expect(await proven('i', [], 'pg_catalog, public')).toBe(true)
    expect(await proven('i', [], '""')).toBe(true)
  })
})
