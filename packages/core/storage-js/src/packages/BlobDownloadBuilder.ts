import { isStorageError } from '../lib/errors'
import { DownloadResult } from '../lib/types'
import StreamDownloadBuilder from './StreamDownloadBuilder'

export default class BlobDownloadBuilder implements PromiseLike<DownloadResult<Blob>> {
  constructor(
    private downloadFn: () => Promise<Response>,
    private shouldThrowOnError: boolean
  ) {}

  asStream(): StreamDownloadBuilder {
    return new StreamDownloadBuilder(this.downloadFn, this.shouldThrowOnError)
  }

  then<TResult1 = DownloadResult<Blob>, TResult2 = never>(
    onfulfilled?: ((value: DownloadResult<Blob>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(): Promise<DownloadResult<Blob>> {
    try {
      const result = await this.downloadFn()

      return {
        data: await result.blob(),
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
