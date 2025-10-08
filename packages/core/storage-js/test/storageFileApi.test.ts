import { SortByV2, StorageClient } from '../src/index'
import * as fsp from 'fs/promises'
import * as fs from 'fs'
import * as path from 'path'
import assert from 'assert'
import ReadableStream from 'node:stream'
// @ts-ignore
import fetch, { Response } from '@supabase/node-fetch'
import { StorageApiError, StorageError } from '../src/lib/errors'
import BlobDownloadBuilder from '../src/packages/BlobDownloadBuilder'
import StreamDownloadBuilder from '../src/packages/StreamDownloadBuilder'

// TODO: need to setup storage-api server for this test
const URL = 'http://localhost:8000/storage/v1'
const KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCIsInN1YiI6IjMxN2VhZGNlLTYzMWEtNDQyOS1hMGJiLWYxOWE3YTUxN2I0YSIsImlhdCI6MTcxMzQzMzgwMCwiZXhwIjoyMDI5MDA5ODAwfQ.jVFIR-MB7rNfUuJaUH-_CyDFZEHezzXiqcRcdrGd29o'

const storage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })

const newBucket = async (isPublic = true, prefix = '') => {
  const bucketName = `${prefix ? prefix + '-' : ''}bucket-${Date.now()}`
  await storage.createBucket(bucketName, { public: isPublic })
  return bucketName
}

const findOrCreateBucket = async (name: string, isPublic = true) => {
  const { error: bucketNotFound } = await storage.getBucket(name)

  if (bucketNotFound) {
    const { error } = await storage.createBucket(name, { public: isPublic })
    expect(error).toBeNull()
  }

  return name
}

const uploadFilePath = (fileName: string) => path.resolve(__dirname, 'fixtures', 'upload', fileName)

describe('Object API', () => {
  let bucketName: string
  let file: Buffer
  let uploadPath: string
  beforeEach(async () => {
    bucketName = await newBucket()
    file = await fsp.readFile(uploadFilePath('sadcat.jpg'))
    uploadPath = `testpath/file-${Date.now()}.jpg`
  })

  describe('Generate urls', () => {
    test('get public URL', async () => {
      const res = storage.from(bucketName).getPublicUrl(uploadPath)
      expect(res.data.publicUrl).toEqual(`${URL}/object/public/${bucketName}/${uploadPath}`)
    })

    test('get public URL with download querystring', async () => {
      const res = storage.from(bucketName).getPublicUrl(uploadPath, {
        download: true,
      })
      expect(res.data.publicUrl).toEqual(
        `${URL}/object/public/${bucketName}/${uploadPath}?download=`
      )
    })

    test('get public URL with custom for download', async () => {
      const res = storage.from(bucketName).getPublicUrl(uploadPath, {
        download: 'test.jpg',
      })
      expect(res.data.publicUrl).toEqual(
        `${URL}/object/public/${bucketName}/${uploadPath}?download=test.jpg`
      )
    })

    test('upload files error handling', async () => {
      const { data, error } = await storage.from('non-existent-bucket').upload(uploadPath, file)

      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Bucket not found')

      // throws when .throwOnError is enabled
      await expect(
        storage.from('non-existent-bucket').throwOnError().upload(uploadPath, file)
      ).rejects.toThrow('Bucket not found')
    })

    test('sign url', async () => {
      const uploadRes = await storage.from(bucketName).upload(uploadPath, file)
      expect(uploadRes.error).toBeNull()

      const res = await storage.from(bucketName).createSignedUrl(uploadPath, 2000)

      expect(res.error).toBeNull()
      expect(res.data?.signedUrl).toContain(`${URL}/object/sign/${bucketName}/${uploadPath}`)

      // throws when .throwOnError is enabled
      await expect(
        storage.from(bucketName).throwOnError().createSignedUrl('non-existent-path', 2000)
      ).rejects.toThrow()
    })

    test('sign url with download querystring parameter', async () => {
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).createSignedUrl(uploadPath, 2000, {
        download: true,
      })

      expect(res.error).toBeNull()
      expect(res.data?.signedUrl).toContain(`${URL}/object/sign/${bucketName}/${uploadPath}`)
      expect(res.data?.signedUrl).toContain(`&download=`)
    })

    test('sign url with transform options', async () => {
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).createSignedUrl(uploadPath, 2000, {
        download: true,
        transform: {
          width: 100,
          height: 100,
        },
      })

      expect(res.error).toBeNull()
      expect(res.data?.signedUrl).toContain(`${URL}/render/image/sign/${bucketName}/${uploadPath}`)
    })

    test('sign url with custom filename for download', async () => {
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).createSignedUrl(uploadPath, 2000, {
        download: 'test.jpg',
      })

      expect(res.error).toBeNull()
      expect(res.data?.signedUrl).toContain(`${URL}/object/sign/${bucketName}/${uploadPath}`)
      expect(res.data?.signedUrl).toContain(`&download=test.jpg`)
    })
  })

  describe('Upload files', () => {
    test('uploading using form-data', async () => {
      const bucketName = await newBucket()
      const formData = new FormData()
      formData.append('file', file as any)

      const res = await storage.from(bucketName).upload(uploadPath, formData)
      expect(res.error).toBeNull()
      expect(res.data?.path).toEqual(uploadPath)
    })

    test('uploading using buffer', async () => {
      const res = await storage.from(bucketName).upload(uploadPath, file)
      expect(res.error).toBeNull()
      expect(res.data?.path).toEqual(uploadPath)
    })

    test('uploading using array buffer', async () => {
      const res = await storage.from(bucketName).upload(uploadPath, file.buffer)
      expect(res.error).toBeNull()
      expect(res.data?.path).toEqual(uploadPath)
    })

    test('uploading using blob', async () => {
      const fileBlob = new Blob([file])
      const res = await storage.from(bucketName).upload(uploadPath, fileBlob)
      expect(res.error).toBeNull()
      expect(res.data?.path).toEqual(uploadPath)
    })

    test('uploading using readable stream', async () => {
      const file = await fs.createReadStream(uploadFilePath('file.txt'))

      const res = await storage.from(bucketName).upload(uploadPath, file)
      expect(res.error).toBeNull()
      expect(res.data?.path).toEqual(uploadPath)
    })

    test('upload and update file', async () => {
      const file2 = await fsp.readFile(uploadFilePath('file-2.txt'))

      const res = await storage.from(bucketName).upload(uploadPath, file)
      expect(res.error).toBeNull()

      const updateRes = await storage.from(bucketName).update(uploadPath, file2)
      expect(updateRes.error).toBeNull()
      expect(updateRes.data?.path).toEqual(uploadPath)
    })

    test('can upload with custom metadata', async () => {
      const res = await storage.from(bucketName).upload(uploadPath, file, {
        metadata: {
          custom: 'metadata',
          second: 'second',
          third: 'third',
        },
      })
      expect(res.error).toBeNull()

      const updateRes = await storage.from(bucketName).info(uploadPath)
      expect(updateRes.error).toBeNull()
      expect(updateRes.data?.metadata).toEqual({
        custom: 'metadata',
        second: 'second',
        third: 'third',
      })
    })

    test('can upload a file within the file size limit', async () => {
      const bucketName = 'with-limit' + Date.now()
      await storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: '1mb',
      })

      const res = await storage.from(bucketName).upload(uploadPath, file)
      expect(res.error).toBeNull()
    })

    test('cannot upload a file that exceed the file size limit', async () => {
      const bucketName = 'with-limit' + Date.now()
      await storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: '1kb',
      })

      const res = await storage.from(bucketName).upload(uploadPath, file)

      const outError = res.error as StorageApiError
      expect(outError).toBeInstanceOf(StorageApiError)
      expect(outError.message).toBe('The object exceeded the maximum allowed size')
      expect(outError.statusCode).toBe('413')
    })

    test('can upload a file with a valid mime type', async () => {
      const bucketName = 'with-limit' + Date.now()
      await storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/png'],
      })

      const res = await storage.from(bucketName).upload(uploadPath, file, {
        contentType: 'image/png',
      })
      expect(res.error).toBeNull()
    })

    test('cannot upload a file an invalid mime type', async () => {
      const bucketName = 'with-limit' + Date.now()
      await storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/png'],
      })

      const res = await storage.from(bucketName).upload(uploadPath, file, {
        contentType: 'image/jpeg',
      })
      const outError = res.error as StorageApiError
      expect(outError).toBeInstanceOf(StorageApiError)
      expect(outError.message).toBe('mime type image/jpeg is not supported')
      expect(outError.statusCode).toBe('415')
    })

    test('sign url for upload', async () => {
      const res = await storage.from(bucketName).createSignedUploadUrl(uploadPath)

      expect(res.error).toBeNull()
      expect(res.data?.path).toBe(uploadPath)
      expect(res.data?.token).toBeDefined()
      expect(res.data?.signedUrl).toContain(`${URL}/object/upload/sign/${bucketName}/${uploadPath}`)
    })

    test('can upload with a signed url', async () => {
      const { data, error } = await storage.from(bucketName).createSignedUploadUrl(uploadPath)

      expect(error).toBeNull()
      assert(data?.path)

      const uploadRes = await storage
        .from(bucketName)
        .uploadToSignedUrl(data.path, data.token, file)

      expect(uploadRes.error).toBeNull()
      expect(uploadRes.data?.path).toEqual(uploadPath)
    })

    test('can upload overwriting files with a signed url', async () => {
      const { error: uploadErr } = await storage.from(bucketName).upload(uploadPath, file)

      expect(uploadErr).toBeNull()

      const { data, error } = await storage.from(bucketName).createSignedUploadUrl(uploadPath, {
        upsert: true,
      })

      expect(error).toBeNull()
      assert(data?.path)

      const uploadRes = await storage
        .from(bucketName)
        .uploadToSignedUrl(data.path, data.token, file)

      expect(uploadRes.error).toBeNull()
      expect(uploadRes.data?.path).toEqual(uploadPath)
    })

    test('cannot upload to a signed url twice', async () => {
      const { data, error } = await storage.from(bucketName).createSignedUploadUrl(uploadPath)

      expect(error).toBeNull()
      assert(data?.path)

      const uploadRes = await storage
        .from(bucketName)
        .uploadToSignedUrl(data.path, data.token, file)

      expect(uploadRes.error).toBeNull()
      expect(uploadRes.data?.path).toEqual(uploadPath)

      const uploadRes2 = await storage
        .from(bucketName)
        .uploadToSignedUrl(data.path, data.token, file)

      const outError = uploadRes2.error as StorageApiError
      expect(outError).toBeInstanceOf(StorageApiError)
      expect(outError.message).toBe('The resource already exists')
      expect(outError.statusCode).toBe('409')

      await expect(
        storage.from(bucketName).throwOnError().uploadToSignedUrl(data.path, data.token, file)
      ).rejects.toThrow()
    })
  })

  describe('File operations', () => {
    test('list objects', async () => {
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).list('testpath')
      expect(res.error).toBeNull()
      expect(res.data).toEqual([
        expect.objectContaining({
          name: uploadPath.replace('testpath/', ''),
        }),
      ])
    })

    test('list objects V2', async () => {
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).listV2({
        prefix: 'testpath',
      })

      expect(res.error).toBeNull()
      expect(res.data).toEqual(
        expect.objectContaining({
          hasNext: false,
          folders: [],
          objects: expect.arrayContaining([expect.objectContaining({ name: uploadPath })]),
        })
      )
    })

    test('list objects V2 - folders', async () => {
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).listV2({ with_delimiter: true })

      expect(res.error).toBeNull()
      expect(res.data).toEqual(
        expect.objectContaining({
          hasNext: false,
          folders: expect.arrayContaining([
            expect.objectContaining({ key: 'testpath', name: 'testpath/' }),
          ]),
          objects: [],
        })
      )
    })

    test('list objects V2 - paginated', async () => {
      const fileSuffixes = ['zz', 'bb', 'xx', 'ww', 'cc', 'aa', 'yy', 'oo']
      for (const suffix of fileSuffixes) {
        await storage.from(bucketName).upload(uploadPath + suffix, file)
      }

      const testCases: { expectedSuffixes: string[]; sortBy?: SortByV2 }[] = [
        {
          expectedSuffixes: fileSuffixes.slice().sort(),
          // default sortBy = name asc
        },
        {
          expectedSuffixes: fileSuffixes.slice().sort().reverse(),
          sortBy: { column: 'name', order: 'desc' },
        },
        {
          expectedSuffixes: fileSuffixes.slice(),
          sortBy: { column: 'created_at', order: 'asc' },
        },
        {
          expectedSuffixes: fileSuffixes.slice().reverse(),
          sortBy: { column: 'created_at', order: 'desc' },
        },
      ]

      for (const { expectedSuffixes, sortBy } of testCases) {
        let cursor: string | undefined
        let hasNext = true
        let pages = 0
        while (hasNext) {
          const res = await storage.from(bucketName).listV2({
            prefix: 'testpath/',
            with_delimiter: true,
            limit: 2,
            cursor,
            sortBy,
          })

          expect(res.error).toBeNull()
          expect(res.data?.objects).toHaveLength(2)
          expect(res.data?.objects).toEqual(
            expectedSuffixes
              .splice(0, 2)
              .map((v) => expect.objectContaining({ name: uploadPath + v }))
          )

          hasNext = res.data?.hasNext || false
          cursor = res.data?.nextCursor
          pages++
        }
        expect(pages).toBe(4)
      }
    })

    test('move object to different path', async () => {
      const newPath = `testpath/file-moved-${Date.now()}.txt`
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).move(uploadPath, newPath)

      expect(res.error).toBeNull()
      expect(res.data?.message).toEqual(`Successfully moved`)

      // throws when .throwOnError is enabled
      await expect(
        storage.from(bucketName).throwOnError().move('non-existent', '')
      ).rejects.toThrow()
    })

    test('move object across buckets in different path', async () => {
      const newBucketName = 'bucket-move'

      const newPath = `testpath/file-to-move-${Date.now()}.txt`
      const upload = await storage.from(bucketName).upload(uploadPath, file)

      const res = await storage.from(bucketName).move(uploadPath, newPath, {
        destinationBucket: newBucketName,
      })

      expect(res.error).toBeNull()
      expect(res.data?.message).toEqual(`Successfully moved`)

      const { error } = await storage.from(newBucketName).download(newPath)
      expect(error).toBeNull()
    })

    test('copy object to different path', async () => {
      const newPath = `testpath/file-copied-${Date.now()}.txt`
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).copy(uploadPath, newPath)

      expect(res.error).toBeNull()
      expect(res.data?.path).toEqual(`${bucketName}/${newPath}`)
    })

    test('copy object across buckets to different path', async () => {
      const newBucketName = 'bucket-move'
      const newPath = `testpath/file-copied-${Date.now()}.txt`
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).copy(uploadPath, newPath, {
        destinationBucket: newBucketName,
      })

      expect(res.error).toBeNull()
      expect(res.data?.path).toEqual(`${newBucketName}/${newPath}`)
    })

    test('downloads an object', async () => {
      await storage.from(bucketName).upload(uploadPath, file)

      const blobBuilder = storage.from(bucketName).download(uploadPath)
      expect(blobBuilder).toBeInstanceOf(BlobDownloadBuilder)

      const blobResponse = await blobBuilder
      expect(blobResponse.error).toBeNull()
      expect(blobResponse.data?.size).toBeGreaterThan(0)
      expect(blobResponse.data?.type).toEqual('text/plain;charset=utf-8')

      // throws when .throwOnError is enabled
      await expect(
        storage.from(bucketName).throwOnError().download('non-existent-file')
      ).rejects.toThrow()
    })

    test('downloads an object as a stream', async () => {
      await storage.from(bucketName).upload(uploadPath, file)

      const streamBuilder = storage.from(bucketName).download(uploadPath).asStream()
      expect(streamBuilder).toBeInstanceOf(StreamDownloadBuilder)

      const streamResponse = await streamBuilder
      expect(streamResponse.error).toBeNull()
      expect(streamResponse.data).toBeInstanceOf(ReadableStream)

      // throws when .throwOnError is enabled
      await expect(
        storage.from(bucketName).throwOnError().download('non-existent-file').asStream()
      ).rejects.toThrow()
    })

    test('removes an object', async () => {
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).remove([uploadPath])

      expect(res.error).toBeNull()
      expect(res.data).toEqual([
        expect.objectContaining({
          bucket_id: bucketName,
          name: uploadPath,
        }),
      ])
    })

    test('get object info', async () => {
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).info(uploadPath)

      expect(res.error).toBeNull()
      expect(res.data).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          createdAt: expect.any(String),
          cacheControl: expect.any(String),
          size: expect.any(Number),
          etag: expect.any(String),
          lastModified: expect.any(String),
          contentType: expect.any(String),
          metadata: {},
          version: expect.any(String),
        })
      )

      // throws when .throwOnError is enabled
      await expect(storage.from(bucketName).throwOnError().info('non-existent')).rejects.toThrow()
    })

    test('check if object exists', async () => {
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).exists(uploadPath)

      expect(res.error).toBeNull()
      expect(res.data).toEqual(true)

      const resNotExists = await storage.from(bucketName).exists('do-not-exists')
      expect(resNotExists.data).toEqual(false)

      // should throw when .throwOnError is enabled
      await expect(
        storage.from(bucketName).throwOnError().exists('do-not-exists')
      ).rejects.toThrowError()
    })
  })

  describe('Transformations', () => {
    it('gets public url with transformation options', () => {
      const res = storage.from(bucketName).getPublicUrl(uploadPath, {
        transform: {
          width: 200,
          height: 300,
          quality: 70,
        },
      })
      expect(res.data.publicUrl).toEqual(
        `${URL}/render/image/public/${bucketName}/${uploadPath}?width=200&height=300&quality=70`
      )
    })

    it('will download an authenticated transformed file', async () => {
      const privateBucketName = 'my-private-bucket'
      await findOrCreateBucket(privateBucketName)

      const { error: uploadError } = await storage.from(privateBucketName).upload(uploadPath, file)
      expect(uploadError).toBeNull()

      const res = await storage.from(privateBucketName).download(uploadPath, {
        transform: {
          width: 200,
          height: 200,
        },
      })

      expect(res.error).toBeNull()
      expect(res.data?.size).toBeGreaterThan(0)
      expect(res.data?.type).toEqual('image/jpeg')
    })
  })

  it.skip('will return the image as webp when the browser support it', async () => {
    const storage = new StorageClient(URL, { Authorization: `Bearer ${KEY}`, Accept: 'image/webp' })
    const privateBucketName = 'my-private-bucket'
    await findOrCreateBucket(privateBucketName)

    const { error: uploadError } = await storage.from(privateBucketName).upload(uploadPath, file)
    expect(uploadError).toBeNull()

    const res = await storage.from(privateBucketName).download(uploadPath, {
      transform: {
        width: 200,
        height: 200,
      },
    })

    expect(res.error).toBeNull()
    expect(res.data?.size).toBeGreaterThan(0)
    expect(res.data?.type).toEqual('image/webp')
  })

  it.skip('will return the original image format when format is origin', async () => {
    const storage = new StorageClient(URL, { Authorization: `Bearer ${KEY}`, Accept: 'image/webp' })
    const privateBucketName = 'my-private-bucket'
    await findOrCreateBucket(privateBucketName)

    const { error: uploadError } = await storage.from(privateBucketName).upload(uploadPath, file)
    expect(uploadError).toBeNull()

    const res = await storage.from(privateBucketName).download(uploadPath, {
      transform: {
        width: 200,
        height: 200,
        format: 'origin',
      },
    })

    expect(res.error).toBeNull()
    expect(res.data?.size).toBeGreaterThan(0)
    expect(res.data?.type).toEqual('image/jpeg')
  })

  it('will get a signed transformed image', async () => {
    await storage.from(bucketName).upload(uploadPath, file)
    const res = await storage.from(bucketName).createSignedUrl(uploadPath, 60000, {
      transform: {
        width: 200,
        height: 200,
        quality: 60,
      },
    })

    expect(res.error).toBeNull()
    assert(res.data)

    const imageResp = await fetch(`${res.data.signedUrl}`, {})

    expect(parseInt(imageResp.headers.get('content-length') || '')).toBeGreaterThan(0)
    expect(imageResp.status).toEqual(200)
    expect(imageResp.headers.get('x-transformations')).toEqual(
      'height:200,width:200,resizing_type:fill,quality:60'
    )
  })
})

describe('Purge Cache - Mock Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('purge cache - single file success', async () => {
    const mockResponse = new Response(JSON.stringify({ message: 'success' }), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    })
    global.fetch = jest.fn().mockResolvedValue(mockResponse)

    const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
    const testBucket = 'test-bucket'

    const res = await mockStorage.from(testBucket).purgeCache('test-file.jpg')
    expect(res.error).toBeNull()
    expect(res.data?.message).toEqual('success')
    expect(res.data?.purgedPath).toEqual('test-file.jpg')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/cdn/${testBucket}/test-file.jpg`),
      expect.objectContaining({
        method: 'DELETE',
      })
    )
  })

  test('purge cache - rejects empty path', async () => {
    const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
    const testBucket = 'test-bucket'

    const res = await mockStorage.from(testBucket).purgeCache('')
    expect(res.data).toBeNull()
    expect(res.error?.message).toContain('Path is required')
  })

  test('purge cache - rejects wildcard', async () => {
    const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
    const testBucket = 'test-bucket'

    const res = await mockStorage.from(testBucket).purgeCache('folder/*')
    expect(res.data).toBeNull()
    expect(res.error?.message).toContain('Wildcard purging is not supported')
  })

  test('purge cache - with path normalization', async () => {
    const mockResponse = new Response(JSON.stringify({ message: 'success' }), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    })
    global.fetch = jest.fn().mockResolvedValue(mockResponse)

    const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
    const testBucket = 'test-bucket'

    const res = await mockStorage.from(testBucket).purgeCache('/folder//file.jpg/')
    expect(res.error).toBeNull()
    expect(res.data?.purgedPath).toEqual('folder/file.jpg')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/cdn/${testBucket}/folder/file.jpg`),
      expect.objectContaining({
        method: 'DELETE',
      })
    )
  })

  test('purge cache - handles 404 error', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        statusCode: '404',
        error: 'Not Found',
        message: 'Object not found',
      }),
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
      }
    )
    global.fetch = jest.fn().mockResolvedValue(mockResponse)

    const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
    const testBucket = 'test-bucket'

    const res = await mockStorage.from(testBucket).purgeCache('nonexistent.jpg')
    expect(res.data).toBeNull()
    expect(res.error).not.toBeNull()
    expect(res.error?.message).toContain('Object not found')
    await expect(storage.from('test').throwOnError().list()).rejects.toThrow('Network failure')
  })

  describe('Purge Cache By Prefix - Mock Tests', () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    let bucketName: string
    let file: Buffer
    let uploadPath: string
    beforeEach(async () => {
      bucketName = await newBucket()
      file = await fsp.readFile(uploadFilePath('sadcat.jpg'))
      uploadPath = `testpath/file-${Date.now()}.jpg`
    })

    it('handles malformed responses', async () => {
      const createMockResponse = () =>
        new Response(JSON.stringify({ message: 'Internal server error' }), {
          status: 500,
          statusText: 'Internal Server Error',
        })

      global.fetch = jest.fn().mockImplementation(() => Promise.resolve(createMockResponse()))
      const storage = new StorageClient('http://localhost:8000/storage/v1', {
        apikey: 'test-token',
      })

      const { data, error } = await storage.from('test').list()
      expect(data).toBeNull()
      expect(error).toBeInstanceOf(StorageError)
      expect(error?.message).toBe('Internal server error')

      global.fetch = jest.fn().mockImplementation(() => Promise.resolve(createMockResponse()))
      await expect(storage.from('test').throwOnError().list()).rejects.toThrow(
        'Internal server error'
      )
    })

    test('purge cache by prefix - successful folder purge', async () => {
      // Mock list response
      const listResponse = new Response(
        JSON.stringify([
          { name: 'file1.jpg', id: '1' },
          { name: 'file2.png', id: '2' },
        ]),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      // Mock purge responses for each file
      const purgeResponse = new Response(JSON.stringify({ message: 'success' }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })

      let fetchCallCount = 0
      global.fetch = jest.fn().mockImplementation(() => {
        fetchCallCount++
        // First call returns list response
        if (fetchCallCount === 1) return Promise.resolve(listResponse)
        // Subsequent calls return purge responses
        return Promise.resolve(purgeResponse.clone())
      })

      const mockStorage = new StorageClient(URL, { apikey: KEY })
      const testBucket = 'test-bucket'

      const res = await mockStorage.from(testBucket).purgeCacheByPrefix('folder')
      expect(res.error).toBeNull()
      expect(res.data?.purgedPaths).toHaveLength(2)
      expect(res.data?.purgedPaths).toEqual(['folder/file1.jpg', 'folder/file2.png'])
      expect(res.data?.message).toContain('Successfully purged 2 object(s)')
    })

    test('purge cache by prefix - empty folder', async () => {
      const listResponse = new Response(JSON.stringify([]), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })

      global.fetch = jest.fn().mockResolvedValue(listResponse)

      const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
      const testBucket = 'test-bucket'

      const res = await mockStorage.from(testBucket).purgeCacheByPrefix('empty-folder')
      expect(res.error).toBeNull()
      expect(res.data?.purgedPaths).toHaveLength(0)
      expect(res.data?.message).toEqual('No objects found to purge')
    })

    test('purge cache by prefix - handles partial failures', async () => {
      let fetchCallCount = 0
      global.fetch = jest.fn().mockImplementation(() => {
        fetchCallCount++
        if (fetchCallCount === 1) {
          // List response
          return Promise.resolve(
            new Response(
              JSON.stringify([
                { name: 'file1.jpg', id: '1' },
                { name: 'file2.png', id: '2' },
                { name: 'file3.gif', id: '3' },
              ]),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          )
        }
        // Handle individual purge calls
        const fileIndex = fetchCallCount - 2
        if (fileIndex === 1) {
          // Second file fails
          return Promise.resolve(
            new Response(
              JSON.stringify({
                statusCode: '404',
                error: 'Not Found',
                message: 'Object not found',
              }),
              { status: 404 }
            )
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'success' }), { status: 200 })
        )
      })

      const mockStorage = new StorageClient(URL, { apikey: KEY })
      const res = await mockStorage.from(bucketName).purgeCacheByPrefix('folder')

      expect(res.error).toBeNull()
      expect(res.data?.purgedPaths).toHaveLength(2)
      expect(res.data?.purgedPaths).toEqual(['folder/file1.jpg', 'folder/file3.gif'])
      expect(res.data?.warnings).toHaveLength(1)
      expect(res.data?.warnings?.[0]).toContain('Failed to purge folder/file2.png')
      expect(res.data?.message).toContain('Successfully purged 2 object(s) (1 failed)')
    })

    test('purge cache by prefix - all failures', async () => {
      // Mock list response
      const listResponse = new Response(
        JSON.stringify([
          { name: 'file1.jpg', id: '1' },
          { name: 'file2.png', id: '2' },
        ]),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      const errorResponse = new Response(
        JSON.stringify({
          statusCode: '404',
          error: 'Not Found',
          message: 'Object not found',
        }),
        {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(listResponse) // List call
        .mockResolvedValue(errorResponse) // All purge calls fail

      const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
      const testBucket = 'test-bucket'

      const res = await mockStorage.from(testBucket).purgeCacheByPrefix('folder')
      expect(res.data).toBeNull()
      expect(res.error).not.toBeNull()
      expect(res.error?.message).toContain('All purge operations failed')
    })

    test('purge cache by prefix - filters out folders', async () => {
      let fetchCallCount = 0
      global.fetch = jest.fn().mockImplementation(() => {
        fetchCallCount++
        if (fetchCallCount === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                { name: 'file1.jpg', id: '1' },
                { name: 'subfolder/', id: null },
                { name: 'file2.png', id: '3' },
              ]),
              { status: 200 }
            )
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'success' }), { status: 200 })
        )
      })

      const mockStorage = new StorageClient(URL, { apikey: KEY })
      const res = await mockStorage.from(bucketName).purgeCacheByPrefix('folder')

      expect(res.error).toBeNull()
      expect(res.data?.purgedPaths).toHaveLength(2)
      expect(res.data?.purgedPaths).toEqual(['folder/file1.jpg', 'folder/file2.png'])
      expect(res.data?.message).toContain('Successfully purged 2 object(s)')
    })

    test('purge cache by prefix - only folders found', async () => {
      // Mock list response with only folders
      const listResponse = new Response(
        JSON.stringify([
          { name: 'subfolder1/', id: null },
          { name: 'subfolder2/', id: null },
        ]),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      global.fetch = jest.fn().mockResolvedValue(listResponse)

      const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
      const testBucket = 'test-bucket'

      const res = await mockStorage.from(testBucket).purgeCacheByPrefix('folder')
      expect(res.error).toBeNull()
      expect(res.data?.purgedPaths).toHaveLength(0)
      expect(res.data?.message).toEqual('No files found to purge (only folders detected)')
    })

    test('purge cache by prefix - with batch size limit', async () => {
      const fileCount = 150
      const files = Array.from({ length: fileCount }, (_, i) => ({
        name: `file${i}.jpg`,
        id: String(i),
      }))

      let fetchCallCount = 0
      global.fetch = jest.fn().mockImplementation(() => {
        fetchCallCount++
        if (fetchCallCount === 1) {
          return Promise.resolve(new Response(JSON.stringify(files), { status: 200 }))
        }
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'success' }), { status: 200 })
        )
      })

      const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
      const res = await mockStorage.from(bucketName).purgeCacheByPrefix('folder', { batchSize: 50 })

      expect(res.error).toBeNull()
      expect(res.data?.purgedPaths).toHaveLength(150)
      expect(res.data?.message).toContain('Successfully purged 150 object(s)')
    })

    test('purge cache by prefix - with batch delay', async () => {
      const fileCount = 6
      const files = Array.from({ length: fileCount }, (_, i) => ({
        name: `file${i}.jpg`,
        id: String(i),
      }))

      let fetchCallCount = 0
      const startTime = Date.now()
      global.fetch = jest.fn().mockImplementation(() => {
        fetchCallCount++
        if (fetchCallCount === 1) {
          return Promise.resolve(new Response(JSON.stringify(files), { status: 200 }))
        }
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'success' }), { status: 200 })
        )
      })

      const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
      const res = await mockStorage
        .from(bucketName)
        .purgeCacheByPrefix('folder', { batchSize: 2, batchDelayMs: 50 })

      const endTime = Date.now()
      const executionTime = endTime - startTime

      expect(res.error).toBeNull()
      expect(res.data?.purgedPaths).toHaveLength(6)
      expect(res.data?.message).toContain('Successfully purged 6 object(s)')
      // Should have delays between batches (3 batches = 2 delays = ~100ms minimum)
      expect(executionTime).toBeGreaterThanOrEqual(100)
    })

    test('purge cache by prefix - list error', async () => {
      const listErrorResponse = new Response(
        JSON.stringify({
          statusCode: '403',
          error: 'Forbidden',
          message: 'Access denied',
        }),
        {
          status: 403,
          statusText: 'Forbidden',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      global.fetch = jest.fn().mockResolvedValue(listErrorResponse)

      const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
      const testBucket = 'test-bucket'

      const res = await mockStorage.from(testBucket).purgeCacheByPrefix('folder')
      expect(res.data).toBeNull()
      expect(res.error).not.toBeNull()
      expect(res.error?.message).toContain('Access denied')
    })

    test('purge cache by prefix - with custom options', async () => {
      const listResponse = new Response(
        JSON.stringify([
          { name: 'file1.jpg', id: '1' },
          { name: 'file2.png', id: '2' },
        ]),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      const purgeResponse = new Response(JSON.stringify({ message: 'success' }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })

      // Track and respond to each fetch call
      let fetchCalls = 0
      global.fetch = jest.fn().mockImplementation(() => {
        fetchCalls++
        if (fetchCalls === 1) {
          return Promise.resolve(listResponse)
        }
        return Promise.resolve(purgeResponse.clone()) // Clone for multiple uses
      })

      const mockStorage = new StorageClient(URL, { apikey: KEY })
      const testBucket = 'test-bucket'
      const abortController = new AbortController()

      const res = await mockStorage
        .from(testBucket)
        .purgeCacheByPrefix(
          'folder',
          { limit: 500, batchSize: 25 },
          { signal: abortController.signal }
        )

      expect(res.error).toBeNull()
      expect(res.data?.purgedPaths).toHaveLength(2)
      expect(res.data?.message).toContain('Successfully purged 2 object(s)')
    })

    describe('Purge Cache - Integration Tests (Skipped)', () => {
      test('purge cache for specific object', async () => {
        await storage.from(bucketName).upload(uploadPath, file)
        const res = await storage.from(bucketName).purgeCache(uploadPath)

        expect(res.error).toBeNull()
        expect(res.data?.message).toEqual('success')
        expect(res.data?.purgedPath).toEqual(uploadPath)
      })

      test('purge cache by prefix for folder', async () => {
        const file1Path = `testfolder/file1-${Date.now()}.jpg`
        const file2Path = `testfolder/file2-${Date.now()}.jpg`

        await storage.from(bucketName).upload(file1Path, file)
        await storage.from(bucketName).upload(file2Path, file)

        const res = await storage.from(bucketName).purgeCacheByPrefix('testfolder')

        expect(res.error).toBeNull()
        expect(res.data?.purgedPaths).toHaveLength(2)
        expect(res.data?.message).toContain('Successfully purged 2 object(s)')
      })

      test('purge cache by prefix for entire bucket', async () => {
        await storage.from(bucketName).upload(uploadPath, file)
        const res = await storage.from(bucketName).purgeCacheByPrefix('')

        expect(res.error).toBeNull()
        expect(res.data?.purgedPaths.length).toBeGreaterThan(0)
        expect(res.data?.message).toContain('Successfully purged')
      })
    })
  })

  it('handles network timeouts', async () => {
    global.fetch = jest.fn().mockImplementation(() => Promise.reject(new Error('Network timeout')))
    const storage = new StorageClient('http://localhost:8000/storage/v1', {
      apikey: 'test-token',
    })

    const { data, error } = await storage.from('test').list()
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toBe('Network timeout')

    await expect(storage.from('test').throwOnError().list()).rejects.toThrow('Network timeout')
  })

  test('purge cache - with AbortController', async () => {
    const mockResponse = new Response(JSON.stringify({ message: 'success' }), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    })
    global.fetch = jest.fn().mockResolvedValue(mockResponse)

    const mockStorage = new StorageClient(URL, { Authorization: `Bearer ${KEY}` })
    const testBucket = 'test-bucket'
    const abortController = new AbortController()

    const res = await mockStorage
      .from(testBucket)
      .purgeCache('test.png', { signal: abortController.signal })
    expect(res.error).toBeNull()
    expect(res.data?.message).toEqual('success')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/cdn/${testBucket}/test.png`),
      expect.objectContaining({
        method: 'DELETE',
        signal: abortController.signal,
      })
    )
  })
})

describe('StorageFileApi Edge Cases', () => {
  let storage: StorageClient

  beforeEach(() => {
    storage = new StorageClient('http://localhost:8000/storage/v1', {
      apikey: 'test-token',
    })
  })

  describe('Public URL with transformations', () => {
    test('handles all transformation options', () => {
      const { data } = storage.from('test-bucket').getPublicUrl('test.jpg', {
        transform: {
          width: 200,
          height: 150,
          resize: 'cover',
          format: 'origin',
          quality: 80,
        },
      })

      expect(data.publicUrl).toContain('width=200')
      expect(data.publicUrl).toContain('height=150')
      expect(data.publicUrl).toContain('resize=cover')
      expect(data.publicUrl).toContain('format=origin')
      expect(data.publicUrl).toContain('quality=80')
    })

    test('handles download with filename', () => {
      const { data } = storage.from('test-bucket').getPublicUrl('test.jpg', {
        download: 'custom-filename.jpg',
      })

      expect(data.publicUrl).toContain('download=custom-filename.jpg')
    })
  })

  describe('Body Payload Tests', () => {
    let mockPut: jest.SpyInstance
    let mockPost: jest.SpyInstance

    beforeEach(() => {
      const fetchLib = require('../src/lib/fetch')
      mockPut = jest.spyOn(fetchLib, 'put').mockResolvedValue({
        id: 'test-id',
        path: 'test-path',
        Key: 'test-key',
      })
      mockPost = jest.spyOn(fetchLib, 'post').mockResolvedValue({
        id: 'test-id',
        path: 'test-path',
        Key: 'test-key',
      })
    })

    afterEach(() => {
      mockPut.mockRestore()
      mockPost.mockRestore()
    })

    test('uploadToSignedUrl with Blob', async () => {
      const testBlob = new Blob(['test content'], { type: 'text/plain' })

      await storage.from('test-bucket').uploadToSignedUrl('test-path', 'test-token', testBlob)

      expect(mockPut).toHaveBeenCalled()
      const [, , body] = mockPut.mock.calls[0]
      expect(body.constructor.name).toBe('FormData')
    })

    test('uploadToSignedUrl with FormData', async () => {
      const testFormData = new FormData()
      testFormData.append('file', 'test content')

      await storage.from('test-bucket').uploadToSignedUrl('test-path', 'test-token', testFormData)

      expect(mockPut).toHaveBeenCalled()
      const [, , body] = mockPut.mock.calls[0]
      expect(body).toBe(testFormData)
    })

    test('upload with metadata', async () => {
      const testBlob = new Blob(['test content'], { type: 'text/plain' })
      const metadata = { customKey: 'customValue', author: 'test' }

      await storage.from('test-bucket').upload('test-path', testBlob, { metadata })

      expect(mockPost).toHaveBeenCalled()
      const [, , body] = mockPost.mock.calls[0]
      expect(body.constructor.name).toBe('FormData')
    })

    test('upload with FormData', async () => {
      const testFormData = new FormData()
      testFormData.append('file', 'test content')
      const metadata = { blah: 'abc213' }

      await storage.from('test-bucket').upload('test-path', testFormData, { metadata })

      expect(mockPost).toHaveBeenCalled()
      const [, , body] = mockPost.mock.calls[0] as [null, null, FormData]
      expect(body).toBe(testFormData)
      expect(body.get('metadata')).toBe(JSON.stringify(metadata))
    })

    test('upload passes headers', async () => {
      const testFormData = new FormData()
      testFormData.append('file', 'test content')

      const testHeaderKey = 'x-test-header'
      const testHeaderValue = 'abc123'

      await storage
        .from('test-bucket')
        .upload('test-path', testFormData, { headers: { [testHeaderKey]: testHeaderValue } })

      expect(mockPost).toHaveBeenCalled()
      const [, , body, { headers }] = mockPost.mock.calls[0]
      expect(body).toBe(testFormData)
      expect(headers[testHeaderKey]).toBe(testHeaderValue)
    })
  })
})
