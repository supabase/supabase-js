import { StorageClient } from '../src/index'
import * as fsp from 'fs/promises'
import * as fs from 'fs'
import * as path from 'path'
import FormData from 'form-data'
import assert from 'assert'
// @ts-ignore
import fetch, { Response } from '@supabase/node-fetch'
import { StorageError } from '../src/lib/errors'

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

    test('sign url', async () => {
      const uploadRes = await storage.from(bucketName).upload(uploadPath, file)
      expect(uploadRes.error).toBeNull()

      const res = await storage.from(bucketName).createSignedUrl(uploadPath, 2000)

      expect(res.error).toBeNull()
      expect(res.data?.signedUrl).toContain(`${URL}/object/sign/${bucketName}/${uploadPath}`)
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
      formData.append('file', file)

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
      expect(res.error).toEqual({
        error: 'Payload too large',
        message: 'The object exceeded the maximum allowed size',
        statusCode: '413',
      })
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
      expect(res.error).toEqual({
        error: 'invalid_mime_type',
        message: 'mime type image/jpeg is not supported',
        statusCode: '415',
      })
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

      expect(uploadRes2.error).toEqual({
        error: 'Duplicate',
        message: 'The resource already exists',
        statusCode: '409',
      })
    })
  })

  describe('Error handling', () => {
    let mockError: Error

    beforeEach(() => {
      uploadPath = `testpath/file-${Date.now()}.jpg`
      mockError = new Error('Network failure')
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    test.skip('throws unknown errors', async () => {
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(`${URL}`, {
        apikey: 'test-token',
      })

      const { data, error } = await storage.from(bucketName).upload(uploadPath, file)
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network failure')
    })

    test.skip('handles malformed responses', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          statusCode: '500',
          error: 'Internal Server Error',
          message: 'Unexpected server error',
        }),
        {
          status: 500,
          statusText: 'Internal Server Error',
        }
      )

      global.fetch = jest.fn().mockImplementation(() => Promise.resolve(mockResponse))
      const storage = new StorageClient(`${URL}`, {
        apikey: 'test-token',
      })

      const { data, error } = await storage.from(bucketName).upload(uploadPath, file)
      expect(data).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Unexpected server error')
    })

    test.skip('handles network timeouts', async () => {
      mockError = new Error('Network timeout')
      global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
      const storage = new StorageClient(`${URL}`, {
        apikey: 'test-token',
      })

      const { data, error } = await storage.from(bucketName).upload(uploadPath, file)
      expect(error).not.toBeNull()
      expect(error?.message).toBe('Network timeout')
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

    test('move object to different path', async () => {
      const newPath = `testpath/file-moved-${Date.now()}.txt`
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).move(uploadPath, newPath)

      expect(res.error).toBeNull()
      expect(res.data?.message).toEqual(`Successfully moved`)
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
      const res = await storage.from(bucketName).download(uploadPath)

      expect(res.error).toBeNull()
      expect(res.data?.size).toBeGreaterThan(0)
      expect(res.data?.type).toEqual('text/plain;charset=utf-8')
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
    })

    test('check if object exists', async () => {
      await storage.from(bucketName).upload(uploadPath, file)
      const res = await storage.from(bucketName).exists(uploadPath)

      expect(res.error).toBeNull()
      expect(res.data).toEqual(true)

      const resNotExists = await storage.from(bucketName).exists('do-not-exists')
      expect(resNotExists.data).toEqual(false)
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

describe('error handling', () => {
  let mockError: Error

  beforeEach(() => {
    mockError = new Error('Network failure')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('throws unknown errors', async () => {
    global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
    const storage = new StorageClient('http://localhost:8000/storage/v1', {
      apikey: 'test-token',
    })

    const { data, error } = await storage.from('test').list()
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toBe('Network failure')
  })

  it('handles malformed responses', async () => {
    const mockResponse = new Response(JSON.stringify({ message: 'Internal server error' }), {
      status: 500,
      statusText: 'Internal Server Error',
    })

    global.fetch = jest.fn().mockImplementation(() => Promise.resolve(mockResponse))
    const storage = new StorageClient('http://localhost:8000/storage/v1', {
      apikey: 'test-token',
    })

    const { data, error } = await storage.from('test').list()
    expect(data).toBeNull()
    expect(error).toBeInstanceOf(StorageError)
    expect(error?.message).toBe('Internal server error')
  })

  it('handles network timeouts', async () => {
    mockError = new Error('Network timeout')
    global.fetch = jest.fn().mockImplementation(() => Promise.reject(mockError))
    const storage = new StorageClient('http://localhost:8000/storage/v1', {
      apikey: 'test-token',
    })

    const { data, error } = await storage.from('test').list()
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toBe('Network timeout')
  })
})
