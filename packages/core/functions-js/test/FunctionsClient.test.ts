/// <reference types="jest" />
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

  describe('invoke – Blob and File content type handling', () => {
    it('sends a File with its own content type', async () => {
      let capturedContentType: string | null = null

      const customFetch: typeof fetch = async (_input, init) => {
        capturedContentType = new Headers(init?.headers).get('content-type')
        return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
      }

      const client = new FunctionsClient('http://localhost/functions/v1', { customFetch })
      await client.invoke('upload', {
        body: new File(['x'], 'a.png', { type: 'image/png' }),
      })

      expect(capturedContentType).toEqual('image/png')
    })

    it('falls back to application/octet-stream for a Blob with no type', async () => {
      let capturedContentType: string | null = null

      const customFetch: typeof fetch = async (_input, init) => {
        capturedContentType = new Headers(init?.headers).get('content-type')
        return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
      }

      const client = new FunctionsClient('http://localhost/functions/v1', { customFetch })
      await client.invoke('upload', {
        body: new Blob(['x']),
      })

      expect(capturedContentType).toEqual('application/octet-stream')
    })
  })
})
