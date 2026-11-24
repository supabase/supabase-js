import { StorageClient } from '../src/index'
import { StorageUnknownError } from '../src/lib/common/errors'
import { FetchParameters, FileOptions } from '../src/lib/types'

type FileBody = Parameters<ReturnType<StorageClient['from']>['upload']>[1]

const okResponse = () =>
  new Response(JSON.stringify({ Id: 'object-id', Key: 'bucket/sample.bin' }), {
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

describe.each(['upload', 'update', 'signed'] as const)('%s with FetchParameters', (operation) => {
  const bytes = Buffer.from('upload payload')

  function run(
    files: ReturnType<StorageClient['from']>,
    body: FileBody,
    options?: FileOptions,
    parameters?: FetchParameters
  ) {
    if (operation === 'signed') {
      return files.uploadToSignedUrl('sample.bin', 'upload-token', body, options, parameters)
    }
    return files[operation]('sample.bin', body, options, parameters)
  }

  test('passes the signal and cache option to fetch', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse())
    const files = new StorageClient('http://localhost/storage/v1', {}, fetchMock).from('bucket')
    const controller = new AbortController()

    const result = await run(files, bytes, undefined, {
      signal: controller.signal,
      cache: 'no-store',
    })

    expect(result.error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal).toBe(controller.signal)
    expect(init.cache).toBe('no-store')
  })

  test('returns an abort error for an already-aborted signal', async () => {
    const { fetchMock } = createControllableFetch()
    const files = new StorageClient('http://localhost/storage/v1', {}, fetchMock).from('bucket')
    const controller = new AbortController()
    controller.abort()

    const { data, error } = await run(files, bytes, undefined, { signal: controller.signal })

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(StorageUnknownError)
    expect((error as StorageUnknownError).originalError).toMatchObject({ name: 'AbortError' })
  })

  test('returns an abort error, not the response, when aborted mid-request', async () => {
    const { fetchMock, respond } = createControllableFetch()
    const files = new StorageClient('http://localhost/storage/v1', {}, fetchMock).from('bucket')
    const controller = new AbortController()

    const pending = run(files, bytes, undefined, { signal: controller.signal })
    // Let the upload reach fetch before aborting it.
    await new Promise((resolve) => setImmediate(resolve))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    controller.abort()
    // A late response must not turn the aborted upload into a success.
    respond()
    const { data, error } = await pending

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(StorageUnknownError)
    expect((error as StorageUnknownError).originalError).toMatchObject({ name: 'AbortError' })
  })

  test('sends the same request as before when no parameters are passed', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse())
    const files = new StorageClient('http://localhost/storage/v1', {}, fetchMock).from('bucket')
    const options: FileOptions = { contentType: 'application/octet-stream', upsert: true }

    const result = await run(files, bytes, options)

    expect(result.error).toBeNull()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const keys = Object.keys(init).sort()
    expect(keys).toEqual(['body', 'headers', 'method'])
    expect(init.method).toBe(operation === 'upload' ? 'POST' : 'PUT')
  })
})

describe('upload with an AbortSignal against Storage', () => {
  // Supabase CLI local development defaults, as in storageFileApi.test.ts
  const URL = 'http://127.0.0.1:54321/storage/v1'
  const KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  const storage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })

  test('an aborted upload returns an error and stores nothing', async () => {
    const bucketName = `upload-signal-${Date.now()}`
    const created = await storage.createBucket(bucketName, { public: false })
    expect(created.error).toBeNull()
    const path = `aborted-${Date.now()}.txt`
    const controller = new AbortController()
    controller.abort()

    const { data, error } = await storage
      .from(bucketName)
      .upload(path, Buffer.from('should not be stored'), undefined, { signal: controller.signal })

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(StorageUnknownError)
    const exists = await storage.from(bucketName).exists(path)
    expect(exists.data).toBe(false)
  })
})
