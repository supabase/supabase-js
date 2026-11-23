import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { createClient } from '../../src/index'
import { DEFAULT_HEADERS } from '../../src/lib/constants'

/**
 * Sends real HTTP requests to a local server, so the assertion is on the header as it appears on
 * the wire, after every service client and the fetch wrappers have had their say. The unit tests
 * in clientInfo.test.ts stub fetch; this proves nothing between the option and the socket
 * rewrites or drops the header.
 */
describe('global.clientInfo on the wire', () => {
  let server: http.Server
  let url: string
  const seen: { path: string; clientInfo: string | string[] | undefined }[] = []

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      seen.push({ path: req.url ?? '', clientInfo: req.headers['x-client-info'] })
      res.setHeader('content-type', 'application/json')
      res.end('{}')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  beforeEach(() => {
    seen.length = 0
  })

  test('PostgREST, Storage, Functions and Auth each send one combined header', async () => {
    const client = createClient(url, 'some.fake.key', {
      global: { clientInfo: { via: 'my-lib/1.0.0', middleware: 'a,b' } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    await client.from('t').select()
    await client.storage.from('b').list()
    await client.functions.invoke('fn')
    await client.auth.signInWithPassword({ email: 'a@b.co', password: 'pw' })

    const expected = `${DEFAULT_HEADERS['X-Client-Info']}; via=my-lib/1.0.0; middleware=a,b`
    for (const service of ['/rest/v1/', '/storage/v1/', '/functions/v1/', '/auth/v1/']) {
      const request = seen.find((r) => r.path.startsWith(service))
      expect(request).toBeDefined()
      // A string, not an array: Node joins repeated headers with ", ", so a duplicate would show.
      expect(request!.clientInfo).toBe(expected)
    }
  })

  test('a lowercase caller override reaches the wire once, with the parameters appended', async () => {
    const client = createClient(url, 'some.fake.key', {
      global: { headers: { 'x-client-info': 'my-lib/2.0.0' }, clientInfo: { via: 'my-lib/2.0.0' } },
    })
    await client.from('t').select()
    expect(seen[0].clientInfo).toBe('my-lib/2.0.0; via=my-lib/2.0.0')
  })
})
