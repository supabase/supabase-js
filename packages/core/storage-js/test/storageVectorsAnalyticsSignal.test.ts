import { StorageAnalyticsClient, StorageVectorsClient } from '../src/index'
import { StorageUnknownError } from '../src/lib/common/errors'
import { FetchParameters, VectorFetchParameters } from '../src/lib/types'

const okResponse = () =>
  new Response(JSON.stringify({}), {
    headers: { 'content-type': 'application/json' },
  })

const abortError = () => new DOMException('This operation was aborted', 'AbortError')

/**
 * A fetch stand-in that behaves like the platform fetch with respect to `signal`:
 * it rejects immediately for an already-aborted signal, rejects when the signal
 * aborts while the request is in flight, and otherwise resolves once `respond()`
 * is called.
 */
function createControllableFetch() {
  let respond: (() => void) | undefined
  const fetchMock = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal
      if (signal?.aborted) {
        reject(abortError())
        return
      }
      signal?.addEventListener('abort', () => reject(abortError()))
      respond = () => resolve(okResponse())
    })
  })
  return {
    fetchMock: fetchMock as unknown as jest.MockedFunction<typeof fetch>,
    respond: () => respond?.(),
  }
}

type Result = { data: unknown; error: unknown }

interface Operation {
  name: string
  method: 'GET' | 'POST' | 'DELETE'
  errorName: string
  call: (fetchMock: typeof fetch, parameters?: FetchParameters) => Promise<Result>
}

const VECTORS_URL = 'http://localhost/storage/v1/vector'
const ANALYTICS_URL = 'http://localhost/storage/v1/iceberg'

function vectors(fetchMock: typeof fetch) {
  return new StorageVectorsClient(VECTORS_URL, { fetch: fetchMock })
}

function vectorIndex(fetchMock: typeof fetch) {
  return vectors(fetchMock).from('bucket').index('index')
}

function analytics(fetchMock: typeof fetch) {
  return new StorageAnalyticsClient(ANALYTICS_URL, {}, fetchMock)
}

function vectorOperation(
  name: string,
  call: (fetchMock: typeof fetch, parameters?: VectorFetchParameters) => Promise<Result>
): Operation {
  return { name, method: 'POST', errorName: 'StorageVectorsUnknownError', call }
}

const operations: Operation[] = [
  vectorOperation('vectors.createBucket', (f, p) => vectors(f).createBucket('bucket', p)),
  vectorOperation('vectors.getBucket', (f, p) => vectors(f).getBucket('bucket', p)),
  vectorOperation('vectors.listBuckets', (f, p) => vectors(f).listBuckets({}, p)),
  vectorOperation('vectors.deleteBucket', (f, p) => vectors(f).deleteBucket('bucket', p)),
  vectorOperation('bucket.createIndex', (f, p) =>
    vectors(f)
      .from('bucket')
      .createIndex(
        { indexName: 'index', dataType: 'float32', dimension: 3, distanceMetric: 'cosine' },
        p
      )
  ),
  vectorOperation('bucket.listIndexes', (f, p) => vectors(f).from('bucket').listIndexes({}, p)),
  vectorOperation('index.putVectors', (f, p) =>
    vectorIndex(f).putVectors({ vectors: [{ key: 'a', data: { float32: [0.1, 0.2, 0.3] } }] }, p)
  ),
  vectorOperation('index.getVectors', (f, p) => vectorIndex(f).getVectors({ keys: ['a'] }, p)),
  vectorOperation('index.listVectors', (f, p) => vectorIndex(f).listVectors({}, p)),
  vectorOperation('index.queryVectors', (f, p) =>
    vectorIndex(f).queryVectors({ queryVector: { float32: [0.1, 0.2, 0.3] }, topK: 1 }, p)
  ),
  vectorOperation('index.deleteVectors', (f, p) =>
    vectorIndex(f).deleteVectors({ keys: ['a'] }, p)
  ),
  {
    name: 'analytics.createBucket',
    method: 'POST',
    errorName: 'StorageUnknownError',
    call: (f, p) => analytics(f).createBucket('bucket', p),
  },
  {
    name: 'analytics.listBuckets',
    method: 'GET',
    errorName: 'StorageUnknownError',
    call: (f, p) => analytics(f).listBuckets({ limit: 1 }, p),
  },
  {
    name: 'analytics.deleteBucket',
    method: 'DELETE',
    errorName: 'StorageUnknownError',
    call: (f, p) => analytics(f).deleteBucket('bucket', p),
  },
]

describe.each(operations)('$name with an AbortSignal', ({ method, errorName, call }) => {
  test('passes the signal to fetch', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse())
    const controller = new AbortController()

    const result = await call(fetchMock, { signal: controller.signal })

    expect(result.error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal).toBe(controller.signal)
  })

  test('returns an abort error for an already-aborted signal', async () => {
    const { fetchMock } = createControllableFetch()
    const controller = new AbortController()
    controller.abort()

    const { data, error } = await call(fetchMock, { signal: controller.signal })

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(StorageUnknownError)
    expect((error as StorageUnknownError).name).toBe(errorName)
    expect((error as StorageUnknownError).originalError).toMatchObject({ name: 'AbortError' })
  })

  test('returns an abort error, not the response, when aborted mid-request', async () => {
    const { fetchMock, respond } = createControllableFetch()
    const controller = new AbortController()

    const pending = call(fetchMock, { signal: controller.signal })
    // Let the request reach fetch before aborting it.
    await new Promise((resolve) => setImmediate(resolve))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    controller.abort()
    // A late response must not turn the aborted request into a success.
    respond()
    const { data, error } = await pending

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(StorageUnknownError)
    expect((error as StorageUnknownError).originalError).toMatchObject({ name: 'AbortError' })
  })

  test('sends the same request as before when no parameters are passed', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse())

    const result = await call(fetchMock)

    expect(result.error).toBeNull()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const expectedKeys = method === 'GET' ? ['headers', 'method'] : ['body', 'headers', 'method']
    expect(Object.keys(init).sort()).toEqual(expectedKeys)
    expect(init.method).toBe(method)
  })
})
