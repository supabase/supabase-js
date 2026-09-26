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

  describe('invoke – text/event-stream response with timeout + signal', () => {
    it('forwards a caller abort that happens after invoke returns the stream', async () => {
      let fetchSignal: AbortSignal | undefined
      const streamResponse = {
        ok: true,
        headers: { get: (name: string) => (name === 'Content-Type' ? 'text/event-stream' : null) },
      }
      const mockFetch = jest.fn().mockImplementation((_url: string, init: RequestInit) => {
        fetchSignal = init.signal ?? undefined
        return Promise.resolve(streamResponse)
      })

      const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })
      const controller = new AbortController()

      const { data, error } = await client.invoke('stream-fn', {
        timeout: 5000,
        signal: controller.signal,
      })
      expect(error).toBeNull()
      // The body is returned unread, so the request is still in flight.
      expect(data).toBe(streamResponse)
      expect(fetchSignal?.aborted).toBe(false)

      // e.g. a "stop generating" button cancelling an AI response stream
      controller.abort()

      expect(fetchSignal?.aborted).toBe(true)
    })
  })
})
