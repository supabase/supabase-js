import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { setupRealtimeTest, type TestSetup } from './helpers/setup'

describe('worker object URL ownership', () => {
  let setup: TestSetup
  const createObjectURL = vi.fn()
  const revokeObjectURL = vi.fn()
  const terminate = vi.fn()
  const NativeURL = URL

  beforeEach(() => {
    let nextUrl = 0
    createObjectURL.mockImplementation(() => `blob:heartbeat-${++nextUrl}`)
    class MockURL extends NativeURL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    }
    class MockWorker {
      terminate = terminate
      postMessage = vi.fn()
      onmessage = null
      onerror = null
    }
    vi.stubGlobal('URL', MockURL)
    vi.stubGlobal('Worker', vi.fn(MockWorker))
    setup = setupRealtimeTest({ worker: true })
    // Register the real lifecycle handlers without opening a transport.
    vi.spyOn(setup.client.socketAdapter, 'connect').mockImplementation(() => {})
    setup.client.connect()
  })

  afterEach(() => {
    setup.cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const open = () => setup.client.socketAdapter.getSocket().triggerStateCallbacks('open')
  const close = () => setup.client.socketAdapter.getSocket().triggerStateCallbacks('close')

  test('releases each generated URL on close, including after reconnect', () => {
    open()
    expect(window.Worker).toHaveBeenLastCalledWith('blob:heartbeat-1')
    expect(revokeObjectURL).not.toHaveBeenCalled()
    close()
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:heartbeat-1')
    expect(setup.client.workerRef).toBeUndefined()

    open()
    expect(window.Worker).toHaveBeenLastCalledWith('blob:heartbeat-2')
    close()
    close()
    expect(revokeObjectURL.mock.calls).toEqual([['blob:heartbeat-1'], ['blob:heartbeat-2']])
    expect(terminate).toHaveBeenCalledTimes(2)
  })

  test('releases the generated URL on explicit disconnect', async () => {
    open()
    await setup.client.disconnect()
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:heartbeat-1')
    expect(terminate).toHaveBeenCalledOnce()
  })

  test('releases the generated URL after a worker error', () => {
    open()
    const worker = setup.client.workerRef!
    worker.onerror!.call(worker, new ErrorEvent('error', { message: 'worker failed' }))
    close()
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:heartbeat-1')
    expect(terminate).toHaveBeenCalledOnce()
  })

  for (const workerUrl of ['https://example.com/worker.js', 'blob:caller-owned']) {
    test(`does not revoke a caller-owned URL: ${workerUrl}`, () => {
      setup.client.workerUrl = workerUrl
      open()
      close()
      expect(window.Worker).toHaveBeenCalledWith(workerUrl)
      expect(createObjectURL).not.toHaveBeenCalled()
      expect(revokeObjectURL).not.toHaveBeenCalled()
      expect(terminate).toHaveBeenCalledOnce()
    })
  }

  test('releases the generated URL if Worker construction fails', () => {
    const failure = new DOMException('Worker blocked', 'SecurityError')
    vi.mocked(window.Worker).mockImplementationOnce(function () {
      throw failure
    })
    open()
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:heartbeat-1')
    expect(setup.client.workerRef).toBeUndefined()
  })
})
