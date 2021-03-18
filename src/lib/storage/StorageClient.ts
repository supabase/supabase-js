import { StorageApi } from './StorageApi'

export class StorageClient {
  api: StorageApi

  constructor(url: string, headers: { [key: string]: string } = {}) {
    this.api = new StorageApi(url, headers)
  }
}
