import { processLock } from '../../src/lib/locks'

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
})
