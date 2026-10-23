import {
  type FieldProvenance,
  type LoadSuccess,
  type Planner,
  type PlanResult,
  type PlanSuccess,
} from '../src'
import { baseInput, loadTrackedPlanner, supplementaryText, type TrackedPlanner } from './support'

let tracked: TrackedPlanner
let planner: Planner
/** Loaded with `fixtures/supplementary.json`. */
let catalog: number

const loaded = (res: ReturnType<Planner['load']>): LoadSuccess => {
  if (!res.ok) throw new Error(`load failed: ${JSON.stringify(res)}`)
  return res
}
const ok = (res: PlanResult): PlanSuccess => {
  if (!res.ok) throw new Error(`plan failed: ${JSON.stringify(res)}`)
  return res
}

beforeAll(async () => {
  tracked = await loadTrackedPlanner()
  planner = tracked.planner
  catalog = loaded(planner.load({ ...baseInput(), supplementary: supplementaryText() })).handle
})

afterAll(() => planner?.freeCache(catalog))

describe('count() provenance', () => {
  it('has no inner provenance: `of` is null', () => {
    const plan = ok(planner.plan(catalog, { method: 'GET', url: '/users?select=count()' }))
    if (plan.action !== 'read') throw new Error(`unexpected action ${plan.action}`)
    const provenance = plan.shape?.fields[0]?.provenance
    expect(provenance).toEqual({ kind: 'aggregate', function: 'count', of: null })

    // the type admits it, and makes the consumer check before reading through `of`
    const aggregate = provenance as Extract<FieldProvenance, { kind: 'aggregate' }>
    const inner: FieldProvenance | null = aggregate.of
    expect(inner).toBeNull()
    // @ts-expect-error `of` is null for count()
    expect(() => aggregate.of.kind).toThrow(TypeError)
  })
})

describe('plans that are not a read of a relation', () => {
  const base = {
    ok: true,
    warnings: [],
    form: null,
    shape: null,
    rpc: null,
    filters: [],
    degraded: [],
  }

  it('GET / is an inspect plan: schema and media, nothing else', () => {
    const plan = ok(planner.plan(catalog, { method: 'GET', url: '/' }))
    expect(plan).toEqual({
      ...base,
      action: 'inspect',
      schema: 'public',
      media: 'application/openapi+json',
    })
    if (plan.action !== 'inspect') throw new Error('not narrowed')
    const schema: string = plan.schema
    expect(schema).toBe('public')
    // @ts-expect-error an inspect plan has no select
    expect(plan.select).toBeUndefined()
    // @ts-expect-error an inspect plan has no embeds
    expect(plan.embeds).toBeUndefined()
    // @ts-expect-error an inspect plan has no txMode
    expect(plan.txMode).toBeUndefined()
    // @ts-expect-error an inspect plan has no target
    expect(plan.target).toBeUndefined()
  })

  it('OPTIONS / is a schemaInfo plan', () => {
    const plan = ok(planner.plan(catalog, { method: 'OPTIONS', url: '/' }))
    expect(plan).toEqual({ ...base, action: 'schemaInfo' })
  })

  it('OPTIONS on a relation is a relationInfo plan: the target only', () => {
    const plan = ok(planner.plan(catalog, { method: 'OPTIONS', url: '/users' }))
    expect(plan).toEqual({
      ...base,
      action: 'relationInfo',
      target: { name: 'users', schema: 'public' },
    })
    if (plan.action !== 'relationInfo') throw new Error('not narrowed')
    expect(plan.target.name).toBe('users')
    // @ts-expect-error a relationInfo plan has no select
    expect(plan.select).toBeUndefined()
  })

  it('OPTIONS on a function is a routineInfo plan: the routine only', () => {
    const plan = ok(planner.plan(catalog, { method: 'OPTIONS', url: '/rpc/void_func' }))
    expect(plan).toMatchObject({ ...base, action: 'routineInfo', routine: { name: 'void_func' } })
    expect(plan).not.toHaveProperty('target')
    expect(plan).not.toHaveProperty('select')
  })

  it('a read plan still has everything, and narrowing on `action` gives the mutation or the call', () => {
    const read = ok(planner.plan(catalog, { method: 'GET', url: '/users?select=username' }))
    if (read.action !== 'read') throw new Error('not narrowed')
    expect(read.txMode).toBe('read')
    expect(read.select.map((s) => s.name)).toEqual(['username'])
    expect(read.embeds).toEqual([])
    expect(read.target).toEqual({ name: 'users', schema: 'public' })
    // @ts-expect-error a read plan has no mutation
    expect(read.mutation).toBeUndefined()

    const rpc = ok(planner.plan(catalog, { method: 'GET', url: '/rpc/get_status?name_param=x' }))
    if (rpc.action !== 'rpc') throw new Error('not narrowed')
    expect(rpc.payloadKeys).toEqual([])
    expect(rpc.routine).toMatchObject({ name: 'get_status' })
    expect(rpc.txMode).toBe('read')

    const insert = ok(
      planner.plan(catalog, {
        method: 'POST',
        url: '/users',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'x' }),
      })
    )
    if (insert.action !== 'insert') throw new Error('not narrowed')
    expect(insert.txMode).toBe('write')
    expect(insert.mutation).toMatchObject({ kind: 'insert' })
  })
})

describe('buffers handed to the wasm module', () => {
  const unserializable = () => {
    const cyclic: Record<string, unknown> = { format: 1 }
    cyclic['self'] = cyclic
    return cyclic as unknown as NonNullable<Parameters<Planner['load']>[0]['supplementary']>
  }

  it('are released when serializing the supplementary catalog throws', () => {
    const before = tracked.liveBuffers()
    for (let i = 0; i < 3; i++) {
      expect(() => planner.load({ ...baseInput(), supplementary: unserializable() })).toThrow(
        TypeError
      )
    }
    expect(tracked.liveBuffers()).toBe(before)
  })

  it('are released after a load, a failed load and a plan', () => {
    const before = tracked.liveBuffers()
    const res = planner.load({ ...baseInput(), supplementary: '{"format": 2}' })
    expect(res).toMatchObject({ ok: false, error: { code: 'PLANNER_BAD_SUPPLEMENTARY' } })
    const { handle } = loaded(planner.load(baseInput()))
    expect(planner.plan(handle, { method: 'GET', url: '/users' }).ok).toBe(true)
    expect(planner.plan(handle, { method: 'GET', url: '/nope' }).ok).toBe(false)
    planner.freeCache(handle)
    expect(tracked.liveBuffers()).toBe(before)
  })

  it('are released when a plan input cannot be serialized', () => {
    const before = tracked.liveBuffers()
    const request = { method: 'POST', url: '/users', body: 1n as unknown as string }
    expect(() => planner.plan(catalog, request)).toThrow(TypeError)
    expect(tracked.liveBuffers()).toBe(before)
  })

  it('do not grow the memory over repeated throwing loads', () => {
    const schemaBytes = baseInput().schema.length
    // warm up: the first calls may grow the heap to its working size
    for (let i = 0; i < 5; i++) {
      expect(() => planner.load({ ...baseInput(), supplementary: unserializable() })).toThrow()
    }
    const before = tracked.memoryBytes()
    for (let i = 0; i < 40; i++) {
      expect(() => planner.load({ ...baseInput(), supplementary: unserializable() })).toThrow()
    }
    // a leak would be 40 copies of the schema dump at least
    expect(tracked.memoryBytes() - before).toBeLessThan(schemaBytes)
  })
})
