import { FunctionsClient } from '../src/index'

describe('FunctionsClient', () => {
  describe('invoke – timeout and signal composition', () => {
    it('passes an aborted signal to fetch when the caller signal was already aborted', async () => {
      const mockFetch = jest.fn().mockImplementation((_url, init) => {
        expect(init.signal.aborted).toBe(true)
        return Promise.reject(init.signal.reason)
      })

      const client = new FunctionsClient('http://localhost', { customFetch: mockFetch })
      const controller = new AbortController()
      controller.abort()

      const { error } = await client.invoke('test-fn', {
        timeout: 5000,
        signal: controller.signal,
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(error).not.toBeNull()
    })

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
})
