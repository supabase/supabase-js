import { devSession, type DevSessionOptions } from '../../src/dev'
import { NAMESPACE_HEADER } from '../../src/index'

const REF = 'abcd1234'
const URL = `https://${REF}.supabase.co`

function jwt(claims: Record<string, unknown>) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`
}

const ANON_KEY = jwt({ role: 'anon', ref: REF })
const SERVICE_KEY = jwt({ role: 'service_role', ref: REF })

const ENV_VARS = [
  'NODE_ENV',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_DEV_PASSWORD',
  'SUPABASE_DEV_TEST_DOMAIN',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

describe('devSession', () => {
  const savedEnv: Record<string, string | undefined> = {}
  let fetchMock: jest.Mock

  beforeEach(() => {
    for (const name of ENV_VARS) {
      savedEnv[name] = process.env[name]
      delete process.env[name]
    }
    fetchMock = jest.fn(async () => json([]))
  })

  afterEach(() => {
    for (const name of ENV_VARS) {
      if (savedEnv[name] === undefined) delete process.env[name]
      else process.env[name] = savedEnv[name]
    }
  })

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }

  function session(options: Partial<DevSessionOptions> = {}) {
    return devSession({
      slot: 's07',
      branchRef: REF,
      url: URL,
      key: ANON_KEY,
      ...options,
      options: {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetchMock },
        ...options.options,
      },
    })
  }

  function lastRequest() {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
    return { url: String(url), init, headers: new Headers(init?.headers) }
  }

  describe('guards', () => {
    test('refuses to run when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production'
      await expect(session()).rejects.toThrow(/NODE_ENV is "production"/)
    })

    test.each([
      ['another project', 'https://prodref.supabase.co'],
      ['a custom domain', 'https://api.example.com'],
      ['a local stack', 'http://127.0.0.1:54321'],
    ])('refuses a URL pointing to %s', async (_, url) => {
      await expect(session({ url })).rejects.toThrow(/is not the branch "abcd1234"/)
    })

    test('refuses an empty branchRef', async () => {
      await expect(session({ branchRef: '' })).rejects.toThrow(/is not the branch/)
    })

    test.each([
      ['a secret key', 'sb_secret_abc'],
      ['a service role key', SERVICE_KEY],
    ])('refuses %s', async (_, key) => {
      await expect(session({ key })).rejects.toThrow(/secret or service role key/)
    })

    test('refuses a JWT key issued for another project', async () => {
      await expect(session({ key: jwt({ role: 'anon', ref: 'prodref' }) })).rejects.toThrow(
        /belongs to project "prodref"/
      )
    })

    test('accepts publishable keys and JWT keys without a ref', async () => {
      await expect(session({ key: 'sb_publishable_abc' })).resolves.toBeDefined()
      await expect(session({ key: jwt({ role: 'anon' }) })).resolves.toBeDefined()
    })

    test('rejects an invalid slot', async () => {
      await expect(session({ slot: 's:07' })).rejects.toThrow(/Invalid namespace/)
    })
  })

  describe('configuration', () => {
    test('reads the URL and key from the environment', async () => {
      process.env.SUPABASE_URL = URL
      process.env.SUPABASE_ANON_KEY = ANON_KEY
      const { client } = await devSession({
        slot: 's07',
        branchRef: REF,
        options: { global: { fetch: fetchMock } },
      })

      await client.from('todos').select()
      expect(lastRequest().url).toBe(`${URL}/rest/v1/todos?select=*`)
      expect(lastRequest().headers.get('apikey')).toBe(ANON_KEY)
    })

    test('prefers SUPABASE_PUBLISHABLE_KEY over SUPABASE_ANON_KEY', async () => {
      process.env.SUPABASE_URL = URL
      process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abc'
      process.env.SUPABASE_ANON_KEY = ANON_KEY
      const { client } = await devSession({
        slot: 's07',
        branchRef: REF,
        options: { global: { fetch: fetchMock } },
      })

      await client.from('todos').select()
      expect(lastRequest().headers.get('apikey')).toBe('sb_publishable_abc')
    })

    test('throws without a URL or key', async () => {
      await expect(devSession({ slot: 's07', branchRef: REF })).rejects.toThrow(/SUPABASE_URL/)
      await expect(devSession({ slot: 's07', branchRef: REF, url: URL })).rejects.toThrow(
        /SUPABASE_PUBLISHABLE_KEY/
      )
    })

    test('creates the client in the slot namespace', async () => {
      const { client, slot, user } = await session()

      expect(slot).toBe('s07')
      expect(user).toBeNull()
      expect(client.channel('room').topic).toBe('realtime:s07:room')
      await client.from('todos').select()
      expect(lastRequest().headers.get(NAMESPACE_HEADER)).toBe('s07')
    })
  })

  describe('signInAs', () => {
    const user = { id: 'user-id', email: 's07+admin@example.com', aud: 'authenticated' }

    beforeEach(() => {
      fetchMock.mockImplementation(async (url: string) =>
        String(url).includes('/auth/v1/token')
          ? json({
              access_token: jwt({ sub: user.id, role: 'authenticated', exp: 9999999999 }),
              refresh_token: 'refresh',
              expires_in: 3600,
              token_type: 'bearer',
              user,
            })
          : json([])
      )
    })

    test('signs in as the slot identity for the role', async () => {
      process.env.SUPABASE_DEV_PASSWORD = 'dev-password'
      const result = await session({ signInAs: 'admin' })

      const signIn = fetchMock.mock.calls.find(([url]) => String(url).includes('/auth/v1/token'))
      expect(String(signIn[0])).toBe(`${URL}/auth/v1/token?grant_type=password`)
      expect(JSON.parse(signIn[1].body)).toMatchObject({
        email: 's07+admin@example.com',
        password: 'dev-password',
      })
      expect(result.user).toMatchObject({ id: 'user-id' })
    })

    test('uses the configured test domain and password', async () => {
      process.env.SUPABASE_DEV_TEST_DOMAIN = 'test.local'
      await session({ signInAs: 'member', password: 'explicit' })

      const signIn = fetchMock.mock.calls.find(([url]) => String(url).includes('/auth/v1/token'))
      expect(JSON.parse(signIn[1].body)).toMatchObject({
        email: 's07+member@test.local',
        password: 'explicit',
      })
    })

    test('throws without a password', async () => {
      await expect(session({ signInAs: 'admin' })).rejects.toThrow(/SUPABASE_DEV_PASSWORD/)
    })

    test('throws when sign-in fails', async () => {
      fetchMock.mockResolvedValue(
        json({ code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400)
      )
      await expect(session({ signInAs: 'admin', password: 'wrong' })).rejects.toThrow(
        /Could not sign in as s07\+admin@example.com: Invalid login credentials/
      )
    })
  })

  describe('uniq', () => {
    test('returns values unique to the session', async () => {
      const { uniq } = await session()

      expect(uniq('slug')).toMatch(/^s07-slug-[0-9a-z]{8}$/)
      expect(uniq()).toMatch(/^s07-[0-9a-z]{8}$/)
      const values = new Set(Array.from({ length: 1000 }, () => uniq('slug')))
      expect(values.size).toBe(1000)
    })
  })

  describe('adminClient', () => {
    const scope = { orders: { org_id: 'org-1' } }

    async function admin() {
      const { adminClient } = await session({ adminKey: SERVICE_KEY })
      return adminClient({ scope })
    }

    test('uses the admin key in the slot namespace', async () => {
      const client = await admin()
      await client.from('orders').select()

      expect(lastRequest().headers.get('apikey')).toBe(SERVICE_KEY)
      expect(lastRequest().headers.get(NAMESPACE_HEADER)).toBe('s07')
      expect(client.storage.from('photos').getPublicUrl('a.png').data.publicUrl).toBe(
        `${URL}/storage/v1/object/public/photos/s07/a.png`
      )
    })

    test('reads the admin key from the environment', async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY
      const { adminClient } = await session()
      await adminClient({ scope }).from('orders').select()
      expect(lastRequest().headers.get('apikey')).toBe(SERVICE_KEY)
    })

    test('throws without an admin key', async () => {
      const { adminClient } = await session()
      expect(() => adminClient({ scope })).toThrow(/SUPABASE_SECRET_KEY/)
    })

    test('refuses an admin JWT issued for another project', async () => {
      const { adminClient } = await session({
        adminKey: jwt({ role: 'service_role', ref: 'prodref' }),
      })
      expect(() => adminClient({ scope })).toThrow(/belongs to project "prodref"/)
    })

    test('filters select, update and delete with the scope', async () => {
      const client = await admin()

      await client.from('orders').select('id').eq('status', 'open')
      expect(lastRequest().url).toBe(
        `${URL}/rest/v1/orders?select=id&org_id=eq.org-1&status=eq.open`
      )

      await client.from('orders').update({ status: 'closed' }).eq('id', 1)
      expect(lastRequest().init.method).toBe('PATCH')
      expect(lastRequest().url).toBe(`${URL}/rest/v1/orders?org_id=eq.org-1&id=eq.1`)

      await client.from('orders').delete()
      expect(lastRequest().init.method).toBe('DELETE')
      expect(lastRequest().url).toBe(`${URL}/rest/v1/orders?org_id=eq.org-1`)
    })

    test('stamps inserted rows with the scope', async () => {
      const client = await admin()

      await client.from('orders').insert({ id: 1 })
      expect(JSON.parse(lastRequest().init.body)).toEqual({ id: 1, org_id: 'org-1' })

      await client.from('orders').insert([{ id: 2 }, { id: 3, org_id: 'org-1' }])
      expect(JSON.parse(lastRequest().init.body)).toEqual([
        { id: 2, org_id: 'org-1' },
        { id: 3, org_id: 'org-1' },
      ])
    })

    test('refuses writes outside the scope', async () => {
      const client = await admin()

      expect(() => client.from('orders').insert({ id: 1, org_id: 'org-2' })).toThrow(
        /orders.org_id = "org-2", outside its scope "org-1"/
      )
      expect(() => client.from('orders').update({ org_id: 'org-2' })).toThrow(/outside its scope/)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    test('only allows upsert that ignores duplicates', async () => {
      const client = await admin()

      expect(() => client.from('orders').upsert({ id: 1 })).toThrow(/ignoreDuplicates: true/)
      await client.from('orders').upsert({ id: 1 }, { ignoreDuplicates: true })
      expect(JSON.parse(lastRequest().init.body)).toEqual({ id: 1, org_id: 'org-1' })
      expect(lastRequest().headers.get('Prefer')).toContain('resolution=ignore-duplicates')
    })

    test('throws on unmapped tables, rpc and schema', async () => {
      const client = await admin()

      expect(() => client.from('invoices')).toThrow(/no scope for table "invoices"/)
      expect(() => client.rpc('anything')).toThrow(/can't scope rpc\(\)/)
      expect(() => client.schema('private')).toThrow(/can't scope schema\(\)/)
    })
  })
})
