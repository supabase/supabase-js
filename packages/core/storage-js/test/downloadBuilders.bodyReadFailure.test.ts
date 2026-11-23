import BlobDownloadBuilder from '../src/packages/BlobDownloadBuilder'
import { StorageUnknownError } from '../src/lib/common/errors'

// A Response whose headers arrived fine but whose body fails while being read
// (connection reset / caller abort mid-body).
const responseWithFailingBody = (reason: unknown) =>
  ({
    ok: true,
    status: 200,
    blob: async () => {
      throw reason
    },
  }) as unknown as Response

describe('BlobDownloadBuilder: failure while reading the body', () => {
  test('connection reset mid-body resolves { data: null, error } (same as a pre-header network failure)', async () => {
    const reset = new TypeError('terminated')
    const builder = new BlobDownloadBuilder(async () => responseWithFailingBody(reset), false)

    const result = await builder

    expect(result.data).toBeNull()
    expect(result.error).toBeInstanceOf(StorageUnknownError)
    expect((result.error as StorageUnknownError).originalError).toBe(reset)
  })

  test('caller abort mid-body resolves { data: null, error }', async () => {
    const abort = new DOMException('This operation was aborted', 'AbortError')
    const builder = new BlobDownloadBuilder(async () => responseWithFailingBody(abort), false)

    const result = await builder

    expect(result.data).toBeNull()
    expect(result.error).toBeInstanceOf(StorageUnknownError)
  })

  test('with throwOnError() the body-read failure still rejects', async () => {
    const reset = new TypeError('terminated')
    const builder = new BlobDownloadBuilder(async () => responseWithFailingBody(reset), true)

    await expect(builder).rejects.toBe(reset)
  })
})
