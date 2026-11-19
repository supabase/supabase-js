import { StorageVectorsClient } from '../src/index'
import { StorageError, isStorageVectorsError } from '../src/lib/common/errors'

const URL = 'http://localhost:8000/storage/v1/vector'

describe('VectorDataApi input validation', () => {
  let fetchMock: jest.Mock

  const index = () =>
    new StorageVectorsClient(URL, { fetch: fetchMock }).from('test-bucket').index('test-index')

  beforeEach(() => {
    fetchMock = jest.fn()
  })

  const invalidCalls: Array<[string, (i: ReturnType<typeof index>) => Promise<unknown>, string]> = [
    [
      'putVectors with an empty batch',
      (i) => i.putVectors({ vectors: [] }),
      'Vector batch size must be between 1 and 500 items',
    ],
    [
      'putVectors with more than 500 vectors',
      (i) =>
        i.putVectors({
          vectors: Array.from({ length: 501 }, (_, n) => ({
            key: `vec-${n}`,
            data: { float32: [0.1] },
          })),
        }),
      'Vector batch size must be between 1 and 500 items',
    ],
    [
      'deleteVectors with an empty batch',
      (i) => i.deleteVectors({ keys: [] }),
      'Keys batch size must be between 1 and 500 items',
    ],
    [
      'listVectors with segmentCount out of range',
      (i) => i.listVectors({ segmentCount: 17 }),
      'segmentCount must be between 1 and 16',
    ],
    [
      'listVectors with segmentIndex out of range',
      (i) => i.listVectors({ segmentCount: 4, segmentIndex: 4 }),
      'segmentIndex must be between 0 and 3',
    ],
  ]

  it.each(invalidCalls)('returns an error for %s', async (_, call, message) => {
    const result = (await call(index())) as { data: unknown; error: unknown }

    expect(result.data).toBeNull()
    expect(result.error).toBeInstanceOf(StorageError)
    expect(isStorageVectorsError(result.error)).toBe(true)
    expect((result.error as StorageError).message).toBe(message)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(invalidCalls)('throws with throwOnError() for %s', async (_, call, message) => {
    await expect(call(index().throwOnError())).rejects.toThrow(
      expect.objectContaining({ name: 'StorageVectorsError', message })
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
