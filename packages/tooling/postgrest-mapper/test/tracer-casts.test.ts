import {
  buildTraceCatalog,
  createPlannerHost,
  createTracer,
  type AcquiredSchema,
  type PlannerHost,
  type TraceCatalog,
  type Tracer,
} from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'

/**
 * A cast of a non-null value is proven non-null by the tracer exactly where the planner proves it
 * (`castKeepsNonNull`): between builtin types only along the planner's pairs, and `timestamptz::time` is NULL for
 * `infinity`. Both run over the real columns of `public.cast_cases` of the postgrest-js test stack.
 */
const CASTS: [name: string, column: string, target: string][] = [
  ['a', 'tstz', 'time'],
  ['b', 'ts', 'time'],
  ['c', 'tstz', 'timetz'],
  ['d', 'n', 'int8'],
  ['e', 'n', 'text'],
  ['f', 'tstz', 'text'],
  ['g', 'n', 'float8'],
  ['h', 'n', 'numeric'],
  ['i', 'ts', 'timestamp'],
  ['j', 'tstz', 'date'],
  ['k', 'n', 'bool'],
]

let acquired: AcquiredSchema
let catalog: TraceCatalog
let host: PlannerHost
let tracer: Tracer

beforeAll(async () => {
  acquired = await acquireFromStack()
  catalog = buildTraceCatalog(acquired.supplementary)
  tracer = await createTracer()
  host = createPlannerHost({ wasmPath: plannerWasmPath() })
  expect((await host.load(acquired)).ok).toBe(true)
}, 120_000)
afterAll(async () => {
  await host?.close()
})

const nullabilityOf = async (sql: string, names: string[]): Promise<boolean[]> => {
  const result = await tracer.trace({ sql, columns: names, catalog })
  expect(result.error).toBeUndefined()
  return result.columns.map((c) => c.nullable)
}

describe('casts of non-null builtin values', () => {
  it('prove non-null only along the pairs the planner proves', async () => {
    const names = CASTS.map(([name]) => name)
    const traced = await nullabilityOf(
      `select ${CASTS.map(([n, c, t]) => `${c}::${t} as ${n}`).join(', ')} from public.cast_cases`,
      names
    )
    const planned = await host.plan({
      method: 'GET',
      url: `/cast_cases?select=${CASTS.map(([n, c, t]) => `${n}:${c}::${t}`).join(',')}`,
      headers: { 'Accept-Profile': 'public' },
    })
    if (!planned.ok || !planned.shape) throw new Error(JSON.stringify(planned))
    const plannerSays = planned.shape.fields.map((f) => f.nullable)
    expect(plannerSays).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ])
    expect(traced).toEqual(plannerSays)
  })

  it('treat a literal cast to a type that is not built in as nullable unless it is a string', async () => {
    // `1::public.money_like` calls the registered cast function, which may return NULL; `'1'::money_like` reads
    // the string with the type's input function, which cannot
    const result = await tracer.trace({
      sql: `select 1::public.money_like as a, '1'::public.money_like as b, 1::int8 as c, 1.5::numeric as d, 1::bool as e`,
      columns: ['a', 'b', 'c', 'd', 'e'],
      catalog: { relations: [] },
    })
    expect(result.error).toBeUndefined()
    expect(result.columns.map((c) => c.nullable)).toEqual([true, false, false, false, true])
  })
})
