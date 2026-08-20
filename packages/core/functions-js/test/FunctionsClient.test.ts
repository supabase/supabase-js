import { FunctionsClient, FunctionsFetchError } from '../src/index'

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

  describe('invoke – caller signal already aborted when timeout is also set', () => {
    // Mirrors the platform contract: fetch rejects with the signal's reason
    // instead of issuing a request when the signal is already aborted.
    const abortAwareFetch = () =>
      jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          return Promise.reject(init.signal.reason)
        }
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ ok: true }),
        })
      })

    it('does not let the request reach the function', async () => {
      const mockFetch = abortAwareFetch()
      const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })
      const controller = new AbortController()
      controller.abort()

      const { data, error } = await client.invoke('test-fn', {
        timeout: 5000,
        signal: controller.signal,
      })

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(FunctionsFetchError)
      expect(mockFetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
    })

    it('forwards the caller abort reason', async () => {
      const mockFetch = abortAwareFetch()
      const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })
      const controller = new AbortController()
      const reason = new Error('caller cancelled')
      controller.abort(reason)

      await client.invoke('test-fn', { timeout: 5000, signal: controller.signal })

      expect(mockFetch.mock.calls[0][1]?.signal?.reason).toBe(reason)
    })
  })
})
