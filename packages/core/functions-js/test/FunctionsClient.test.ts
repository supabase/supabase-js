import { FunctionsClient } from '../src/index'

describe('FunctionsClient', () => {
  describe('invoke – abort listener cleanup when timeout + signal are both set', () => {
    it('removes the listener from the caller signal after a successful invoke', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ ok: true }),
      })

      const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })
      const controller = new AbortController()

      const addSpy = jest.spyOn(controller.signal, 'addEventListener')
      const removeSpy = jest.spyOn(controller.signal, 'removeEventListener')

      await client.invoke('test-fn', { timeout: 5000, signal: controller.signal })

      const addedFn = addSpy.mock.calls.find(([event]) => event === 'abort')?.[1]
      const removedFn = removeSpy.mock.calls.find(([event]) => event === 'abort')?.[1]

      expect(addedFn).toBeDefined()
      expect(addedFn).toBe(removedFn)
    })

    it('removes the listener from the caller signal after a failed invoke', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => null },
        text: () => Promise.resolve('Internal Server Error'),
      })

      const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })
      const controller = new AbortController()

      const addSpy = jest.spyOn(controller.signal, 'addEventListener')
      const removeSpy = jest.spyOn(controller.signal, 'removeEventListener')

      await client.invoke('test-fn', { timeout: 5000, signal: controller.signal })

      const addedFn = addSpy.mock.calls.find(([event]) => event === 'abort')?.[1]
      const removedFn = removeSpy.mock.calls.find(([event]) => event === 'abort')?.[1]

      expect(addedFn).toBeDefined()
      expect(addedFn).toBe(removedFn)
    })
  })

  describe('invoke – typed array body', () => {
    const setup = () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('ok'),
      })
      const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })
      return { client, mockFetch }
    }

    it('sends a Uint8Array body as raw bytes', async () => {
      const { client, mockFetch } = setup()
      const bytes = new Uint8Array([1, 2, 3])

      await client.invoke('test-fn', { body: bytes })

      const [, init] = mockFetch.mock.calls[0]
      expect(init.body).toBe(bytes)
      expect(init.headers['Content-Type']).toBe('application/octet-stream')
    })

    it('sends a DataView body as raw bytes', async () => {
      const { client, mockFetch } = setup()
      const view = new DataView(new ArrayBuffer(4))

      await client.invoke('test-fn', { body: view })

      const [, init] = mockFetch.mock.calls[0]
      expect(init.body).toBe(view)
      expect(init.headers['Content-Type']).toBe('application/octet-stream')
    })

    it('does not JSON encode a Uint8Array body when Content-Type is set by the caller', async () => {
      const { client, mockFetch } = setup()
      const bytes = new Uint8Array([1, 2, 3])

      await client.invoke('test-fn', {
        body: bytes,
        headers: { 'Content-Type': 'image/png' },
      })

      const [, init] = mockFetch.mock.calls[0]
      expect(init.body).toBe(bytes)
      expect(init.headers['Content-Type']).toBe('image/png')
    })
  })
})
