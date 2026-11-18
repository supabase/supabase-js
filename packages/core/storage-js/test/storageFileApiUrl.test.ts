import StorageFileApi from '../src/packages/StorageFileApi'
import { StorageError } from '../src/lib/common/errors'

const base = 'https://example.invalid/proxy/storage/v1'
const headers = { Authorization: 'Bearer fake-service-role', apikey: 'fake-service-role' }

const outOfBucketPaths = [
  '../other/file',
  '../uploads-other/file',
  '../../../../rest/v1/rpc/example',
  '%2e%2e/%2e%2e/%2e%2e/%2e%2e/rest/v1/rpc/example',
  '%2E%2e/other/file',
  '.%2e/other/file',
  '%2e./other/file',
  '..\\other\\file',
  '.\t./other/file',
  '.\n./other/file',
  '.\r./other/file',
  'folder/../../other/file',
  '..',
  '../uploads',
]

type RequestScenario = {
  name: string
  run: (files: StorageFileApi, path: string) => PromiseLike<unknown>
  route: string
  cleanUploadPath?: boolean
  queryString?: string
  uploadToken?: string
}

const operations: RequestScenario[] = [
  {
    name: 'upload',
    route: 'object',
    cleanUploadPath: true,
    run: (files, path) =>
      files.upload(path, Buffer.from('{}'), { contentType: 'application/json' }),
  },
  {
    name: 'update',
    route: 'object',
    cleanUploadPath: true,
    run: (files, path) => files.update(path, Buffer.from('{}')),
  },
  {
    name: 'signed upload',
    route: 'object/upload/sign',
    cleanUploadPath: true,
    uploadToken: 'token',
    run: (files, path) => files.uploadToSignedUrl(path, 'token', Buffer.from('{}')),
  },
  {
    name: 'sign upload',
    route: 'object/upload/sign',
    run: (files, path) => files.createSignedUploadUrl(path),
  },
  {
    name: 'sign download',
    route: 'object/sign',
    run: (files, path) => files.createSignedUrl(path, 60),
  },
  { name: 'download', route: 'object', run: (files, path) => files.download(path) },
  {
    name: 'stream download',
    route: 'object',
    run: (files, path) => files.download(path).asStream(),
  },
  {
    name: 'transformed download',
    route: 'render/image/authenticated',
    queryString: 'width=100',
    run: (files, path) => files.download(path, { transform: { width: 100 } }),
  },
  { name: 'info', route: 'object/info', run: (files, path) => files.info(path) },
  {
    name: 'versioned info',
    route: 'object/info',
    queryString: 'versionId=a+%26+b',
    run: (files, path) => files.info(path, { versionId: 'a & b' }),
  },
]

let fetchMock: jest.MockedFunction<typeof fetch>
let files: StorageFileApi
beforeEach(() => {
  fetchMock = jest.fn().mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          Id: 'id',
          Key: 'uploads/folder/file',
          message: 'success',
          url: '/object/upload/sign/uploads/file?token=test-token',
          signedURL: '/object/sign/uploads/file?token=test-token',
        })
      )
  )
  files = new StorageFileApi(base, headers, 'uploads', fetchMock)
})

describe.each(operations)('$name URL validation', ({ run }) => {
  test.each(outOfBucketPaths)('rejects %s before fetch', async (path) => {
    const result = await run(files, path)
    expect(result).toEqual({ data: null, error: expect.any(StorageError) })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('honors throwOnError', async () => {
    await expect(
      Promise.resolve(run(files.throwOnError(), '../other/file'))
    ).rejects.toBeInstanceOf(StorageError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

test('exists propagates URL validation errors without fetching', async () => {
  await expect(files.exists('../other/file')).rejects.toBeInstanceOf(StorageError)
  expect(fetchMock).not.toHaveBeenCalled()
})

test.each(['../other/file', '..', 'folder/../../other/file'])(
  'CDN purge rejects %s',
  async (path) => {
    expect((await files.purgeCache(path)).error).toBeInstanceOf(StorageError)
    expect(fetchMock).not.toHaveBeenCalled()
  }
)

test.each([
  'folder/file.txt',
  'folder/../file.txt',
  'space name/日本語.txt',
  '.hidden/file',
  'a..b/file',
])('valid upload %s sends the validated URL and preserves credentials and body', async (path) => {
  const result = await files.upload(path, Buffer.from('{"ok":true}'), {
    contentType: 'application/json',
  })
  expect(result.error).toBeNull()
  const [url, init] = fetchMock.mock.calls[0]
  const request = new Request(url, init)
  expect(url).toBe(request.url)
  expect(request.url).toBe(new URL(`${base}/object/uploads/${path}`).href)
  expect(request.headers.get('authorization')).toBe(headers.Authorization)
  expect(request.headers.get('apikey')).toBe(headers.apikey)
  expect(request.headers.get('content-type')).toBe('application/json')
  expect(await request.text()).toBe('{"ok":true}')
})

const safeInputs = [
  ['uploads', 'folder/photo.jpg'],
  ['my%20bucket', 'folder/photo.jpg'],
  ['my bucket', 'space name/日本語.jpg'],
  ['uploads', 'folder/../photo.jpg'],
  ['uploads', 'folder/%2e%2e/photo.jpg'],
  ['uploads', '/folder//photo.jpg'],
  ['uploads', 'folder/a%20b.jpg'],
  ['uploads', 'folder/file '],
  ['uploads', 'folder/a%252Fb.jpg'],
  ['uploads', 'folder/name?download=1'],
  ['uploads', 'folder/name#fragment'],
]

describe.each(operations)(
  '$name compatibility',
  ({ run, route, cleanUploadPath, queryString, uploadToken }) => {
    test.each(safeInputs)(
      'preserves the destination for bucket %s and key %s',
      async (bucket, path) => {
        const result = await run(new StorageFileApi(base, headers, bucket, fetchMock), path)
        expect(result).toMatchObject({ error: null })
        expect(fetchMock).toHaveBeenCalledTimes(1)

        // Match the old URL construction independently of the production helper.
        const cleanPath = cleanUploadPath ? path.replace(/^\/|\/$/g, '').replace(/\/+/g, '/') : path
        // Query text was appended before parsing, even for keys containing '?' or '#'.
        const expected = new URL(
          `${base}/${route}/${bucket}/${cleanPath.replace(/^\/+/, '')}${queryString ? `?${queryString}` : ''}`
        )
        if (uploadToken) expected.searchParams.set('token', uploadToken)
        expect(new Request(...fetchMock.mock.calls[0]).url).toBe(expected.href)
      }
    )
  }
)

test.each(safeInputs)(
  'CDN purge preserves its existing encoding for %s / %s',
  async (bucket, path) => {
    const result = await new StorageFileApi(base, headers, bucket, fetchMock).purgeCache(path)
    expect(result.error).toBeNull()
    const oldPath = `${bucket}/${path.replace(/^\/+/, '')}`
      .split('/')
      .map(encodeURIComponent)
      .join('/')
    expect(fetchMock.mock.calls[0][0]).toBe(new URL(`${base}/cdn/${oldPath}`).href)
  }
)

test.each(['folder/../file', '../other/file', 'space name/日本語.jpg', 'a%20b.jpg'])(
  'public URL generation preserves the exact string for %s',
  (path) => {
    for (const transform of [false, true]) {
      const result = new StorageFileApi(base, headers, 'my%20bucket', fetchMock).getPublicUrl(
        path,
        transform ? { transform: { width: 100 } } : {}
      )
      const route = transform ? 'render/image/public' : 'object/public'
      expect(result.data.publicUrl).toBe(
        encodeURI(`${base}/${route}/my%20bucket/${path}`) + (transform ? '?width=100' : '')
      )
    }
    expect(fetchMock).not.toHaveBeenCalled()
  }
)

describe('CDN purge with transformations', () => {
  test('preserves encoded keys and forwards the query parameter', async () => {
    const result = await new StorageFileApi(base, headers, 'my%20bucket', fetchMock).purgeCache(
      'folder/file ?#',
      { transformations: true }
    )
    expect(result.error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${base}/cdn/my%2520bucket/folder/file%20%3F%23?transformations=true`
    )
  })

  test('validates the bucket URL when transformations are requested', async () => {
    const result = await files.purgeCache('../other/file', { transformations: true })
    expect(result).toEqual({ data: null, error: expect.any(StorageError) })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
