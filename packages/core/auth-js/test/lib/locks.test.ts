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

it('should not deadlock when timeout occurs with queued operations', async () => {
  const results:  string[] = []
  
  // Operation 1: Holds lock for 500ms
  const op1 = processLock('deadlock-test', -1, async () => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    results.push('op1-complete')
    return 'op1'
  })

  // Small delay to ensure op1 starts first
  await new Promise((resolve) => setTimeout(resolve, 10))

  // Operation 2: Times out after 100ms
  const op2 = processLock('deadlock-test', 100, async () => {
    results.push('op2-complete')
    return 'op2'
  })

  // Operation 3: Should NOT deadlock - should run after op1
  const op3 = processLock('deadlock-test', 2000, async () => {
    results.push('op3-complete')
    return 'op3'
  })

  // Verify behavior
  await expect(op1).resolves.toBe('op1')
  await expect(op2).rejects.toMatchObject({ isAcquireTimeout: true })
  await expect(op3).resolves.toBe('op3')  // ✅ Should succeed, not hang

  // Verify execution order
  expect(results).toEqual(['op1-complete', 'op3-complete'])
}, 10000)

it('should handle rapid successive operations with mixed timeouts', async () => {
  const results: number[] = []
  
  // Fire 10 operations rapidly
  // Operation 0 will acquire the lock immediately (no wait) so it completes
  // Operations 3, 6, 9 have 50ms timeouts but will need to wait for previous ops
  // Each op takes 100ms, so ops with 50ms timeout that queue will timeout
  const operations = Array.from({ length: 10 }, (_, i) => {
    const timeout = i % 3 === 0 ? 50 : -1 // Every 3rd operation has short timeout
    return processLock('rapid-test', timeout, async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      results.push(i)
      return i
    })
  })

  const settled = await Promise.allSettled(operations)
  
  // Operation 0 acquires lock immediately (no waiting), so it succeeds
  expect(settled[0].status).toBe('fulfilled')
  
  // Operations 3, 6, 9 have 50ms timeouts but must wait for prior ops
  // Since each op takes 100ms, these will timeout while waiting
  expect(settled[3].status).toBe('rejected')
  expect(settled[6].status).toBe('rejected')
  expect(settled[9].status).toBe('rejected')
  
  // Operations 1, 2 have infinite timeout so they succeed
  expect(settled[1].status).toBe('fulfilled')
  expect(settled[2].status).toBe('fulfilled')
  
  // Verify no operations deadlocked (all completed)
  expect(results.length).toBeGreaterThan(0)
}, 15000)