import { processLock, navigatorLock } from '../../src/lib/locks'

describe('navigatorLock', () => {
  beforeEach(() => {
    // Mock navigator.locks API
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        locks: {
          request: jest
            .fn()
            .mockImplementation((_, __, callback) => Promise.resolve(callback(null))),
          query: jest.fn().mockResolvedValue({ held: [] }),
        },
      },
      configurable: true,
    })
  })

  it('should acquire and release lock successfully', async () => {
    const mockLock = { name: 'test-lock' }
    ;(globalThis.navigator.locks.request as jest.Mock).mockImplementation((_, __, callback) =>
      Promise.resolve(callback(mockLock))
    )

    const result = await navigatorLock('test', -1, async () => 'success')
    expect(result).toBe('success')
    expect(globalThis.navigator.locks.request).toHaveBeenCalled()
  })

  it('should handle immediate acquisition failure', async () => {
    ;(globalThis.navigator.locks.request as jest.Mock).mockImplementation((_, __, callback) =>
      Promise.resolve(callback(null))
    )

    await expect(navigatorLock('test', 0, async () => 'success')).rejects.toThrow()
  })

  it('should not throw if browser is not following the Navigator LockManager spec', async () => {
    await expect(navigatorLock('test-lock', 1, async () => 'success')).resolves.toBe('success')
  })
})

describe('processLock', () => {
  it('should serialize access correctly', async () => {
    const timestamps: number[] = []
    const operations: Promise<any>[] = []

    let expectedDuration = 0

    for (let i = 0; i <= 1000; i += 1) {
      const acquireTimeout = Math.random() < 0.3 ? Math.ceil(10 + Math.random() * 100) : -1

      operations.push(
        (async () => {
          try {
            await processLock('name', acquireTimeout, async () => {
              const start = Date.now()

              timestamps.push(start)

              let diff = Date.now() - start

              while (diff < 10) {
                // setTimeout is not very precise, sometimes it actually times out a bit earlier
                // so this cycle ensures that it has actually taken >= 10ms
                await new Promise((accept) => {
                  setTimeout(() => accept(null), Math.max(1, 10 - diff))
                })

                diff = Date.now() - start
              }

              expectedDuration += Date.now() - start
            })
          } catch (e: any) {
            if (acquireTimeout > -1 && e && e.isAcquireTimeout) {
              return null
            }

            throw e
          }
        })()
      )
    }

    const start = Date.now()

    await Promise.all(operations)

    const end = Date.now()

    expect(end - start).toBeGreaterThanOrEqual(expectedDuration)
    expect(Math.ceil((end - start) / timestamps.length)).toBeGreaterThanOrEqual(10)

    for (let i = 1; i < timestamps.length; i += 1) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1])
    }

    for (let i = 1; i < timestamps.length; i += 1) {
      expect(timestamps[i] - timestamps[i - 1]).toBeGreaterThanOrEqual(10)
    }
  }, 15_000)

  it('should throw LockAcquireTimeoutError when lock acquisition times out', async () => {
    // Start an operation that holds the lock for 200ms
    const operation1 = processLock('timeout-test', -1, async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      return 'success'
    })

    // Try to acquire same lock with 100ms timeout - should fail
    const operation2 = processLock('timeout-test', 100, async () => 'should timeout')

    // Verify the error is a LockAcquireTimeoutError (identified by isAcquireTimeout property)
    await expect(operation2).rejects.toMatchObject({
      isAcquireTimeout: true,
    })
    await expect(operation1).resolves.toBe('success')
  })

  it('should fail immediately when acquireTimeout is 0 and lock is held', async () => {
    const operation1 = processLock('immediate-test', -1, async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return 'success'
    })

    // Try to acquire same lock with timeout=0 (fail immediately)
    const operation2 = processLock('immediate-test', 0, async () => 'should fail immediately')

    await expect(operation2).rejects.toMatchObject({
      isAcquireTimeout: true,
    })
    await expect(operation1).resolves.toBe('success')
  })

  it('should handle errors in locked operation', async () => {
    const errorMessage = 'Test error'
    await expect(
      processLock('error-test', -1, async () => {
        throw new Error(errorMessage)
      })
    ).rejects.toThrow(errorMessage)

    await expect(processLock('error-test', -1, async () => 'success')).resolves.toBe('success')
  })
})
