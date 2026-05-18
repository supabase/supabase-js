import { isStorageError } from '../lib/common/errors'
import { DownloadResult } from '../lib/types'

export default class StreamDownloadBuilder implements Promise<DownloadResult<ReadableStream>> {
  readonly [Symbol.toStringTag]: string = 'StreamDownloadBuilder'
  private promise: Promise<DownloadResult<ReadableStream>> | null = null

  constructor(
    private downloadFn: () => Promise<Response>,
    private shouldThrowOnError: boolean
  ) {}

  then<TResult1 = DownloadResult<ReadableStream>, TResult2 = never>(
    onfulfilled?:
      | ((value: DownloadResult<ReadableStream>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.getPromise().then(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<DownloadResult<ReadableStream> | TResult> {
    return this.getPromise().catch(onrejected)
  }

  finally(onfinally?: (() => void) | null): Promise<DownloadResult<ReadableStream>> {
    return this.getPromise().finally(onfinally)
  }

  private getPromise(): Promise<DownloadResult<ReadableStream>> {
    if (!this.promise) {
      this.promise = this.execute()
    }
    return this.promise
  }

  private async execute(): Promise<DownloadResult<ReadableStream>> {
    try {
      const result = await this.downloadFn()

      return {
        data: result.body as ReadableStream,
        error: null,
      }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }

      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }
}
