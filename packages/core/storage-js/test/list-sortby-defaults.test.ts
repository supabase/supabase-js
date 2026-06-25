import { StorageClient } from '../src/index'

// Unit test (custom fetch capture) — proves that list() applies DEFAULT_SEARCH_OPTIONS
// including the nested sortBy default, even when the caller overrides only part of it.
describe('StorageFileApi.list() default sortBy merge', () => {
  const URL = 'http://localhost/storage/v1'

  const makeClient = () => {
    let captured: { body?: unknown } | null = null
    const fetch = (async (_url: string, opts: { body?: unknown }) => {
      captured = opts
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch
    const client = new StorageClient(URL, {}, fetch)
    const sentBody = () =>
      typeof captured?.body === 'string' ? JSON.parse(captured.body) : (captured?.body as any)
    return { client, sentBody }
  }

  test('applies the full default sortBy when no options are given', async () => {
    const { client, sentBody } = makeClient()
    await client.from('bucket').list('folder')
    expect(sentBody().sortBy).toEqual({ column: 'name', order: 'asc' })
  })

  test('preserves the default sortBy.column when only sortBy.order is overridden', async () => {
    const { client, sentBody } = makeClient()
    await client.from('bucket').list('folder', { sortBy: { order: 'desc' } })
    // The Storage server requires `column`; without the default fallback this sends a sortBy
    // with no column, which the server rejects with a 400. This is the case that actually fails.
    expect(sentBody().sortBy).toEqual({ column: 'name', order: 'desc' })
  })

  test('preserves the default sortBy.order when only sortBy.column is overridden', async () => {
    const { client, sentBody } = makeClient()
    await client.from('bucket').list('folder', { sortBy: { column: 'updated_at' } })
    expect(sentBody().sortBy).toEqual({ column: 'updated_at', order: 'asc' })
  })
})
