import { createClient, defineSupabasePlugin, SupabaseClient } from '../../src/index'

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'

describe('plugins', () => {
  test('attaches the plugin namespace and its methods work', () => {
    const greeter = defineSupabasePlugin({
      name: 'greeter',
      client: () => ({ greet: (who: string) => `hello ${who}` }),
    })

    const supabase = createClient(URL, KEY, { plugins: [greeter] })
    expect(supabase.greeter).toBeDefined()
    expect(supabase.greeter.greet('world')).toBe('hello world')
  })

  test('factory receives the fully initialized client itself', () => {
    let received: unknown
    const probe = defineSupabasePlugin({
      name: 'probe',
      client: (client) => {
        received = client
        // built-in sub-clients are already usable inside the factory
        expect(client.functions).toBeDefined()
        expect(typeof client.from).toBe('function')
        return {}
      },
    })

    const supabase = createClient(URL, KEY, { plugins: [probe] })
    expect(received).toBe(supabase)
  })

  test('attaches multiple plugins in array order; later factories see earlier namespaces', () => {
    const order: string[] = []
    const first = defineSupabasePlugin({
      name: 'first',
      client: () => {
        order.push('first')
        return { one: 1 }
      },
    })
    const second = defineSupabasePlugin({
      name: 'second',
      client: (client) => {
        order.push('second')
        expect((client as any).first).toEqual({ one: 1 })
        return { two: 2 }
      },
    })

    const supabase = createClient(URL, KEY, { plugins: [first, second] })
    expect(order).toEqual(['first', 'second'])
    expect(supabase.first.one).toBe(1)
    expect(supabase.second.two).toBe(2)
  })

  test.each(['from', 'auth', 'functions', 'storage', 'realtime', 'rpc', 'channel'])(
    'throws when a plugin name collides with the built-in "%s"',
    (name) => {
      const colliding = { name, client: () => ({}) }
      expect(() => createClient(URL, KEY, { plugins: [colliding] })).toThrow(
        `@supabase/supabase-js: plugin "${name}" conflicts with an existing property on the Supabase client.`
      )
    }
  )

  test('throws on duplicate plugin names', () => {
    const a = defineSupabasePlugin({ name: 'dup', client: () => ({ a: 1 }) })
    const b = defineSupabasePlugin({ name: 'dup', client: () => ({ b: 2 }) })
    expect(() => createClient(URL, KEY, { plugins: [a, b] })).toThrow(
      '@supabase/supabase-js: plugin "dup" conflicts with an existing property on the Supabase client.'
    )
  })

  test('throws when a plugin has no string name', () => {
    expect(() =>
      createClient(URL, KEY, { plugins: [{ name: '' as string, client: () => ({}) }] })
    ).toThrow('@supabase/supabase-js: each plugin must have a string `name`.')
    expect(() => createClient(URL, KEY, { plugins: [{ client: () => ({}) } as any] })).toThrow(
      '@supabase/supabase-js: each plugin must have a string `name`.'
    )
  })

  test('empty plugins array and omitted plugins behave identically', () => {
    const baseline = createClient(URL, KEY)
    const empty = createClient(URL, KEY, { plugins: [] as const })
    expect(Object.keys(empty).sort()).toEqual(Object.keys(baseline).sort())
  })

  test('attaches plugins via the SupabaseClient constructor directly', () => {
    const greeter = defineSupabasePlugin({
      name: 'greeter',
      client: () => ({ greet: () => 'hi' }),
    })
    const client = new SupabaseClient(URL, KEY, { plugins: [greeter] })
    expect((client as any).greeter.greet()).toBe('hi')
  })

  test('defineSupabasePlugin is an identity function', () => {
    const spec = { name: 'x' as const, client: () => ({}) }
    expect(defineSupabasePlugin(spec)).toBe(spec)
  })
})
