import PostgrestClient from '../src/PostgrestClient'
import PostgrestError from '../src/PostgrestError'
import { RPC_READ_REFUSAL_CODE } from '../src/rpcReadRefusal'

// No Docker: every request goes to an injected fetch.
const BASE = 'https://example.com/rest/v1'

const setup = () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    text: async () => '"ok"',
  })
  const client = new PostgrestClient<any>(BASE, { fetch: fetchMock as any })
  // untyped client: `fn` is not in any schema, the request building is what is tested
  const call = (args: object | undefined, options: { get?: boolean; head?: boolean } = {}) =>
    client.rpc('fn', args as any, options) as any
  return { fetchMock, call }
}

describe('rpc method', () => {
  test('POST by default, with the arguments in the body', async () => {
    const { fetchMock, call } = setup()
    await call({ a: 1, o: { x: 1 } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/rpc/fn`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ a: 1, o: { x: 1 } })
  })

  test('POST for get: false and head: false, even with a reserved key or an operator-looking string', async () => {
    const { fetchMock, call } = setup()
    await call({ select: 'eq.x' }, { get: false, head: false })
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })

  test('GET with get: true carries scalar and array arguments in the query string', async () => {
    const { fetchMock, call } = setup()
    const res = await call(
      { a: 1, b: 'x y', c: [1, 2, 3], d: ['p', 'q'], skipped: undefined, color: 'red' },
      { get: true }
    )
    expect(res.error).toBeNull()
    const [url, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(new URL(url).search).toBe('?a=1&b=x+y&c=%7B1%2C2%2C3%7D&d=%7Bp%2Cq%7D&color=red')
  })

  test('HEAD with head: true, and head wins over get', async () => {
    const { fetchMock, call } = setup()
    await call({ a: 1 }, { head: true })
    await call({ a: 1 }, { head: true, get: true })
    for (const [url, init] of fetchMock.mock.calls) {
      expect(init.method).toBe('HEAD')
      expect(new URL(url).search).toBe('?a=1')
    }
  })

  test('a value that merely contains an operator, or an array element that looks like one, is sent', async () => {
    const { fetchMock, call } = setup()
    const res = await call(
      { a: 'x.eq.y', b: 'equal.', c: ['eq.x', 'in.(1)'], d: 'not' },
      { get: true }
    )
    expect(res.error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('count sets Prefer on GET', async () => {
    const { fetchMock, call } = setup()
    await call({ a: 1 }, { get: true, count: 'exact' } as any)
    expect(fetchMock.mock.calls[0][1].headers.prefer).toBe('count=exact')
  })
})

describe('rpc GET and HEAD refusals', () => {
  const refused: [string, object, string][] = [
    ['select', { select: 'x' }, "GET and HEAD refuse the reserved key 'select'"],
    ['columns', { columns: 'x' }, "GET and HEAD refuse the reserved key 'columns'"],
    ['on_conflict', { on_conflict: 'x' }, "GET and HEAD refuse the reserved key 'on_conflict'"],
    ['order', { order: 'x' }, "GET and HEAD refuse the reserved key 'order'"],
    ['limit', { limit: 1 }, "GET and HEAD refuse the reserved key 'limit'"],
    ['offset', { offset: 1 }, "GET and HEAD refuse the reserved key 'offset'"],
    ['and', { and: 'x' }, "GET and HEAD refuse the reserved key 'and'"],
    ['or', { or: 'x' }, "GET and HEAD refuse the reserved key 'or'"],
    ['dotted key', { 'x.limit': 1 }, "GET and HEAD refuse the reserved key 'x.limit'"],
    ['object value', { v: { x: 1 } }, "GET and HEAD refuse an object value for 'v'"],
    ['Date value', { v: new Date(0) }, "GET and HEAD refuse an object value for 'v'"],
    ['array of objects', { v: [{ x: 1 }] }, "GET and HEAD refuse an object value for 'v'"],
    ['mixed array', { v: [1, { x: 1 }] }, "GET and HEAD refuse an object value for 'v'"],
    ['nested array of objects', { v: [[{ x: 1 }]] }, "GET and HEAD refuse an object value for 'v'"],
    ['eq.', { v: 'eq.1' }, "GET and HEAD refuse a value read as a filter for 'v'"],
    ['eq(any).', { v: 'eq(any).1' }, "GET and HEAD refuse a value read as a filter for 'v'"],
    ['not.', { v: 'not.eq.1' }, "GET and HEAD refuse a value read as a filter for 'v'"],
    ['in.', { v: 'in.(1,2)' }, "GET and HEAD refuse a value read as a filter for 'v'"],
    ['is.', { v: 'is.null' }, "GET and HEAD refuse a value read as a filter for 'v'"],
    ['fts(lang).', { v: 'fts(english).x' }, "GET and HEAD refuse a value read as a filter for 'v'"],
    ['cs.', { v: 'cs.{1}' }, "GET and HEAD refuse a value read as a filter for 'v'"],
    ['imatch.', { v: 'imatch.^a' }, "GET and HEAD refuse a value read as a filter for 'v'"],
  ]

  describe.each([
    ['GET', { get: true }],
    ['HEAD', { head: true }],
  ])('%s', (_method, options) => {
    test.each(refused)('refuses %s without a network call', async (_name, args, message) => {
      const { fetchMock, call } = setup()
      const res = await call(args, options)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(res.data).toBeNull()
      expect(res.count).toBeNull()
      expect(res.success).toBe(false)
      expect(res.status).toBe(0)
      expect(res.error).toBeInstanceOf(PostgrestError)
      expect(res.error.code).toBe(RPC_READ_REFUSAL_CODE)
      expect(res.error.message).toBe(message)
    })

    test('throws with throwOnError() and still never fetches', async () => {
      const { fetchMock, call } = setup()
      const promise = call({ select: 'x' }, options).throwOnError()
      await expect(promise).rejects.toBeInstanceOf(PostgrestError)
      await expect(promise).rejects.toMatchObject({ code: 'PGRSTJS01' })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    // an object the refusal names can't be coerced to a string: the refusal is returned, never a synchronous TypeError
    describe.each([
      ['a toString that is not callable', () => ({ toString: 'value' })],
      ['a null prototype', () => Object.create(null)],
    ])('an object with %s', (_name, make) => {
      test('is refused, not thrown while building the request', async () => {
        const { fetchMock, call } = setup()
        const res = await call({ payload: make() }, options)
        expect(fetchMock).not.toHaveBeenCalled()
        expect(res.error).toBeInstanceOf(PostgrestError)
        expect(res.error.code).toBe(RPC_READ_REFUSAL_CODE)
        expect(res.error.message).toBe("GET and HEAD refuse an object value for 'payload'")
      })

      test('rejects with throwOnError()', async () => {
        const { fetchMock, call } = setup()
        const promise = call({ payload: make() }, options).throwOnError()
        await expect(promise).rejects.toMatchObject({ code: RPC_READ_REFUSAL_CODE })
        expect(fetchMock).not.toHaveBeenCalled()
      })
    })

    test('names every offending key', async () => {
      const { call } = setup()
      const res = await call({ select: 'x', v: { x: 1 }, w: 'eq.1', ok: 1 }, options)
      expect(res.error.message).toBe(
        "GET and HEAD refuse the reserved key 'select'; GET and HEAD refuse an object value for 'v'; GET and HEAD refuse a value read as a filter for 'w'"
      )
    })

    test('an undefined value is not sent and not refused', async () => {
      const { fetchMock, call } = setup()
      const res = await call({ select: undefined, v: undefined, a: 1 }, options)
      expect(res.error).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    test('a chained filter keeps the refusal', async () => {
      const { fetchMock, call } = setup()
      const res = await call({ select: 'x' }, options).eq('id', 1)
      expect(res.error.code).toBe(RPC_READ_REFUSAL_CODE)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  test('no arguments are fine on GET and HEAD', async () => {
    const { fetchMock, call } = setup()
    await call(undefined, { get: true })
    await call(undefined, { head: true })
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      [`${BASE}/rpc/fn`, 'GET'],
      [`${BASE}/rpc/fn`, 'HEAD'],
    ])
  })
})
