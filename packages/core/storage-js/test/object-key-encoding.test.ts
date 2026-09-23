import StorageFileApi from '../src/packages/StorageFileApi'

const URL_BASE = 'https://proj.supabase.co/storage/v1'

const makeApi = (fetchImpl?: any) => new StorageFileApi(URL_BASE, {}, 'bucket', fetchImpl)

/**
 * A `#` in an object key ends the URL path and starts a fragment, and a `?`
 * starts the query string, so an unencoded key silently addresses a different
 * object than the one the caller asked for.
 */
describe('object keys that carry URL-significant characters', () => {
  describe('getPublicUrl', () => {
    test('percent-encodes a hash', () => {
      const { data } = makeApi().getPublicUrl('folder/report#1.png')

      expect(data.publicUrl).toBe(`${URL_BASE}/object/public/bucket/folder/report%231.png`)
    })

    test('percent-encodes a question mark', () => {
      const { data } = makeApi().getPublicUrl('folder/what?.png')

      expect(data.publicUrl).toBe(`${URL_BASE}/object/public/bucket/folder/what%3F.png`)
    })

    test('keeps path separators literal', () => {
      const { data } = makeApi().getPublicUrl('a/b/c.png')

      expect(data.publicUrl).toBe(`${URL_BASE}/object/public/bucket/a/b/c.png`)
    })

    test('leaves the query string it builds itself untouched', () => {
      const { data } = makeApi().getPublicUrl('folder/report#1.png', { download: 'report#1.png' })

      const [path, query] = data.publicUrl.split('?')
      expect(path).toBe(`${URL_BASE}/object/public/bucket/folder/report%231.png`)
      expect(query).toBe('download=report%231.png')
    })
  })

  describe('requests built from an object key', () => {
    const capture = () => {
      const calls: string[] = []
      const fetchImpl = jest.fn(async (url: string) => {
        calls.push(url)
        return new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      })

      return { calls, fetchImpl }
    }

    test('info() encodes the key', async () => {
      const { calls, fetchImpl } = capture()

      await makeApi(fetchImpl).info('folder/report#1.png')

      expect(calls[0]).toContain('/object/info/bucket/folder/report%231.png')
    })

    test('createSignedUrl() encodes the key', async () => {
      const { calls, fetchImpl } = capture()

      await makeApi(fetchImpl).createSignedUrl('folder/report#1.png', 60)

      expect(calls[0]).toContain('/object/sign/bucket/folder/report%231.png')
    })
  })
})
