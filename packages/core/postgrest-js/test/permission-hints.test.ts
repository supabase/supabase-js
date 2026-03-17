import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

function mockFetchWithError(body: object, status = 403) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: status === 403 ? 'Forbidden' : 'Not Found',
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  })
}

describe('Permission error hints', () => {
  describe('42501 - permission denied', () => {
    test('GET request injects GRANT SELECT hint', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError({
          code: '42501',
          message: 'permission denied for table test',
          details: null,
          hint: null,
        }) as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT SELECT')
      expect(res.error!.hint).toContain('public.test')
      expect(res.error!.hint).toContain('anon, authenticated')
    })

    test('POST request injects GRANT INSERT hint', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError({
          code: '42501',
          message: 'permission denied for table test',
          details: null,
          hint: null,
        }) as any,
      })

      const res = await postgrest.from('test' as any).insert({ id: 1 } as any)

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT INSERT')
    })

    test('PATCH request injects GRANT UPDATE hint', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError({
          code: '42501',
          message: 'permission denied for table test',
          details: null,
          hint: null,
        }) as any,
      })

      const res = await postgrest.from('test' as any).update({ id: 1 } as any)

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT UPDATE')
    })

    test('DELETE request injects GRANT DELETE hint', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError({
          code: '42501',
          message: 'permission denied for table test',
          details: null,
          hint: null,
        }) as any,
      })

      const res = await postgrest.from('test' as any).delete()

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT DELETE')
    })

    test('does not override existing hint', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError({
          code: '42501',
          message: 'permission denied for table test',
          details: null,
          hint: 'some existing hint',
        }) as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toBe('some existing hint')
    })

    test('returns null hint when message does not match regex', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError({
          code: '42501',
          message: 'permission denied',
          details: null,
          hint: null,
        }) as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toBeNull()
    })

    test('RPC path uses EXECUTE privilege', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError({
          code: '42501',
          message: 'permission denied for function my_func',
          details: null,
          hint: null,
        }) as any,
      })

      const res = await postgrest.rpc('my_func' as any)

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toContain('GRANT EXECUTE')
    })

    test('custom schema is used in qualified name', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        schema: 'myschema' as any,
        fetch: mockFetchWithError({
          code: '42501',
          message: 'permission denied for table test',
          details: null,
          hint: null,
        }) as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toContain('myschema.test')
    })

    test('throwOnError throws PostgrestError with enhanced hint', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError({
          code: '42501',
          message: 'permission denied for table test',
          details: null,
          hint: null,
        }) as any,
      })

      await expect(
        postgrest
          .from('test' as any)
          .select()
          .throwOnError()
      ).rejects.toMatchObject({
        hint: expect.stringContaining('GRANT SELECT'),
      })
    })
  })

  describe('PGRST205 - table not found in schema cache', () => {
    test('GET request injects hint with two possibilities and GRANT SELECT', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError(
          {
            code: 'PGRST205',
            message: "Could not find the table 'secret_table' in the schema cache",
            details: null,
            hint: null,
          },
          404
        ) as any,
      })

      const res = await postgrest.from('secret_table' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toContain("Table 'secret_table' not found")
      expect(res.error!.hint).toContain("table doesn't exist")
      expect(res.error!.hint).toContain('lacks permission')
      expect(res.error!.hint).toContain('GRANT SELECT')
    })

    test('does not override existing hint', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError(
          {
            code: 'PGRST205',
            message: "Could not find the table 'secret_table' in the schema cache",
            details: null,
            hint: 'existing hint',
          },
          404
        ) as any,
      })

      const res = await postgrest.from('secret_table' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toBe('existing hint')
    })
  })

  describe('PGRST202 - function not found in schema cache', () => {
    test('injects hint with two possibilities and GRANT EXECUTE', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError(
          {
            code: 'PGRST202',
            message: 'Could not find the function public.secret_func(id) in the schema cache',
            details: null,
            hint: null,
          },
          404
        ) as any,
      })

      const res = await postgrest.rpc('secret_func' as any)

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toContain("Function 'public.secret_func' not found")
      expect(res.error!.hint).toContain("function doesn't exist")
      expect(res.error!.hint).toContain('lacks permission')
      expect(res.error!.hint).toContain('GRANT EXECUTE')
    })

    test('does not override existing hint', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError(
          {
            code: 'PGRST202',
            message: 'Could not find the function public.secret_func in the schema cache',
            details: null,
            hint: 'existing hint',
          },
          404
        ) as any,
      })

      const res = await postgrest.rpc('secret_func' as any)

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toBe('existing hint')
    })
  })

  describe('unrelated error codes', () => {
    test('PGRST116 hint stays null', async () => {
      const postgrest = new PostgrestClient<Database>('https://example.com', {
        fetch: mockFetchWithError(
          {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            details: 'Results contain 2 rows',
            hint: null,
          },
          406
        ) as any,
      })

      const res = await postgrest.from('test' as any).select()

      expect(res.error).toBeTruthy()
      expect(res.error!.hint).toBeNull()
    })
  })
})
