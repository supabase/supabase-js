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
    // instead of issuing a request when the signal is already aborted. `reached`
    // stands in for the hit counter on the repro's local server: it only counts
    // requests that would actually have run the Edge Function.
    const abortAwareFetch = () => {
      const server = { reached: 0 }
      const fetch = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          return Promise.reject(init.signal.reason)
        }
        server.reached++
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ ok: true }),
        })
      })
      return { fetch, server }
    }

    it('does not let the request reach the function', async () => {
      const { fetch: mockFetch, server } = abortAwareFetch()
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
      expect(server.reached).toBe(0)
    })

    it('forwards the caller abort reason', async () => {
      const { fetch: mockFetch } = abortAwareFetch()
      const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })
      const controller = new AbortController()
      const reason = new Error('caller cancelled')
      controller.abort(reason)

      await client.invoke('test-fn', { timeout: 5000, signal: controller.signal })

      expect(mockFetch.mock.calls[0][1]?.signal?.reason).toBe(reason)
    })
  })

  describe('invoke – caller signal aborts while the request is in flight', () => {
    // The listener path, unlike the guard above, was never broken — this pins the
    // behaviour down so a future change to the guard cannot silently drop it.
    it('aborts the in-flight request and forwards the caller reason', async () => {
      let inFlightSignal: AbortSignal | undefined
      let markRequestStarted!: () => void
      const requestStarted = new Promise<void>((resolve) => {
        markRequestStarted = resolve
      })

      const mockFetch = jest.fn().mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            inFlightSignal = init?.signal ?? undefined
            init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
            markRequestStarted()
          })
      )

      const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })
      const controller = new AbortController()
      const reason = new Error('caller cancelled mid-flight')

      const pending = client.invoke('test-fn', { timeout: 5000, signal: controller.signal })
      await requestStarted
      controller.abort(reason)

      const { data, error } = await pending

      expect(data).toBeNull()
      expect(error).toBeInstanceOf(FunctionsFetchError)
      expect(inFlightSignal?.aborted).toBe(true)
      expect(inFlightSignal?.reason).toBe(reason)
    })
  })
})
