import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

describe('Permission error hints', () => {
  describe('42501 - Permission Denied', () => {
    test('should enhance table permission denied with null hint (GET request)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied for table test',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('42501')
      expect(res.error!.hint).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT SELECT ON public.test')
      expect(res.error!.hint).toContain('anon, authenticated, service_role')
    })

    test('should enhance table permission denied with operation-specific hints (POST)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied for table test',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('test' as any).insert({ id: 1 })

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('42501')
      expect(res.error!.hint).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT INSERT ON public.test')
      expect(res.error!.hint).toContain('anon, authenticated, service_role')
    })

    test('should enhance table permission denied with operation-specific hints (PATCH)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied for table test',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest
        .from('test' as any)
        .update({ id: 1 })
        .eq('id', 1)

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('42501')
      expect(res.error!.hint).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT UPDATE ON public.test')
      expect(res.error!.hint).toContain('anon, authenticated, service_role')
    })

    test('should enhance table permission denied with operation-specific hints (DELETE)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied for table test',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest
        .from('test' as any)
        .delete()
        .eq('id', 1)

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('42501')
      expect(res.error!.hint).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT DELETE ON public.test')
      expect(res.error!.hint).toContain('anon, authenticated, service_role')
    })

    test('should enhance view permission denied', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied for view limited_article_stars',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('limited_article_stars' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('42501')
      expect(res.error!.hint).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT SELECT ON public.limited_article_stars')
      expect(res.error!.hint).toContain('view')
    })

    test('should enhance function permission denied', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied for function hello_world',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.rpc('hello_world' as any)

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('42501')
      expect(res.error!.hint).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT EXECUTE ON FUNCTION public.hello_world')
      expect(res.error!.hint).toContain('anon, authenticated, service_role')
    })

    test('should NOT override existing hint from PostgREST', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied for table test',
            hint: 'Custom hint from PostgREST',
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('42501')
      expect(res.error!.hint).toBe('Custom hint from PostgREST')
      expect(res.error!.hint).not.toContain('GRANT')
    })

    test('should NOT enhance schema permission denied', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied for schema auth',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('42501')
      // Should enhance schema errors too
      expect(res.error!.hint).toBeTruthy()
      expect(res.error!.hint).toContain('schema')
    })
  })

  describe('PGRST205 - Table Not Found', () => {
    test('should enhance table not found with null hint', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: 'PGRST205',
            message: "Could not find the table 'public.test' in the schema cache",
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('PGRST205')
      expect(res.error!.hint).toBeTruthy()
      expect(res.error!.hint).toContain('This could mean')
      expect(res.error!.hint).toContain("doesn't exist")
      expect(res.error!.hint).toContain("don't have permission")
      expect(res.error!.hint).toContain('GRANT SELECT ON public.test')
    })

    test('should enhance table not found with single quotes', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: 'PGRST205',
            message: "Could not find the table 'test' in the schema cache",
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('PGRST205')
      expect(res.error!.hint).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT SELECT ON public.test')
    })

    test('should NOT override existing PostgREST hint (similar tables)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: 'PGRST205',
            message: "Could not find the table 'public.test2' in the schema cache",
            hint: "Perhaps you meant the table 'public.test'",
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('test2' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('PGRST205')
      expect(res.error!.hint).toBe("Perhaps you meant the table 'public.test'")
      expect(res.error!.hint).not.toContain('This could mean')
    })

    test('should provide operation-specific hint for INSERT', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: 'PGRST205',
            message: "Could not find the table 'test' in the schema cache",
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('test' as any).insert({ id: 1 })

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('PGRST205')
      expect(res.error!.hint).toContain('GRANT INSERT ON public.test')
    })
  })

  describe('PGRST202 - Function Not Found', () => {
    test('should enhance function not found with null hint', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: 'PGRST202',
            message:
              'Could not find the function public.hello_world without parameters in the schema cache',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.rpc('hello_world' as any)

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('PGRST202')
      expect(res.error!.hint).toBeTruthy()
      expect(res.error!.hint).toContain('This could mean')
      expect(res.error!.hint).toContain("doesn't exist")
      expect(res.error!.hint).toContain("don't have permission")
      expect(res.error!.hint).toContain('GRANT EXECUTE ON FUNCTION public.hello_world')
    })

    test('should extract function name without quotes', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: 'PGRST202',
            message: 'Could not find the function my_func without parameters in the schema cache',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.rpc('my_func' as any)

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('PGRST202')
      expect(res.error!.hint).toContain('GRANT EXECUTE ON FUNCTION public.my_func')
    })

    test('should NOT override existing PostgREST hint (similar functions)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: 'PGRST202',
            message:
              'Could not find the function public.hello_world2 without parameters in the schema cache',
            hint: 'Perhaps you meant to call the function public.hello_world',
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.rpc('hello_world2' as any)

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('PGRST202')
      expect(res.error!.hint).toBe('Perhaps you meant to call the function public.hello_world')
      expect(res.error!.hint).not.toContain('This could mean')
    })
  })

  describe('Edge Cases', () => {
    test('should handle malformed error message without crashing (42501)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('42501')
      // Should not have added a hint since pattern didn't match
      expect(res.error!.hint).toBeNull()
    })

    test('should not affect other error codes', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 406,
        statusText: 'Not Acceptable',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            hint: null,
            details: 'Results contain 2 rows, application/vnd.pgrst.object+json requires 1 row',
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest
        .from('test' as any)
        .select()
        .maybeSingle()

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('PGRST116')
      // Should not have modified the hint
      expect(res.error!.hint).toBeNull()
    })

    test('should handle error without hint field', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied for table test',
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('42501')
      // Should have added the hint field
      expect(res.error!.hint).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT SELECT')
    })

    test('should handle HEAD request (same as GET)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied for table test',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      const res = await postgrest.from('test' as any).select('*', { head: true })

      expect(res.error).toBeTruthy()
      expect(res.error!.code).toBe('42501')
      expect(res.error!.hint).toContain('GRANT SELECT')
    })
  })

  describe('throwOnError behavior', () => {
    test('should throw enhanced error when using throwOnError', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            code: '42501',
            message: 'permission denied for table test',
            hint: null,
            details: null,
          }),
      })

      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetch as any,
      })

      try {
        await postgrest
          .from('test' as any)
          .select()
          .throwOnError()
        fail('Should have thrown error')
      } catch (error: any) {
        expect(error.code).toBe('42501')
        expect(error.hint).toContain('GRANT SELECT ON public.test')
      }
    })
  })
})
