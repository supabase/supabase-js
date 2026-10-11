import { StorageClient } from '../src/index'
import { FileOptions } from '../src/lib/types'

type FileBody = Parameters<ReturnType<StorageClient['from']>['upload']>[1]

describe.each(['upload', 'update', 'signed'] as const)(
  '%s multipart upload request',
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
      return new Request(url, init)
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
    })

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
