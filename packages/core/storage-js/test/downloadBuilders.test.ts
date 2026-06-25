import BlobDownloadBuilder from '../src/packages/BlobDownloadBuilder'
import StreamDownloadBuilder from '../src/packages/StreamDownloadBuilder'
import { StorageApiError } from '../src/lib/common/errors'

const makeOkResponse = () =>
  new Response('hello', { status: 200, headers: { 'content-type': 'text/plain' } })

describe('StreamDownloadBuilder Promise interface', () => {
  test('invokes downloadFn once across multiple awaits', async () => {
    const downloadFn = jest.fn(async () => makeOkResponse())
    const builder = new StreamDownloadBuilder(downloadFn, false)

    const a = await builder
    const b = await builder
    const c = await builder

    expect(downloadFn).toHaveBeenCalledTimes(1)
    expect(a.error).toBeNull()
    expect(b.error).toBeNull()
    expect(c.error).toBeNull()
  })

  test('.catch() handles a rejected execute when shouldThrowOnError is true', async () => {
    const downloadFn = jest.fn(async () => {
      throw new StorageApiError('Object not found', 404, 'Not found')
    })
    const builder = new StreamDownloadBuilder(downloadFn, true)

    const handler = jest.fn(() => 'caught')
    const result = await builder.catch(handler)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(result).toBe('caught')
  })

  test('.finally() runs after the underlying promise settles', async () => {
    const downloadFn = jest.fn(async () => makeOkResponse())
    const builder = new StreamDownloadBuilder(downloadFn, false)

    const onFinally = jest.fn()
    const result = await builder.finally(onFinally)

    expect(onFinally).toHaveBeenCalledTimes(1)
    expect(result.error).toBeNull()
  })

  test('[Symbol.toStringTag] returns "StreamDownloadBuilder"', () => {
    const builder = new StreamDownloadBuilder(async () => makeOkResponse(), false)
    expect(builder[Symbol.toStringTag]).toBe('StreamDownloadBuilder')
    expect(Object.prototype.toString.call(builder)).toBe('[object StreamDownloadBuilder]')
  })

  test('is assignable to Promise<DownloadResult<ReadableStream>>', () => {
    // Type-level check: the builder must satisfy Promise, not just PromiseLike.
    // If this file compiles, the assertion holds. Mirrors BlobDownloadBuilder.
    const builder = new StreamDownloadBuilder(async () => makeOkResponse(), false)
    const asPromise: Promise<Awaited<typeof builder>> = builder
    expect(asPromise).toBe(builder)
  })
})

describe('BlobDownloadBuilder Promise interface (regression baseline)', () => {
  test('invokes downloadFn once across multiple awaits', async () => {
    const downloadFn = jest.fn(async () => makeOkResponse())
    const builder = new BlobDownloadBuilder(downloadFn, false)

    await builder
    await builder
    await builder

    expect(downloadFn).toHaveBeenCalledTimes(1)
  })

  test('[Symbol.toStringTag] returns "BlobDownloadBuilder"', () => {
    const builder = new BlobDownloadBuilder(async () => makeOkResponse(), false)
    expect(builder[Symbol.toStringTag]).toBe('BlobDownloadBuilder')
  })
})
