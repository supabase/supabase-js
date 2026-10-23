import { PostgrestClient } from '../src/index'

// Runtime facts behind test/types/common/30-terminal-surface.test-d.ts and 31-scalar-array.test-d.ts. Read-only: the
// function public.int_array_upto (migration 00000000000090) and the users table are only read.
const postgrest = new PostgrestClient<any>('http://localhost:54321/rest/v1')

describe('a scalar function whose type is an array', () => {
  test.each([
    [-1, null],
    [0, []],
    [1, [1]],
    [2, [1, 2]],
  ])('n = %i: the array itself is the data, and single() keeps it', async (n, array) => {
    const plain = await postgrest.rpc('int_array_upto', { n })
    expect(plain.error).toBeNull()
    expect(plain.data).toEqual(array)

    // PostgREST does not enforce object cardinality on a scalar: the array comes back whatever its length
    const single = await postgrest.rpc('int_array_upto', { n }).single()
    expect(single.error).toBeNull()
    expect(single.data).toEqual(array)
  })

  test.each([
    [-1, null],
    [0, null],
    [1, 1],
  ])('n = %i: maybeSingle() unwraps the array, [] and null are null data', async (n, data) => {
    const res = await postgrest.rpc('int_array_upto', { n }).maybeSingle()
    expect(res.error).toBeNull()
    expect(res.data).toBe(data)
    expect(res.status).toBe(200)
  })

  test('maybeSingle() with more than one element is an error with no data', async () => {
    const res = await postgrest.rpc('int_array_upto', { n: 2 }).maybeSingle()
    expect(res.data).toBeNull()
    expect(res.error?.code).toBe('PGRST116')
    expect(res.status).toBe(406)

    await expect(
      postgrest.rpc('int_array_upto', { n: 2 }).maybeSingle().throwOnError()
    ).rejects.toMatchObject({ code: 'PGRST116' })
  })

  test('the last of single() and maybeSingle() wins', async () => {
    const maybe = await postgrest.rpc('int_array_upto', { n: 1 }).single().maybeSingle()
    expect(maybe.data).toBe(1)
    const single = await postgrest.rpc('int_array_upto', { n: 1 }).maybeSingle().single()
    expect(single.data).toEqual([1])
  })
})

describe('terminal builders', () => {
  const terminal = () => postgrest.from('users').select('username').explain({ format: 'json' })

  test('throwOnError() and stripNulls() on explain() keep the plan array', async () => {
    const res = await terminal().throwOnError().stripNulls().throwOnError()
    expect(res.error).toBeNull()
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data[0]).toHaveProperty('Plan')
  })

  test('single() after explain() replaces the plan Accept header: the users, not a plan', async () => {
    // the type no longer offers it (the terminal builder has no single()): this is what it did when it was reachable
    const res = await (terminal().throwOnError() as any).limit(1).single()
    expect(res.data).toHaveProperty('username')
    expect(res.data).not.toHaveProperty('Plan')
    expect(Array.isArray(res.data)).toBe(false)
  })
})
