import { StorageClient } from '../src/index'
import type { FileOptions } from '../src/lib/types'

describe('Upload options set to undefined', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>
  let files: ReturnType<StorageClient['from']>

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ Id: 'id', Key: 'bucket/a.bin' }), {
        headers: { 'content-type': 'application/json' },
      })
    )
    files = new StorageClient('http://localhost/storage/v1', {}, fetchMock).from('bucket')
  })

  function request() {
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    return new Request(url, init)
  }

  // Callers without `exactOptionalPropertyTypes` can pass keys set to undefined, e.g. when
  // forwarding options from a wrapper. This test config enables it, hence the casts.
  const undefinedOptions = {
    cacheControl: undefined,
    contentType: undefined,
    upsert: undefined,
  } as unknown as FileOptions

  test.each(['upload', 'update'] as const)(
    '%s falls back to the default headers',
    async (operation) => {
      const result = await files[operation]('a.bin', new Uint8Array([1, 2]), undefinedOptions)
      expect(result.error).toBeNull()

      const sent = request()
      expect(sent.headers.get('cache-control')).toBe('max-age=3600')
      expect(sent.headers.get('content-type')).toBe('text/plain;charset=UTF-8')
      if (operation === 'upload') {
        expect(sent.headers.get('x-upsert')).toBe('false')
      }
    }
  )

  test('uploadToSignedUrl falls back to the default headers', async () => {
    const result = await files.uploadToSignedUrl(
      'a.bin',
      'token',
      new Uint8Array([1, 2]),
      undefinedOptions
    )
    expect(result.error).toBeNull()

    const sent = request()
    expect(sent.headers.get('cache-control')).toBe('max-age=3600')
    expect(sent.headers.get('content-type')).toBe('text/plain;charset=UTF-8')
    expect(sent.headers.get('x-upsert')).toBe('false')
  })

  test('the multipart cacheControl field falls back to the default', async () => {
    const result = await files.upload('a.txt', new Blob(['x']), {
      cacheControl: undefined,
    } as unknown as FileOptions)
    expect(result.error).toBeNull()

    const form = await request().formData()
    expect(form.get('cacheControl')).toBe('3600')
  })

  test('explicit values still override the defaults', async () => {
    await files.upload('a.bin', new Uint8Array([1]), {
      cacheControl: '60',
      contentType: 'application/octet-stream',
      upsert: true,
    })

    const sent = request()
    expect(sent.headers.get('cache-control')).toBe('max-age=60')
    expect(sent.headers.get('content-type')).toBe('application/octet-stream')
    expect(sent.headers.get('x-upsert')).toBe('true')
  })
})
