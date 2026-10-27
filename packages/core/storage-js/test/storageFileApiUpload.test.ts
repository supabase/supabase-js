import { StorageClient } from '../src/index'
import { FileOptions } from '../src/lib/types'
import { gzipSync, gunzipSync } from 'node:zlib'
import { Readable } from 'node:stream'

type FileBody = Parameters<ReturnType<StorageClient['from']>['upload']>[1]

describe.each(['upload', 'update', 'signed'] as const)(
  '%s raw and multipart upload request',
  (operation) => {
    const bytes = Buffer.from('upload payload')
    let fetchMock: jest.MockedFunction<typeof fetch>
    let files: ReturnType<StorageClient['from']>

    beforeEach(() => {
      fetchMock = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ Id: 'object-id', Key: 'bucket/sample.bin' }), {
          headers: { 'content-type': 'application/json' },
        })
      )
      files = new StorageClient('http://localhost/storage/v1', {}, fetchMock).from('bucket')
    })

    async function upload(body: FileBody, options?: FileOptions) {
      const result =
        operation === 'signed'
          ? await files.uploadToSignedUrl('sample.bin', 'upload-token', body, options)
          : await files[operation]('sample.bin', body, options)
      expect(result.error).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      const request = new Request(url, init)
      expect(request.method).toBe(operation === 'upload' ? 'POST' : 'PUT')
      return request
    }

    async function expectMultipart(request: Request, fields: Record<string, string>) {
      const wire = Buffer.from(await request.arrayBuffer())
      const text = wire.toString('latin1')
      const filePosition = text.indexOf('filename=')
      expect(filePosition).toBeGreaterThan(0)
      for (const name of Object.keys(fields)) {
        const position = text.indexOf(`name="${name}"`)
        expect(position).toBeGreaterThanOrEqual(0)
        expect(position).toBeLessThan(filePosition)
      }
      const parsed = await new Response(wire, { headers: request.headers }).formData()
      for (const [name, value] of Object.entries(fields)) {
        expect(parsed.getAll(name)).toEqual([value])
      }
      return parsed
    }

    describe('raw bodies', () => {
      const bodies: [string, (bytes: Buffer) => FileBody][] = [
        ['Buffer', (bytes) => bytes],
        ['Uint8Array', (bytes) => new Uint8Array(bytes)],
        ['ArrayBuffer', (bytes) => new Uint8Array(bytes).buffer],
        ['DataView', (bytes) => new DataView(new Uint8Array(bytes).buffer)],
        ['Node stream', (bytes) => Readable.from([bytes])],
        [
          'Web stream',
          (bytes) =>
            new ReadableStream({
              start(controller) {
                controller.enqueue(bytes)
                controller.close()
              },
            }),
        ],
      ]

      test('uses defaults when file options are explicitly undefined', async () => {
        const request = await upload(bytes, {
          cacheControl: undefined,
          contentType: undefined,
          upsert: undefined,
        })

        expect(request.headers.get('cache-control')).toBe('max-age=3600')
        expect(request.headers.get('content-type')).toBe('text/plain;charset=UTF-8')
        expect(request.headers.get('x-upsert')).toBe(operation === 'update' ? null : 'false')
      })

      test.each(bodies)('preserves gzip bytes from %s', async (_, body) => {
        const compressedBytes = gzipSync(bytes)
        const request = await upload(body(compressedBytes), {
          contentType: 'text/plain',
          contentEncoding: 'gzip',
        })

        expect(request.headers.get('content-type')).toBe('text/plain')
        expect(request.headers.get('content-encoding')).toBe('gzip')
        const actualBytes = Buffer.from(await request.arrayBuffer())
        expect(actualBytes).toEqual(compressedBytes)
        expect(gunzipSync(actualBytes)).toEqual(bytes)
      })

      test.each([undefined, ''])('omits content encoding for %j', async (contentEncoding) => {
        const request = await upload(
          bytes,
          contentEncoding === undefined ? {} : { contentEncoding }
        )

        expect(request.headers.get('content-encoding')).toBeNull()
        expect(Buffer.from(await request.arrayBuffer())).toEqual(bytes)
      })

      test('contentEncoding overrides the client default header', async () => {
        files = new StorageClient(
          'http://localhost/storage/v1',
          { 'Content-Encoding': 'br' },
          fetchMock
        ).from('bucket')
        const compressedBytes = gzipSync(bytes)
        const request = await upload(compressedBytes, { contentEncoding: 'gzip' })

        expect(request.headers.get('content-encoding')).toBe('gzip')
        expect(Buffer.from(await request.arrayBuffer())).toEqual(compressedBytes)
      })

      test('explicit headers override contentEncoding case-insensitively', async () => {
        const compressedBytes = gzipSync(bytes)
        const request = await upload(compressedBytes, {
          contentEncoding: 'br',
          headers: { 'Content-Encoding': 'gzip' },
        })

        expect(request.headers.get('content-encoding')).toBe('gzip')
        expect(Buffer.from(await request.arrayBuffer())).toEqual(compressedBytes)
      })
    })

    test('sends Blob metadata before the file', async () => {
      const request = await upload(new Blob([bytes], { type: 'application/octet-stream' }), {
        cacheControl: '7200',
        metadata: { source: 'blob' },
      })
      const body = await expectMultipart(request, {
        cacheControl: '7200',
        metadata: '{"source":"blob"}',
      })
      const file = body.get('') as File
      expect(file.type).toBe('application/octet-stream')
      expect(Buffer.from(await file.arrayBuffer())).toEqual(bytes)
      expect(body.has('contentEncoding')).toBe(false)
    })

    test('uses default cacheControl for multipart bodies when undefined', async () => {
      const request = await upload(new Blob([bytes]), { cacheControl: undefined })
      await expectMultipart(request, { cacheControl: '3600' })
    })

    test.each(['Blob', 'File', 'FormData'] as const)(
      'sends %s content encoding before the file and preserves compressed bytes',
      async (kind) => {
        const compressedBytes = gzipSync(bytes)
        const blob = new Blob([compressedBytes], { type: 'text/plain' })
        let payload: FileBody = blob
        if (kind === 'File') {
          payload = new File([compressedBytes], 'sample.txt.gz', { type: 'text/plain' })
        } else if (kind === 'FormData') {
          payload = new FormData()
          payload.append('file', blob, 'sample.txt.gz')
        }

        const request = await upload(payload, { contentEncoding: 'gzip' })
        // Only the file is encoded, not the multipart envelope.
        expect(request.headers.get('content-encoding')).toBeNull()
        const body = await expectMultipart(request, { contentEncoding: 'gzip' })
        const file = body.get(kind === 'FormData' ? 'file' : '') as File
        const actualBytes = Buffer.from(await file.arrayBuffer())
        expect(actualBytes).toEqual(compressedBytes)
        expect(gunzipSync(actualBytes)).toEqual(bytes)
      }
    )

    test.each(['gzip', ''])(
      'preserves caller contentEncoding %j over options even when it follows the file',
      async (contentEncoding) => {
        const form = new FormData()
        form.append('file', new Blob([contentEncoding ? gzipSync(bytes) : bytes]), 'original.bin')
        form.append('contentEncoding', contentEncoding)

        const request = await upload(form, { contentEncoding: 'br' })
        await expectMultipart(request, { contentEncoding })
        const fieldNames: string[] = []
        form.forEach((_, name) => fieldNames.push(name))
        expect(fieldNames).toEqual(['file', 'contentEncoding'])
        expect(form.getAll('contentEncoding')).toEqual([contentEncoding])
      }
    )

    test('places caller fields and missing options before files without mutating FormData', async () => {
      const form = new FormData()
      form.append('file', new Blob([bytes]), 'original.bin')
      form.append('contentType', 'text/plain')
      form.append('tag', 'first')
      form.append('tag', 'second')
      // A field and a file may share a name; neither should be lost when reordered.
      form.append('file', 'text field')
      const original: [string, FormDataEntryValue][] = []
      form.forEach((value, name) => original.push([name, value]))

      const request = await upload(form, {
        metadata: { source: 'form' },
      })
      const body = await expectMultipart(request, {
        cacheControl: '3600',
        contentType: 'text/plain',
        metadata: '{"source":"form"}',
      })
      expect(body.getAll('tag')).toEqual(['first', 'second'])
      const [text, file] = body.getAll('file') as [string, File]
      expect(text).toBe('text field')
      expect(file.name).toBe('original.bin')
      expect(Buffer.from(await file.arrayBuffer())).toEqual(bytes)
      const remaining: [string, FormDataEntryValue][] = []
      form.forEach((value, name) => remaining.push([name, value]))
      expect(remaining).toEqual(original)
    })

    test('preserves caller metadata over options even when it follows the file', async () => {
      const form = new FormData()
      form.append('file', new Blob([bytes]), 'original.bin')
      form.append('cacheControl', '7200')
      form.append('metadata', '{"source":"caller"}')

      const request = await upload(form, {
        cacheControl: '3600',
        metadata: { source: 'options' },
      })
      await expectMultipart(request, {
        cacheControl: '7200',
        metadata: '{"source":"caller"}',
      })
    })
  }
)
