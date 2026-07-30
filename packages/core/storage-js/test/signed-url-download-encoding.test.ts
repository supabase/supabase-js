import { StorageClient } from '../src/index'

// Unit test (custom fetch capture) — proves createSignedUrl / createSignedUrls do not double-encode
// the `download` query value. `URLSearchParams` already percent-encodes (`&` -> `%26`); wrapping the
// whole URL *including* that query in `encodeURI()` re-encodes every `%` (`%26` -> `%2526`), which the
// server then decodes once into the wrong literal filename (`a%26b.png` instead of `a&b.png`).
// The sibling `getPublicUrl` encodeURI()s only the path and appends the query raw — the correct shape.
describe('StorageFileApi signed-url download encoding', () => {
  const URL = 'http://localhost/storage/v1'

  const makeClient = () => {
    const fetch = (async (_url: string, opts: { body?: string }) => {
      const body = opts?.body ? JSON.parse(opts.body) : {}
      if (Array.isArray(body.paths)) {
        // createSignedUrls (plural)
        return new Response(
          JSON.stringify(
            body.paths.map((p: string) => ({
              signedURL: `/object/sign/bucket/${p}?token=tok`,
              error: null,
              path: p,
            }))
          ),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      // createSignedUrl (singular)
      return new Response(JSON.stringify({ signedURL: '/object/sign/bucket/p.png?token=tok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch
    return new StorageClient(URL, {}, fetch)
  }

  test('createSignedUrl single-encodes the download filename (no double encoding)', async () => {
    const { data } = await makeClient()
      .from('bucket')
      .createSignedUrl('p.png', 60, { download: 'a&b.png' })
    expect(data!.signedUrl).toContain('download=a%26b.png')
    expect(data!.signedUrl).not.toContain('a%2526b.png')
  })

  test('createSignedUrls single-encodes the download filename (no double encoding)', async () => {
    const { data } = await makeClient()
      .from('bucket')
      .createSignedUrls(['p.png'], 60, { download: 'a&b.png' })
    expect(data![0].signedUrl).toContain('download=a%26b.png')
    expect(data![0].signedUrl).not.toContain('a%2526b.png')
  })

  test('getPublicUrl (sibling) already single-encodes the same filename', () => {
    const { data } = makeClient().from('bucket').getPublicUrl('p.png', { download: 'a&b.png' })
    expect(data.publicUrl).toContain('download=a%26b.png')
    expect(data.publicUrl).not.toContain('a%2526b.png')
  })
})
